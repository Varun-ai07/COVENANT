// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

interface ICovenantArbitration {
    event DisputeCreated(uint256 indexed disputeId, uint256 indexed taskId, address indexed disputant);
    event DisputeStaked(uint256 indexed disputeId, address indexed staker, uint96 amount);
    event DisputeRuled(uint256 indexed disputeId, uint8 ruling, uint8 splitBps);
    event DisputeSettled(uint256 indexed disputeId, address clientPayout, address workerPayout, uint128 clientAmount, uint128 workerAmount);

    function createDispute(uint256 taskId, bytes32 evidenceHash) external;
    function stakeForDispute(uint256 disputeId) external payable;
    function submitRuling(
        uint256 disputeId,
        uint8 ruling,
        uint8 splitBps,
        bytes calldata arbiterSignature
    ) external;
    function settleDispute(uint256 disputeId) external;
    function getDispute(uint256 disputeId) external view returns (Dispute memory);
    function disputeCount() external view returns (uint256);

    struct Dispute {
        uint256 taskId;
        address disputant;
        uint8 ruling;
        uint8 splitBps;
        uint32 createdAt;
        bytes32 evidenceHash;
        uint96 clientStake;
        uint96 workerStake;
        bool settled;
    }
}
