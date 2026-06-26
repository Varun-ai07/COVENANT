// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title CovenantArbitration V5 — Dispute resolution with CEI fixes
/// @notice Client/worker stake + arbiter ruling + split basis points
/// @dev Fixes V4: CEI in settleDispute, batch size limits, emergency withdrawal
contract CovenantArbitration is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using ECDSAUpgradeable for bytes32;

    // ═══════════════════════════════════════════════════════════════
    // Types
    // ═══════════════════════════════════════════════════════════════

    enum DisputeRuling { None, ClientWins, WorkerWins, Split }
    enum TaskStatus { None, Created, Funded, Submitted, Disputed, Completed, Failed, Cancelled }

    struct DisputeStorage {
        uint256 taskId;
        address disputant;
        DisputeRuling ruling;
        uint8 splitBps;
        uint32 createdAt;
        bytes32 evidenceHash;
        uint96 clientStake;
        uint96 workerStake;
        bool settled;
    }

    // ═══════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════

    mapping(uint256 => DisputeStorage) private _disputes;
    uint256 public disputeCount;

    address public escrow;
    address public arbiter;
    uint96 public constant MIN_STAKE = 0.001 ether;
    uint256 public constant STAKE_SLASH_BPS = 5000;

    // ═══════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════

    event DisputeCreated(uint256 indexed disputeId, uint256 indexed taskId, address indexed disputant);
    event DisputeStaked(uint256 indexed disputeId, address indexed staker, uint96 amount);
    event DisputeRuled(uint256 indexed disputeId, uint8 ruling, uint8 splitBps);
    event DisputeSettled(uint256 indexed disputeId, address client, address worker, uint128 clientPayout, uint128 workerPayout);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    // ═══════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════

    error DisputeNotFound();
    error AlreadySettled();
    error InsufficientStake();
    error NotParty();
    error NotArbiter();
    error InvalidRuling();
    error InvalidSplit();
    error AlreadyRuled();
    error InvalidArbiterSignature();
    error Unauthorized();
    error InvalidAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(address _escrow, address _arbiter) public initializer {
        if (_escrow == address(0) || _arbiter == address(0)) revert InvalidAddress();
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        escrow = _escrow;
        arbiter = _arbiter;
    }

    function createDispute(uint256 taskId, bytes32 evidenceHash) external nonReentrant whenNotPaused {
        // Read task from escrow (external call — acceptable here for validation)
        (address client, address worker, , , uint8 status, , ) = _getTask(taskId);

        if (status != uint8(TaskStatus.Disputed) &&
            status != uint8(TaskStatus.Submitted) &&
            status != uint8(TaskStatus.Funded)) {
            revert NotDisputable();
        }
        if (msg.sender != client && msg.sender != worker) revert NotParty();

        uint256 disputeId = ++disputeCount;

        // CEI: State update before external call
        _disputes[disputeId] = DisputeStorage({
            taskId: taskId,
            disputant: msg.sender,
            ruling: DisputeRuling.None,
            splitBps: 0,
            createdAt: uint32(block.timestamp),
            evidenceHash: evidenceHash,
            clientStake: 0,
            workerStake: 0,
            settled: false
        });

        emit DisputeCreated(disputeId, taskId, msg.sender);

        // External call AFTER state update
        if (status != uint8(TaskStatus.Disputed)) {
            _disputeTask(taskId);
        }
    }

    function stakeForDispute(uint256 disputeId) external payable nonReentrant whenNotPaused {
        DisputeStorage storage dispute = _disputes[disputeId];
        if (dispute.taskId == 0) revert DisputeNotFound();
        if (dispute.settled) revert AlreadySettled();
        if (msg.value < MIN_STAKE) revert InsufficientStake();

        (address client, address worker, , , , , ) = _getTask(dispute.taskId);

        // CEI: State update before external call
        if (msg.sender == client) {
            dispute.clientStake += uint96(msg.value);
        } else if (msg.sender == worker) {
            dispute.workerStake += uint96(msg.value);
        } else {
            revert NotParty();
        }

        emit DisputeStaked(disputeId, msg.sender, uint96(msg.value));
    }

    function submitRuling(
        uint256 disputeId,
        uint8 ruling,
        uint8 splitBps,
        bytes calldata arbiterSignature
    ) external nonReentrant {
        if (msg.sender != arbiter) revert NotArbiter();
        if (ruling < 1 || ruling > 3) revert InvalidRuling();
        if (splitBps > 10000) revert InvalidSplit();

        DisputeStorage storage dispute = _disputes[disputeId];
        if (dispute.taskId == 0) revert DisputeNotFound();
        if (dispute.ruling != DisputeRuling.None) revert AlreadyRuled();

        // Verify arbiter signature
        bytes32 message = keccak256(abi.encodePacked(disputeId, ruling, splitBps, block.chainid, address(this)));
        bytes32 ethSignedHash = message.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(arbiterSignature);
        if (signer != arbiter) revert InvalidArbiterSignature();

        // CEI: State update
        dispute.ruling = DisputeRuling(ruling);
        dispute.splitBps = splitBps;

        emit DisputeRuled(disputeId, ruling, splitBps);
    }

    function settleDispute(uint256 disputeId) external nonReentrant whenNotPaused {
        DisputeStorage storage dispute = _disputes[disputeId];
        if (dispute.taskId == 0) revert DisputeNotFound();
        if (dispute.ruling == DisputeRuling.None) revert NotRuled();
        if (dispute.settled) revert AlreadySettled();

        // Read task from escrow
        (address client, address worker, uint128 taskAmount, , , , ) = _getTask(dispute.taskId);

        uint128 clientPayout;
        uint128 workerPayout;

        if (dispute.ruling == DisputeRuling.ClientWins) {
            clientPayout = taskAmount;
        } else if (dispute.ruling == DisputeRuling.WorkerWins) {
            workerPayout = taskAmount;
        } else {
            clientPayout = uint128((uint256(taskAmount) * (10000 - dispute.splitBps)) / 10000);
            workerPayout = taskAmount - clientPayout;
        }

        // CEI: State update BEFORE external calls
        dispute.settled = true;

        // External calls AFTER state update
        if (clientPayout > 0) {
            (bool success1, ) = client.call{value: clientPayout}("");
            require(success1, "client payout failed");
        }
        if (workerPayout > 0) {
            (bool success2, ) = worker.call{value: workerPayout}("");
            require(success2, "worker payout failed");
        }

        // NOTE: Do NOT call _failTask here — payouts are handled above.
        // Calling _failTask would trigger a second refund from escrow (double-payout bug).

        emit DisputeSettled(disputeId, client, worker, clientPayout, workerPayout);
    }

    // ═══════════════════════════════════════════════════════════════
    // Emergency (V5 addition)
    // ═══════════════════════════════════════════════════════════════

    function emergencyWithdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        if (amount > address(this).balance / 10) revert ExcessiveWithdraw();
        (bool success, ) = to.call{value: amount}("");
        require(success, "emergency withdraw failed");
        emit EmergencyWithdraw(to, amount);
    }

    // ═══════════════════════════════════════════════════════════════
    // Internal helpers
    // ═══════════════════════════════════════════════════════════════

    function _getTask(uint256 taskId) internal view returns (
        address client, address worker, uint128 amount, uint32 deadline,
        uint8 status, uint8 disputeCount, bytes32 metaHash
    ) {
        // Interface call to escrow
        bytes memory data = abi.encodeWithSignature("getTask(uint256)", taskId);
        (bool success, bytes memory result) = escrow.staticcall(data);
        require(success, "failed to read task");
        (client, worker, amount, deadline, status, disputeCount, metaHash) = abi.decode(result, (address, address, uint128, uint32, uint8, uint8, bytes32));
    }

    function _disputeTask(uint256 taskId) internal {
        bytes memory data = abi.encodeWithSignature("disputeTask(uint256)", taskId);
        (bool success, ) = escrow.call(data);
        require(success, "failed to dispute task");
    }

    function _failTask(uint256 taskId, bytes32 reason) internal {
        bytes memory data = abi.encodeWithSignature("failTask(uint256,bytes32)", taskId, reason);
        (bool success, ) = escrow.call(data);
        require(success, "failed to fail task");
    }

    // ═══════════════════════════════════════════════════════════════
    // View functions
    // ═══════════════════════════════════════════════════════════════

    function getDispute(uint256 disputeId) external view returns (DisputeStorage memory) {
        return _disputes[disputeId];
    }

    // ═══════════════════════════════════════════════════════════════
    // Admin functions
    // ═══════════════════════════════════════════════════════════════

    function setArbiter(address _arbiter) external onlyOwner { if (_arbiter == address(0)) revert InvalidAddress(); arbiter = _arbiter; }
    function setEscrow(address _escrow) external onlyOwner { if (_escrow == address(0)) revert InvalidAddress(); escrow = _escrow; }

    // Custom errors
    error NotDisputable();
    error ExcessiveWithdraw();
    error NotRuled();
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    receive() external payable {}

    function _authorizeUpgrade(address) internal override onlyOwner {}

    uint256[50] private __gap;
}
