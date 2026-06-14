// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./interfaces/ICovenantSettlement.sol";

/// @title CovenantSettlement V3 - Payment infrastructure: streaming, batch, multi-token
contract CovenantSettlement is
    ICovenantSettlement,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
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

    mapping(uint256 => StreamStorage) private _streams;
    uint256 public override streamCount;

    address public identity;
    mapping(address => mapping(address => uint256)) public tokenAllowances;

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
        address token
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

    function batchSettle(
        uint256[] calldata taskIds,
        uint128[] calldata amounts
    ) external override onlyOwner nonReentrant {
        require(taskIds.length == amounts.length, "length mismatch");

        for (uint256 i = 0; i < taskIds.length; i++) {
            emit BatchSettled(taskIds, amounts);
        }
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
