// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TaskEscrow.sol";

contract ParallelTaskBatch {
    error ZeroPayment();
    error DeadlinePast();
    error EmptyDescriptionHash();
    error AgentNotActive(address agent);
    error BatchLimitExceeded(uint256 max);
    error BatchLengthMismatch();
    error InvalidTaskId(uint256 taskId);
    error NotTaskClient();
    error InsufficientFunding(uint256 provided, uint256 required);

    event BatchCreated(
        uint256 indexed batchId,
        address indexed client,
        uint256[] taskIds,
        uint256 totalBudget
    );

    enum BatchStatus {
        Created,
        InProgress
    }

    struct TaskBatch {
        address client;
        uint256 totalBudget;
        uint256[] taskIds;
        bytes32 aggregationSpec;
        BatchStatus status;
        uint256 createdAt;
    }

    mapping(uint256 => TaskBatch) public batches;
    uint256 public batchCounter;

    TaskEscrow public immutable taskEscrow;
    AgentRegistry public immutable agentRegistry;

    constructor(address _taskEscrow, address _agentRegistry) {
        taskEscrow = TaskEscrow(_taskEscrow);
        agentRegistry = AgentRegistry(_agentRegistry);
    }

    modifier onlyClient(uint256 batchId) {
        if (batches[batchId].client != msg.sender) revert NotTaskClient();
        _;
    }

    modifier batchExists(uint256 batchId) {
        if (batchId == 0 || batchId > batchCounter) revert InvalidTaskId(batchId);
        _;
    }

    function createBatch(
        address[] calldata workers,
        uint256[] calldata payments,
        uint256[] calldata deadlines,
        bytes32[] calldata descriptionHashes,
        bytes32 aggregationSpec
    ) external payable returns (uint256) {
        uint256 len = workers.length;
        if (len == 0) revert ZeroPayment();
        if (len > 50) revert BatchLimitExceeded(50);
        if (len != payments.length) revert BatchLengthMismatch();
        if (len != deadlines.length) revert BatchLengthMismatch();
        if (len != descriptionHashes.length) revert BatchLengthMismatch();
        if (aggregationSpec == bytes32(0)) revert EmptyDescriptionHash();

        AgentRegistry.Agent memory clientAgent = agentRegistry.getAgent(msg.sender);
        if (clientAgent.isActive != 1) revert AgentNotActive(msg.sender);

        for (uint256 i = 0; i < len; i++) {
            AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(workers[i]);
            if (workerAgent.isActive != 1) revert AgentNotActive(workers[i]);
        }

        uint256 total = 0;
        uint256 totalWithFees = 0;
        unchecked {
            for (uint256 i = 0; i < len; ++i) {
                total += payments[i];
                uint256 fee = (payments[i] * 100) / 10000;
                totalWithFees += payments[i] + fee;
            }
        }
        if (msg.value != totalWithFees) revert InsufficientFunding(msg.value, totalWithFees);

        batchCounter++;

        batches[batchCounter] = TaskBatch({
            client: msg.sender,
            totalBudget: total,
            taskIds: new uint256[](0),
            aggregationSpec: aggregationSpec,
            status: BatchStatus.Created,
            createdAt: block.timestamp
        });

        uint256[] memory taskIds = new uint256[](len);
        unchecked {
            for (uint256 i = 0; i < len; ++i) {
                uint256 taskFee = (payments[i] * 100) / 10000;
                taskIds[i] = taskEscrow.createAndFundTaskForCollectiveWithPriority{value: payments[i] + taskFee}(
                    address(this),
                    workers[i],
                    uint96(payments[i]),
                    uint48(deadlines[i]),
                    string(abi.encodePacked(descriptionHashes[i])),
                    TaskEscrow.Priority.Medium
                );
            }
        }

        batches[batchCounter].taskIds = taskIds;
        batches[batchCounter].status = BatchStatus.InProgress;

        emit BatchCreated(batchCounter, msg.sender, taskIds, total);

        return batchCounter;
    }

    function getBatchStatus(uint256 batchId)
        external
        view
        batchExists(batchId)
        returns (BatchStatus)
    {
        return batches[batchId].status;
    }

    function getBatchDetails(uint256 batchId)
        external
        view
        batchExists(batchId)
        returns (
            address client,
            uint256 totalBudget,
            uint256[] memory taskIds,
            bytes32 aggregationSpec,
            BatchStatus status,
            uint256 createdAt
        )
    {
        TaskBatch storage batch = batches[batchId];
        return (
            batch.client,
            batch.totalBudget,
            batch.taskIds,
            batch.aggregationSpec,
            batch.status,
            batch.createdAt
        );
    }

    function getTaskIds(uint256 batchId)
        external
        view
        batchExists(batchId)
        returns (uint256[] memory)
    {
        return batches[batchId].taskIds;
    }
}
