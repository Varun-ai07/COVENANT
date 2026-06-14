// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

interface ICovenantEscrow {
    event TaskCreated(uint256 indexed taskId, address indexed client, bytes32 metaHash);
    event TaskFunded(uint256 indexed taskId, uint128 amount);
    event TaskSubmitted(uint256 indexed taskId, address indexed worker, bytes32 deliverableHash);
    event TaskCompleted(uint256 indexed taskId, uint128 payout);
    event TaskFailed(uint256 indexed taskId, bytes32 reason);
    event TaskCancelled(uint256 indexed taskId);
    event TaskDisputed(uint256 indexed taskId, address indexed disputant);
    event BatchSettled(uint256 indexed settlementId, uint256 taskCount);

    function createTask(
        address worker,
        uint128 amount,
        uint32 deadline,
        bytes32 metaHash
    ) external payable returns (uint256 taskId);

    function fundTask(uint256 taskId) external payable;
    function submitWork(uint256 taskId, bytes32 deliverableHash) external;
    function completeTask(uint256 taskId, bytes calldata clientSignature) external;
    function failTask(uint256 taskId, bytes32 reason) external;
    function cancelTask(uint256 taskId) external;
    function disputeTask(uint256 taskId) external;
    function batchSettle(
        uint256[] calldata taskIds,
        uint128[] calldata amounts,
        bytes[] calldata signatures
    ) external;
    function getTask(uint256 taskId) external view returns (Task memory);
    function taskCount() external view returns (uint256);

    struct Task {
        address client;
        address worker;
        uint128 amount;
        uint32 deadline;
        uint8 status;
        uint8 disputeCount;
        bytes32 metaHash;
    }
}
