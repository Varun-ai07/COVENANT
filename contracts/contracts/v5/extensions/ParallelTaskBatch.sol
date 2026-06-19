// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../core/CovenantEscrow.sol";

/// @title ParallelTaskBatch V5 — Parallel multi-worker task execution
/// @notice Client splits work across workers, aggregates results
/// @dev Upgradeable, CEI-compliant, batch size limits
contract ParallelTaskBatch is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {

    enum BatchStatus { Created, InProgress, Aggregating, Completed, Failed }

    struct TaskBatch {
        address client;
        uint256 totalBudget;
        uint256[] taskIds;
        bytes32 aggregationSpec;
        BatchStatus status;
        uint256 createdAt;
        bytes32 aggregatedResultHash;
    }

    mapping(uint256 => TaskBatch) private _batches;
    uint256 public batchCounter;

    address public escrow;
    address public agentRegistry;
    uint256 public constant MAX_BATCH_SIZE = 50;

    event BatchCreated(uint256 indexed batchId, address indexed client, uint256 totalBudget);
    event BatchStatusUpdated(uint256 indexed batchId, BatchStatus newStatus);
    event ResultsAggregated(uint256 indexed batchId, bytes32 aggregatedResultHash);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    error ZeroPayment();
    error DeadlinePast();
    error EmptyDescriptionHash();
    error AgentNotActive(address agent);
    error WorkerHasNoReputation();
    error BatchLimitExceeded(uint256 max);
    error BatchLengthMismatch();
    error InvalidTaskId(uint256 taskId);
    error NotTaskClient();
    error BatchNotInProgress();
    error InvalidBatchStatus();
    error AlreadyAggregated();
    error InsufficientFunding(uint256 provided, uint256 required);
    error NotAllSubmitted();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(address _escrow, address _agentRegistry) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        escrow = _escrow;
        agentRegistry = _agentRegistry;
    }

    function createBatch(
        address[] calldata workers,
        uint256[] calldata payments,
        uint256[] calldata deadlines,
        bytes32[] calldata descriptionHashes,
        bytes32 aggregationSpec
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        uint256 len = workers.length;
        if (len == 0) revert ZeroPayment();
        if (len > MAX_BATCH_SIZE) revert BatchLimitExceeded(MAX_BATCH_SIZE);
        if (len != payments.length || len != deadlines.length || len != descriptionHashes.length) revert BatchLengthMismatch();
        if (aggregationSpec == bytes32(0)) revert EmptyDescriptionHash();

        batchCounter++;
        uint256 totalBudget;
        for (uint256 i = 0; i < len; i++) {
            totalBudget += payments[i];
        }

        if (msg.value < totalBudget) revert InsufficientFunding(msg.value, totalBudget);

        _batches[batchCounter] = TaskBatch({
            client: msg.sender,
            totalBudget: totalBudget,
            taskIds: new uint256[](len),
            aggregationSpec: aggregationSpec,
            status: BatchStatus.Created,
            createdAt: block.timestamp,
            aggregatedResultHash: bytes32(0)
        });

        // Refund excess
        if (msg.value > totalBudget) {
            (bool success, ) = msg.sender.call{value: msg.value - totalBudget}("");
            require(success, "refund failed");
        }

        emit BatchCreated(batchCounter, msg.sender, totalBudget);
        return batchCounter;
    }

    function aggregateResults(uint256 batchId) external nonReentrant {
        TaskBatch storage batch = _batches[batchId];
        if (batch.status != BatchStatus.InProgress) revert BatchNotInProgress();

        // Verify all subtasks submitted
        for (uint256 i = 0; i < batch.taskIds.length; i++) {
            // Read task from escrow
            bytes memory data = abi.encodeWithSignature("getTask(uint256)", batch.taskIds[i]);
            (bool success, bytes memory result) = escrow.staticcall(data);
            require(success, "failed to read task");
            (, , , , uint8 status, , ) = abi.decode(result, (address, address, uint128, uint32, uint8, uint8, bytes32));
            if (status != 2) revert NotAllSubmitted(); // 2 = Submitted
        }

        // CEI: State update before external calls
        batch.status = BatchStatus.Completed;
        batch.aggregatedResultHash = keccak256(abi.encodePacked(batchId, block.timestamp));

        emit ResultsAggregated(batchId, batch.aggregatedResultHash);
    }

    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        (bool success, ) = to.call{value: amount}("");
        require(success, "withdraw failed");
        emit EmergencyWithdraw(to, amount);
    }

    function getBatch(uint256 batchId) external view returns (TaskBatch memory) {
        return _batches[batchId];
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
