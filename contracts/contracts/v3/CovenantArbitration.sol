// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "./interfaces/ICovenantArbitration.sol";
import "./interfaces/ICovenantEscrow.sol";

/// @title CovenantArbitration V3 - Dispute resolution: stake, rule, settle
contract CovenantArbitration is
    ICovenantArbitration,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using ECDSAUpgradeable for bytes32;

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

    mapping(uint256 => DisputeStorage) private _disputes;
    uint256 public override disputeCount;

    address public escrow;
    address public arbiter;
    uint96 public constant MIN_STAKE = 0.001 ether;
    uint256 public constant STAKE_SLASH_BPS = 5000;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(address _escrow, address _arbiter) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        escrow = _escrow;
        arbiter = _arbiter;
    }

    function createDispute(uint256 taskId, bytes32 evidenceHash) external override nonReentrant {
        ICovenantEscrow.Task memory task = ICovenantEscrow(escrow).getTask(taskId);
        require(
            task.status == uint8(TaskStatus.Disputed) ||
            task.status == uint8(TaskStatus.Submitted) ||
            task.status == uint8(TaskStatus.Funded),
            "not disputable"
        );
        require(
            msg.sender == task.client || msg.sender == task.worker,
            "not party"
        );

        uint256 disputeId = ++disputeCount;

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

        ICovenantEscrow(escrow).disputeTask(taskId);
        emit DisputeCreated(disputeId, taskId, msg.sender);
    }

    function stakeForDispute(uint256 disputeId) external override payable nonReentrant {
        DisputeStorage storage dispute = _disputes[disputeId];
        require(dispute.taskId > 0, "dispute not found");
        require(!dispute.settled, "already settled");
        require(msg.value >= MIN_STAKE, "insufficient stake");

        ICovenantEscrow.Task memory task = ICovenantEscrow(escrow).getTask(dispute.taskId);

        if (msg.sender == task.client) {
            dispute.clientStake += uint96(msg.value);
            emit DisputeStaked(disputeId, msg.sender, uint96(msg.value));
        } else if (msg.sender == task.worker) {
            dispute.workerStake += uint96(msg.value);
            emit DisputeStaked(disputeId, msg.sender, uint96(msg.value));
        } else {
            revert("not party");
        }
    }

    function submitRuling(
        uint256 disputeId,
        uint8 ruling,
        uint8 splitBps,
        bytes calldata arbiterSignature
    ) external override nonReentrant {
        require(msg.sender == arbiter, "not arbiter");
        require(ruling >= 1 && ruling <= 3, "invalid ruling");
        require(splitBps <= 10000, "invalid split");

        DisputeStorage storage dispute = _disputes[disputeId];
        require(dispute.taskId > 0, "dispute not found");
        require(dispute.ruling == DisputeRuling.None, "already ruled");

        bytes32 message = keccak256(abi.encodePacked(disputeId, ruling, splitBps, block.chainid));
        bytes32 ethSignedHash = message.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(arbiterSignature);
        require(signer == arbiter, "invalid arbiter signature");

        dispute.ruling = DisputeRuling(ruling);
        dispute.splitBps = splitBps;

        emit DisputeRuled(disputeId, ruling, splitBps);
    }

    function settleDispute(uint256 disputeId) external override nonReentrant {
        DisputeStorage storage dispute = _disputes[disputeId];
        require(dispute.taskId > 0, "dispute not found");
        require(dispute.ruling != DisputeRuling.None, "not ruled");
        require(!dispute.settled, "already settled");

        ICovenantEscrow.Task memory task = ICovenantEscrow(escrow).getTask(dispute.taskId);
        uint128 taskAmount = task.amount;

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

        dispute.settled = true;

        if (clientPayout > 0) {
            (bool success1, ) = task.client.call{value: clientPayout}("");
            require(success1, "client payout failed");
        }
        if (workerPayout > 0) {
            (bool success2, ) = task.worker.call{value: workerPayout}("");
            require(success2, "worker payout failed");
        }

        ICovenantEscrow(escrow).failTask(dispute.taskId, keccak256("dispute settled"));

        emit DisputeSettled(disputeId, task.client, task.worker, clientPayout, workerPayout);
    }

    function getDispute(uint256 disputeId) external view override returns (Dispute memory) {
        DisputeStorage storage d = _disputes[disputeId];
        return Dispute({
            taskId: d.taskId,
            disputant: d.disputant,
            ruling: uint8(d.ruling),
            splitBps: d.splitBps,
            createdAt: d.createdAt,
            evidenceHash: d.evidenceHash,
            clientStake: d.clientStake,
            workerStake: d.workerStake,
            settled: d.settled
        });
    }

    function setArbiter(address _arbiter) external onlyOwner {
        arbiter = _arbiter;
    }

    function setEscrow(address _escrow) external onlyOwner {
        escrow = _escrow;
    }
}
