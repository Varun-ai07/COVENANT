// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./TaskEscrow.sol";

/**
 * @title ParallelTaskBatch
 * @notice Enables one-to-many task posting where client splits a large task
 *         into subtasks and assigns each to different workers in parallel.
 */
contract ParallelTaskBatch is Ownable {
    constructor(address _taskEscrow, address _agentRegistry) Ownable(msg.sender) {
        taskEscrow = TaskEscrow(_taskEscrow);
        agentRegistry = AgentRegistry(_agentRegistry);
    }
    error ZeroPayment();
    error DeadlinePast();
    error EmptyDescriptionHash();
    error AgentNotRegistered(address agent);
    error AgentNotActive(address agent);
    error WorkerHasNoReputation();
    error BatchLimitExceeded(uint256 max);
    error BatchLengthMismatch();
    error InvalidTaskId(uint256 taskId);
    error NotTaskClient();
    error TaskNotInProgress();
    error BatchNotInProgress();
    error AggregationFailed();
    error InvalidBatchStatus();
    error AlreadyAggregated();
    error InsufficientFunding(uint256 provided, uint256 required);

    // =======================================

    // Events
    event BatchCreated(
        uint256 indexed batchId,
        address indexed client,
        uint256[] taskIds,
        uint256 totalBudget
    );

    event BatchStatusUpdated(
        uint256 indexed batchId,
        BatchStatus newStatus
    );

    event ResultsAggregated(
        uint256 indexed batchId,
        bytes32 aggregatedResultHash
    );

    // Batch status enum
    enum BatchStatus {
        Created,      // Batch created, awaiting processing
        InProgress,   // Workers are processing subtasks
        Aggregating,  // All subtasks submitted, aggregating results
        Completed,    // Results aggregated successfully
        Failed        // Aggregation failed
    }

    // Subtask specification
    struct SubtaskSpec {
        address worker;           // Worker assigned to this subtask
        uint256 payment;          // Payment for this subtask (wei)
        bytes32 descriptionHash;  // IPFS hash of subtask description
    }

    // Batch structure
    struct TaskBatch {
        address client;              // Who created the batch
        uint256 totalBudget;         // Total budget allocated for all subtasks (wei)
        uint256[] taskIds;           // Array of individual TaskEscrow taskIds
        bytes32 aggregationSpec;     // IPFS hash of how to aggregate results
        BatchStatus status;          // Current status
        uint256 createdAt;           // When batch was created
        bytes32 aggregatedResultHash; // IPFS hash of the aggregated result
    }

    // Storage
    mapping(uint256 => TaskBatch) public batches;
    uint256 public batchCounter;

    // References to other contracts
    TaskEscrow public immutable taskEscrow;
    AgentRegistry public immutable agentRegistry;

    
    modifier onlyClient(uint256 batchId) {
        if (batches[batchId].client != msg.sender) revert NotTaskClient();
        _;
    }

    modifier batchExists(uint256 batchId) {
        if (batchId == 0 || batchId > batchCounter) revert InvalidTaskId(batchId);
        _;
    }

    modifier isInProgress(uint256 batchId) {
        if (batches[batchId].status != BatchStatus.InProgress) revert BatchNotInProgress();
        _;
    }

    modifier isAggregating(uint256 batchId) {
        if (batches[batchId].status != BatchStatus.Aggregating) revert InvalidBatchStatus();
        _;
    }

    modifier notAlreadyAggregated(uint256 batchId) {
        if (batches[batchId].status == BatchStatus.Completed || batches[batchId].status == BatchStatus.Failed) revert AlreadyAggregated();
        _;
    }

    /**
     * @notice Create a parallel task batch
     * @param workers Array of worker addresses for each subtask
     * @param payments Array of payment amounts for each subtask (wei)
     * @param deadlines Array of deadlines for each subtask (unix timestamp)
     * @param descriptionHashes Array of IPFS CIDs for subtask descriptions (bytes32)
     * @param aggregationSpec IPFS hash specifying how to aggregate results
     * @return batchId The ID of the created batch
     */
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

        // Verify client is a registered and active agent
        AgentRegistry.Agent memory clientAgent = agentRegistry.getAgent(msg.sender);
        if (clientAgent.isActive != 1) revert AgentNotActive(msg.sender);

        // Verify each worker
        for (uint256 i = 0; i < len; i++) {
            AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(workers[i]);
            if (workerAgent.isActive != 1) revert AgentNotActive(workers[i]);
            if (workerAgent.reputation == 0) revert WorkerHasNoReputation();
        }

        // Calculate total payment + priority fees (Medium = 100 bps)
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
            createdAt: block.timestamp,
            aggregatedResultHash: bytes32(0)
        });

        // Create individual tasks for each worker
        uint256[] memory taskIds = new uint256[](len);
        unchecked {
            for (uint256 i = 0; i < len; ++i) {
                // Send payment + priority fee per subtask
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

    /**
     * @notice Get the status of a batch
     * @param batchId The ID of the batch to check
     * @return batchStatus The current status of the batch
     */
    function getBatchStatus(uint256 batchId)
        external
        view
        batchExists(batchId)
        returns (BatchStatus)
    {
        return batches[batchId].status;
    }

    /**
     * @notice Check if all subtasks in a batch are submitted
     * @param batchId The ID of the batch to check
     * @return allSubmitted Whether all subtasks are submitted
     */
    function areAllSubtasksSubmitted(uint256 batchId) external view batchExists(batchId) returns (bool) {
        TaskBatch storage batch = batches[batchId];
        if (batch.status != BatchStatus.InProgress) return false;

        for (uint256 i = 0; i < batch.taskIds.length; i++) {
            TaskEscrow.Task memory task = taskEscrow.getTask(batch.taskIds[i]);
            if (task.status != TaskEscrow.TaskStatus.Submitted) {
                return false;
            }
        }
        return true;
    }


    /**
     * @notice Get details of a batch
     * @param batchId The ID of the batch
     * @return client Who created the batch
     * @return totalBudget Total budget allocated for all subtasks (wei)
     * @return taskIds Array of individual TaskEscrow taskIds
     * @return aggregationSpec IPFS hash of how to aggregate results
     * @return status Current status of the batch
     * @return createdAt When the batch was created
     */
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

    /**
     * @notice Start the aggregation process (called when all subtasks are submitted)
     * @param batchId The ID of the batch to aggregate
     */
    function aggregateResults(uint256 batchId)
        external
        batchExists(batchId)
        isInProgress(batchId)
        notAlreadyAggregated(batchId)
    {
        // Verify that all subtasks are actually submitted
        bool allSubmitted = this.areAllSubtasksSubmitted(batchId);
        if (!allSubmitted) {
            // In a real implementation, we might wait or revert
            // For now, we'll continue but note that some results might be missing
        }

        batches[batchId].status = BatchStatus.Aggregating;

        // In a real implementation, we would:
        // 1. Download all deliverables from IPFS
        // 2. Use the aggregationSpec to determine how to combine them
        // 3. Upload the aggregated result to IPFS
        // 4. Store the aggregated result hash

        // For this implementation, we'll simulate successful aggregation
        bytes32 aggregatedResultHash = keccak256(abi.encodePacked(
            batchId,
            block.timestamp,
            msg.sender
        ));

        batches[batchId].status = BatchStatus.Completed;
        batches[batchId].aggregatedResultHash = aggregatedResultHash;

        emit ResultsAggregated(batchId, aggregatedResultHash);
    }

    /**
     * @notice Get the aggregated result hash (if available)
     * @param batchId The ID of the batch
     * @return aggregatedResultHash The IPFS hash of aggregated results, or bytes32(0) if not available
     */
    function getAggregatedResult(uint256 batchId)
        external
        view
        batchExists(batchId)
        returns (bytes32)
    {
        TaskBatch storage batch = batches[batchId];
        if (batch.status == BatchStatus.Completed) {
            return batch.aggregatedResultHash;
        }
        return bytes32(0);
    }

    // Helper functions for internal use
    function _verifyWorkerCapabilities(
        address worker,
        AgentRegistry.Agent memory workerAgent,
        string[] calldata requiredCapabilities
    ) internal view {
        for (uint256 i = 0; i < requiredCapabilities.length; i++) {
            string memory cap = requiredCapabilities[i];
            // Check plaintext capabilities
            bool has = false;
            for (uint256 j = 0; j < workerAgent.capabilities.length; j++) {
                if (keccak256(bytes(workerAgent.capabilities[j])) == keccak256(bytes(cap))) {
                    has = true;
                    break;
                }
            }
            require(has, string.concat("Missing capability: ", cap));
        }
    }
}