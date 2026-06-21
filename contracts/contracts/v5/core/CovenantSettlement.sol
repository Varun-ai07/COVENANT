// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";

/// @title CovenantSettlement V5 — Streaming + receipt settlement with batch limits
/// @notice Sub-second agent interactions via signed receipts, batch settlement with limits
/// @dev Fixes V4: Batch size limits, CEI pattern, emergency withdrawal
contract CovenantSettlement is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using ECDSAUpgradeable for bytes32;
    using SafeCastUpgradeable for uint256;

    // ═══════════════════════════════════════════════════════════════
    // Types
    // ═══════════════════════════════════════════════════════════════

    struct StreamStorage {
        address payer;
        address payee;
        uint128 ratePerSecond;
        uint32 startTime;
        uint32 endTime;
        uint128 deposited;
        uint128 streamed;
        bool active;
    }

    struct ReceiptStorage {
        address payer;
        address payee;
        uint128 amount;
        uint256 nonce;
        bool settled;
    }

    // ═══════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════

    mapping(uint256 => StreamStorage) private _streams;
    mapping(bytes32 => ReceiptStorage) private _receipts;

    uint256 public streamCount;
    uint256 public receiptCount;
    uint256 public batchCount;

    address public identity;
    uint256 public constant MAX_BATCH_SIZE = 50;

    bytes32 private constant RECEIPT_TYPEHASH =
        keccak256("Receipt(address payer,address payee,uint128 amount,uint256 nonce,uint256 chainId)");

    // ═══════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════

    event StreamCreated(uint256 indexed streamId, address indexed payer, address indexed payee, uint128 ratePerSecond, uint32 duration);
    event StreamWithdrawn(uint256 indexed streamId, address indexed payee, uint128 amount);
    event StreamCancelled(uint256 indexed streamId, uint128 refunded);
    event ReceiptSettled(uint256 indexed receiptId, address indexed payer, address indexed payee, uint128 amount);
    event BatchReceiptSettled(uint256 indexed batchId, uint256 count);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    // ═══════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════

    error InvalidPayee();
    error InvalidAmount();
    error MustDeposit();
    error InsufficientDeposit();
    error StreamNotActive();
    error NotPayee();
    error NotPayer();
    error NothingToClaim();
    error InvalidPayerSignature();
    error AlreadySettled();
    error InsufficientBalance();
    error BatchTooLarge();
    error BatchLengthMismatch();
    error InvalidAddress();
    error ExcessiveWithdraw();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(address _identity) public initializer {
        if (_identity == address(0)) revert InvalidAddress();
        __Ownable_init();
        __ReentrancyGuard_init();
        identity = _identity;
    }

    // ═══════════════════════════════════════════════════════════════
    // Streaming
    // ═══════════════════════════════════════════════════════════════

    function createStream(
        address payee,
        uint128 ratePerSecond,
        uint32 duration
    ) external payable nonReentrant returns (uint256 streamId) {
        if (payee == address(0)) revert InvalidPayee();
        if (ratePerSecond == 0) revert InvalidAmount();
        if (duration == 0) revert InvalidAmount();
        if (msg.value == 0) revert MustDeposit();

        streamId = ++streamCount;
        uint32 endTime = uint32(block.timestamp + duration);
        uint128 totalCost = SafeCastUpgradeable.toUint128(uint256(ratePerSecond) * duration);

        if (msg.value < totalCost) revert InsufficientDeposit();

        // CEI: State update before external calls
        _streams[streamId] = StreamStorage({
            payer: msg.sender,
            payee: payee,
            ratePerSecond: ratePerSecond,
            startTime: uint32(block.timestamp),
            endTime: endTime,
            deposited: uint128(msg.value),
            streamed: 0,
            active: true
        });

        emit StreamCreated(streamId, msg.sender, payee, ratePerSecond, duration);

        // Refund excess (CEI: state already updated)
        if (msg.value > totalCost) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - totalCost}("");
            require(refundSuccess, "refund failed");
        }
    }

    function withdrawStream(uint256 streamId) external nonReentrant {
        StreamStorage storage stream = _streams[streamId];
        if (!stream.active) revert StreamNotActive();
        if (msg.sender != stream.payee) revert NotPayee();

        uint128 claimable = _calculateClaimable(stream);
        if (claimable == 0) revert NothingToClaim();

        // CEI: State update before external call
        stream.streamed += claimable;

        // External call AFTER state update
        (bool success, ) = stream.payee.call{value: claimable}("");
        require(success, "transfer failed");

        emit StreamWithdrawn(streamId, stream.payee, claimable);
    }

    function cancelStream(uint256 streamId) external nonReentrant {
        StreamStorage storage stream = _streams[streamId];
        if (!stream.active) revert StreamNotActive();
        if (msg.sender != stream.payer) revert NotPayer();

        uint128 claimable = _calculateClaimable(stream);

        // CEI: State update before external calls
        stream.streamed += claimable;
        stream.active = false;

        if (claimable > 0) {
            (bool success, ) = stream.payee.call{value: claimable}("");
            require(success, "transfer failed");
        }

        uint128 refunded = stream.deposited - stream.streamed;
        if (refunded > 0) {
            (bool refundSuccess, ) = stream.payer.call{value: refunded}("");
            require(refundSuccess, "refund failed");
        }

        emit StreamCancelled(streamId, refunded);
    }

    // ═══════════════════════════════════════════════════════════════
    // Receipt settlement
    // ═══════════════════════════════════════════════════════════════

    function settleReceipt(
        address payer,
        address payee,
        uint128 amount,
        uint256 nonce,
        bytes calldata payerSignature
    ) external payable nonReentrant returns (uint256 receiptId) {
        if (payer == address(0) || payee == address(0)) revert InvalidPayee();
        if (amount == 0) revert InvalidAmount();

        // Verify payer signature (EIP-712 style)
        bytes32 receiptHash = keccak256(abi.encodePacked(
            RECEIPT_TYPEHASH, payer, payee, amount, nonce, block.chainid, address(this)
        ));
        bytes32 ethSignedHash = receiptHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(payerSignature);
        if (signer != payer) revert InvalidPayerSignature();

        bytes32 receiptKey = keccak256(abi.encodePacked(payer, payee, amount, nonce));
        if (_receipts[receiptKey].settled) revert AlreadySettled();

        // CEI: State update before external call
        receiptId = ++receiptCount;
        _receipts[receiptKey] = ReceiptStorage({
            payer: payer,
            payee: payee,
            amount: amount,
            nonce: nonce,
            settled: true
        });

        // Verify contract has sufficient balance
        if (address(this).balance < amount) revert InsufficientBalance();

        // External call AFTER state update
        (bool success, ) = payee.call{value: amount}("");
        require(success, "transfer failed");

        emit ReceiptSettled(receiptId, payer, payee, amount);
    }

    function batchSettleReceipts(
        address[] calldata payers,
        address[] calldata payees,
        uint128[] calldata amounts,
        uint256[] calldata nonces,
        bytes[] calldata payerSignatures
    ) external nonReentrant returns (uint256 batchId) {
        if (payers.length != payees.length || payees.length != amounts.length ||
            amounts.length != nonces.length || nonces.length != payerSignatures.length) {
            revert BatchLengthMismatch();
        }
        if (payers.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        batchId = ++batchCount;

        for (uint256 i = 0; i < payers.length; i++) {
            if (payees[i] == address(0)) revert InvalidPayee();
            if (amounts[i] == 0) revert InvalidAmount();

            bytes32 receiptHash = keccak256(abi.encodePacked(
                RECEIPT_TYPEHASH, payers[i], payees[i], amounts[i], nonces[i], block.chainid, address(this)
            ));
            bytes32 ethSignedHash = receiptHash.toEthSignedMessageHash();
            address signer = ethSignedHash.recover(payerSignatures[i]);
            if (signer != payers[i]) revert InvalidPayerSignature();

            bytes32 receiptKey = keccak256(abi.encodePacked(payers[i], payees[i], amounts[i], nonces[i]));
            if (_receipts[receiptKey].settled) revert AlreadySettled();

            // CEI: State update before external call
            _receipts[receiptKey] = ReceiptStorage({
                payer: payers[i],
                payee: payees[i],
                amount: amounts[i],
                nonce: nonces[i],
                settled: true
            });

            // External call AFTER state update
            (bool success, ) = payees[i].call{value: amounts[i]}("");
            require(success, "transfer failed");

            emit ReceiptSettled(batchId, payers[i], payees[i], amounts[i]);
        }

        emit BatchReceiptSettled(batchId, payers.length);
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
    // View functions
    // ═══════════════════════════════════════════════════════════════

    function claimableAmount(uint256 streamId) external view returns (uint128) {
        return _calculateClaimable(_streams[streamId]);
    }

    function getStream(uint256 streamId) external view returns (StreamStorage memory) {
        return _streams[streamId];
    }

    function _calculateClaimable(StreamStorage storage stream) internal view returns (uint128) {
        if (!stream.active) return 0;

        uint32 currentTime = uint32(block.timestamp < stream.endTime ? block.timestamp : stream.endTime);
        uint128 totalStreamed = SafeCastUpgradeable.toUint128(uint256(stream.ratePerSecond) * (currentTime - stream.startTime));

        if (totalStreamed > stream.deposited) totalStreamed = stream.deposited;
        if (totalStreamed <= stream.streamed) return 0;

        return totalStreamed - stream.streamed;
    }
    receive() external payable {}
}
