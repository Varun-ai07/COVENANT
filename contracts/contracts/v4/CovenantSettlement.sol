// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "./interfaces/ICovenantSettlement.sol";

/// @title CovenantSettlement V4 - Payment infrastructure: streaming, receipt settlement, batch
/// @notice Sub-second agent interactions via signed receipts, batch settlement on-chain
contract CovenantSettlement is
    ICovenantSettlement,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using ECDSAUpgradeable for bytes32;

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

    mapping(uint256 => StreamStorage) private _streams;
    mapping(bytes32 => ReceiptStorage) private _receipts;
    mapping(address => uint256) private _payerNonces;

    uint256 public override streamCount;
    uint256 public receiptCount;
    uint256 public batchCount;

    address public identity;

    bytes32 private constant RECEIPT_TYPEHASH =
        keccak256("Receipt(address payer,address payee,uint128 amount,uint256 nonce,uint256 chainId)");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(address _identity) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        identity = _identity;
    }

    function createStream(
        address payee,
        uint128 ratePerSecond,
        uint32 duration,
        address
    ) external override payable nonReentrant returns (uint256 streamId) {
        require(payee != address(0), "invalid payee");
        require(ratePerSecond > 0, "rate must be > 0");
        require(duration > 0, "duration must be > 0");
        require(msg.value > 0, "must deposit");

        streamId = ++streamCount;
        uint32 endTime = uint32(block.timestamp + duration);
        uint128 totalCost = uint128(uint256(ratePerSecond) * duration);

        require(msg.value >= totalCost, "insufficient deposit");

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

        if (msg.value > totalCost) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - totalCost}("");
            require(refundSuccess, "refund failed");
        }
    }

    function withdrawStream(uint256 streamId) external override nonReentrant {
        StreamStorage storage stream = _streams[streamId];
        require(stream.active, "not active");
        require(msg.sender == stream.payee, "not payee");

        uint128 claimable = _calculateClaimable(stream);
        require(claimable > 0, "nothing to claim");

        stream.streamed += claimable;

        (bool success, ) = stream.payee.call{value: claimable}("");
        require(success, "transfer failed");

        emit StreamWithdrawn(streamId, stream.payee, claimable);
    }

    function cancelStream(uint256 streamId) external override nonReentrant {
        StreamStorage storage stream = _streams[streamId];
        require(stream.active, "not active");
        require(msg.sender == stream.payer, "not payer");

        uint128 claimable = _calculateClaimable(stream);
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

    function settleReceipt(
        address payer,
        address payee,
        uint128 amount,
        uint256 nonce,
        bytes calldata payerSignature
    ) external payable override nonReentrant returns (uint256 receiptId) {
        require(payee != address(0), "invalid payee");
        require(amount > 0, "amount must be > 0");

        bytes32 receiptHash = keccak256(
            abi.encodePacked(
                RECEIPT_TYPEHASH,
                payer,
                payee,
                amount,
                nonce,
                block.chainid
            )
        );
        bytes32 ethSignedHash = receiptHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(payerSignature);
        require(signer == payer, "invalid payer signature");

        bytes32 receiptKey = keccak256(abi.encodePacked(payer, payee, amount, nonce));
        require(!_receipts[receiptKey].settled, "already settled");

        receiptId = ++receiptCount;
        _receipts[receiptKey] = ReceiptStorage({
            payer: payer,
            payee: payee,
            amount: amount,
            nonce: nonce,
            settled: true
        });

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
    ) external override nonReentrant returns (uint256 batchId) {
        require(
            payers.length == payees.length &&
            payees.length == amounts.length &&
            amounts.length == nonces.length &&
            nonces.length == payerSignatures.length,
            "length mismatch"
        );

        batchId = ++batchCount;

        for (uint256 i = 0; i < payers.length; i++) {
            require(payees[i] != address(0), "invalid payee");
            require(amounts[i] > 0, "amount must be > 0");

            bytes32 receiptHash = keccak256(
                abi.encodePacked(
                    RECEIPT_TYPEHASH,
                    payers[i],
                    payees[i],
                    amounts[i],
                    nonces[i],
                    block.chainid
                )
            );
            bytes32 ethSignedHash = receiptHash.toEthSignedMessageHash();
            address signer = ethSignedHash.recover(payerSignatures[i]);
            require(signer == payers[i], "invalid payer signature");

            bytes32 receiptKey = keccak256(abi.encodePacked(payers[i], payees[i], amounts[i], nonces[i]));
            require(!_receipts[receiptKey].settled, "already settled");

            _receipts[receiptKey] = ReceiptStorage({
                payer: payers[i],
                payee: payees[i],
                amount: amounts[i],
                nonce: nonces[i],
                settled: true
            });

            (bool success, ) = payees[i].call{value: amounts[i]}("");
            require(success, "transfer failed");

            emit ReceiptSettled(batchId, payers[i], payees[i], amounts[i]);
        }

        emit BatchReceiptSettled(batchId, payers.length);
    }

    function claimableAmount(uint256 streamId) external view override returns (uint128) {
        return _calculateClaimable(_streams[streamId]);
    }

    function getStream(uint256 streamId) external view override returns (Stream memory) {
        StreamStorage storage s = _streams[streamId];
        return Stream({
            payer: s.payer,
            payee: s.payee,
            ratePerSecond: s.ratePerSecond,
            startTime: s.startTime,
            endTime: s.endTime,
            deposited: s.deposited,
            streamed: s.streamed,
            active: s.active
        });
    }

    function _calculateClaimable(StreamStorage storage stream) internal view returns (uint128) {
        if (!stream.active) return 0;

        uint32 currentTime = uint32(block.timestamp < stream.endTime
            ? block.timestamp
            : stream.endTime);

        uint128 totalStreamed = uint128(
            uint256(stream.ratePerSecond) * (currentTime - stream.startTime)
        );

        if (totalStreamed > stream.deposited) {
            totalStreamed = stream.deposited;
        }

        if (totalStreamed <= stream.streamed) return 0;

        return totalStreamed - stream.streamed;
    }
}
