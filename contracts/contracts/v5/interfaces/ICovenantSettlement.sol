// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

interface ICovenantSettlement {
    event StreamCreated(uint256 indexed streamId, address indexed payer, address indexed payee, uint128 ratePerSecond, uint32 duration);
    event StreamWithdrawn(uint256 indexed streamId, address indexed payee, uint128 amount);
    event StreamCancelled(uint256 indexed streamId, uint128 refunded);
    event ReceiptSettled(uint256 indexed receiptId, address indexed payer, address indexed payee, uint128 amount);
    event BatchReceiptSettled(uint256 indexed batchId, uint256 receiptCount);

    function createStream(
        address payee,
        uint128 ratePerSecond,
        uint32 duration,
        address token
    ) external payable returns (uint256 streamId);

    function withdrawStream(uint256 streamId) external;
    function cancelStream(uint256 streamId) external;
    function settleReceipt(
        address payer,
        address payee,
        uint128 amount,
        uint256 nonce,
        bytes calldata payerSignature
    ) external payable returns (uint256 receiptId);
    function batchSettleReceipts(
        address[] calldata payers,
        address[] calldata payees,
        uint128[] calldata amounts,
        uint256[] calldata nonces,
        bytes[] calldata payerSignatures
    ) external returns (uint256 batchId);
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
