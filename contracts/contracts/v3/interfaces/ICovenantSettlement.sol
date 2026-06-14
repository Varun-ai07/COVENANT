// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

interface ICovenantSettlement {
    event StreamCreated(uint256 indexed streamId, address indexed payer, address indexed payee, uint128 ratePerSecond, uint32 duration);
    event StreamWithdrawn(uint256 indexed streamId, address indexed payee, uint128 amount);
    event StreamCancelled(uint256 indexed streamId, uint128 refunded);
    event BatchSettled(uint256[] taskIds, uint128[] amounts);

    function createStream(
        address payee,
        uint128 ratePerSecond,
        uint32 duration,
        address token
    ) external payable returns (uint256 streamId);

    function withdrawStream(uint256 streamId) external;
    function cancelStream(uint256 streamId) external;
    function batchSettle(uint256[] calldata taskIds, uint128[] calldata amounts) external;
    function claimableAmount(uint256 streamId) external view returns (uint128);
    function getStream(uint256 streamId) external view returns (Stream memory);
    function streamCount() external view returns (uint256);

    struct Stream {
        address payer;
        address payee;
        uint128 ratePerSecond;
        uint32 startTime;
        uint32 endTime;
        uint128 deposited;
        uint128 streamed;
        bool active;
    }
}
