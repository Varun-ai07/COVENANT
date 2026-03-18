// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AgentRegistry.sol";
import "./ReceiptVerifier.sol";

contract TaskEscrow is Ownable {
    // Events
    event TaskCreated(
        uint256 indexed taskId,
        address indexed client,
        address indexed worker,
        uint256 payment,
        uint256 deadline
    );
    event TaskFunded(uint256 indexed taskId, uint256 amount);
    event TaskInProgress(uint256 indexed taskId);
    event WorkSubmitted(uint256 indexed taskId, string deliverableHash);
    event TaskCompleted(uint256 indexed taskId, uint256 workerPayment);
    event TaskFailed(uint256 indexed taskId, uint256 refundAmount);
    event TaskDisputed(uint256 indexed taskId, address disputedBy);
    event TaskResolved(
        uint256 indexed taskId,
        bool workerWins,
        uint256 amount
    );

    enum TaskStatus {
        Created,
        Funded,
        InProgress,
        Submitted,
        Completed,
        Failed,
        Disputed
    }

    struct Task {
        address client;
        address worker;
        uint256 payment;
        uint256 deadline;
        string descriptionHash; // IPFS hash of encrypted task description
        string deliverableHash; // IPFS hash of work deliverable
        TaskStatus status;
        uint256 createdAt;
        uint256 completedAt;
    }

    // Protocol fee: 1% (100 basis points)
    uint256 public constant PROTOCOL_FEE_BPS = 100;
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Reputation changes
    int256 public constant REPUTATION_SUCCESS = 10;
    int256 public constant REPUTATION_FAILURE = -50;

    // Storage
    mapping(uint256 => Task) public tasks;
    uint256 public taskCounter;

    // References to other contracts
    AgentRegistry public agentRegistry;
    ReceiptVerifier public receiptVerifier;

    // Protocol fee accumulator
    uint256 public accumulatedFees;

    constructor(address _agentRegistry, address _receiptVerifier) Ownable(msg.sender) {
        agentRegistry = AgentRegistry(_agentRegistry);
        receiptVerifier = ReceiptVerifier(_receiptVerifier);
    }

    modifier onlyClient(uint256 taskId) {
        require(tasks[taskId].client == msg.sender, "Not task client");
        _;
    }

    modifier onlyWorker(uint256 taskId) {
        require(tasks[taskId].worker == msg.sender, "Not task worker");
        _;
    }

    modifier onlyParticipant(uint256 taskId) {
        require(
            tasks[taskId].client == msg.sender || tasks[taskId].worker == msg.sender,
            "Not a participant"
        );
        _;
    }

    /**
     * @notice Create and fund a task in one transaction (recommended)
     */
    function createAndFundTask(
        address worker,
        uint256 payment,
        uint256 deadline,
        string calldata descriptionHash
    ) external payable returns (uint256) {
        require(payment > 0, "Payment must be positive");
        require(deadline > block.timestamp, "Deadline must be future");
        require(bytes(descriptionHash).length > 0, "Description required");
        require(msg.value >= payment, "Insufficient funding");

        // Verify both client and worker are registered agents
        AgentRegistry.Agent memory clientAgent = agentRegistry.getAgent(msg.sender);
        require(clientAgent.isActive, "Client not registered");

        AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(worker);
        require(workerAgent.isActive, "Worker not registered");
        require(workerAgent.reputation > 0, "Worker has no reputation");

        taskCounter++;

        tasks[taskCounter] = Task({
            client: msg.sender,
            worker: worker,
            payment: payment,
            deadline: deadline,
            descriptionHash: descriptionHash,
            deliverableHash: "",
            status: TaskStatus.InProgress, // Skip Created/Funded, go straight to InProgress
            createdAt: block.timestamp,
            completedAt: 0
        });

        emit TaskCreated(taskCounter, msg.sender, worker, payment, deadline);
        emit TaskFunded(taskCounter, msg.value);
        emit TaskInProgress(taskCounter);

        return taskCounter;
    }

    /**
     * @notice Create a new task with a specific worker (two-step: create then fund)
     */
    function createTask(
        address worker,
        uint256 payment,
        uint256 deadline,
        string calldata descriptionHash
    ) external returns (uint256) {
        require(payment > 0, "Payment must be positive");
        require(deadline > block.timestamp, "Deadline must be future");
        require(bytes(descriptionHash).length > 0, "Description required");

        // Verify both client and worker are registered agents
        AgentRegistry.Agent memory clientAgent = agentRegistry.getAgent(msg.sender);
        require(clientAgent.isActive, "Client not registered");

        AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(worker);
        require(workerAgent.isActive, "Worker not registered");
        require(workerAgent.reputation > 0, "Worker has no reputation");

        taskCounter++;

        tasks[taskCounter] = Task({
            client: msg.sender,
            worker: worker,
            payment: payment,
            deadline: deadline,
            descriptionHash: descriptionHash,
            deliverableHash: "",
            status: TaskStatus.Created,
            createdAt: block.timestamp,
            completedAt: 0
        });

        emit TaskCreated(taskCounter, msg.sender, worker, payment, deadline);

        return taskCounter;
    }

    /**
     * @notice Fund a created task (escrow the payment)
     */
    function fundTask(uint256 taskId) external payable onlyClient(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "Not in Created status");
        require(msg.value >= task.payment, "Insufficient funding");

        task.status = TaskStatus.Funded;

        emit TaskFunded(taskId, msg.value);

        // Automatically start the task
        task.status = TaskStatus.InProgress;
        emit TaskInProgress(taskId);
    }

    /**
     * @notice Submit work for a task
     * @param taskId The task ID
     * @param deliverableHash IPFS hash of the deliverable
     */
    function submitWork(
        uint256 taskId,
        string calldata deliverableHash
    ) external onlyWorker(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.InProgress, "Not in progress");
        require(block.timestamp <= task.deadline, "Deadline passed");
        require(bytes(deliverableHash).length > 0, "Deliverable required");

        task.deliverableHash = deliverableHash;
        task.status = TaskStatus.Submitted;

        emit WorkSubmitted(taskId, deliverableHash);
    }

    /**
     * @notice Client verifies submitted work
     * @param taskId The task ID
     * @param success Whether the work meets requirements
     */
    function verifyTask(uint256 taskId, bool success) external onlyClient(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Submitted, "Not submitted");

        if (success) {
            _completeTask(taskId);
        } else {
            _failTask(taskId);
        }
    }

    /**
     * @notice Dispute a task (freezes for resolution)
     */
    function disputeTask(uint256 taskId) external onlyParticipant(taskId) {
        Task storage task = tasks[taskId];
        require(
            task.status == TaskStatus.InProgress ||
            task.status == TaskStatus.Submitted,
            "Cannot dispute in current status"
        );

        task.status = TaskStatus.Disputed;
        emit TaskDisputed(taskId, msg.sender);
    }

    /**
     * @notice Resolve a disputed task (owner acts as arbitrator for MVP)
     */
    function resolveDispute(
        uint256 taskId,
        bool workerWins
    ) external onlyOwner {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Disputed, "Not disputed");

        if (workerWins) {
            // Worker did good work, full payment
            uint256 fee = (task.payment * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 workerPayment = task.payment - fee;

            accumulatedFees += fee;
            task.status = TaskStatus.Completed;
            task.completedAt = block.timestamp;

            (bool sent, ) = payable(task.worker).call{value: workerPayment}("");
            require(sent, "Payment failed");

            // Update reputation
            agentRegistry.updateReputation(task.worker, REPUTATION_SUCCESS);
            agentRegistry.recordTaskCompletion(task.worker, true, workerPayment);

            // Create receipt
            receiptVerifier.createReceipt(
                task.client,
                task.worker,
                "task_completion",
                keccak256(abi.encodePacked(taskId, task.deliverableHash))
            );

            emit TaskResolved(taskId, true, workerPayment);
        } else {
            // Worker failed, refund client (minus protocol fee)
            uint256 fee = (task.payment * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 refundAmount = task.payment - fee;

            accumulatedFees += fee;
            task.status = TaskStatus.Failed;
            task.completedAt = block.timestamp;

            (bool sent, ) = payable(task.client).call{value: refundAmount}("");
            require(sent, "Refund failed");

            // Penalize worker
            agentRegistry.updateReputation(task.worker, REPUTATION_FAILURE);
            agentRegistry.recordTaskCompletion(task.worker, false, 0);

            emit TaskResolved(taskId, false, refundAmount);
        }
    }

    /**
     * @notice Check if a task has passed its deadline
     */
    function checkDeadline(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(
            task.status == TaskStatus.InProgress ||
            task.status == TaskStatus.Submitted,
            "Cannot check deadline"
        );
        require(block.timestamp > task.deadline, "Deadline not passed");

        _failTask(taskId);
    }

    /**
     * @notice Get task details
     */
    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    /**
     * @notice Get tasks for a specific client
     */
    function getClientTasks(address client) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= taskCounter; i++) {
            if (tasks[i].client == client) {
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= taskCounter; i++) {
            if (tasks[i].client == client) {
                result[idx] = i;
                idx++;
            }
        }
        return result;
    }

    /**
     * @notice Get tasks for a specific worker
     */
    function getWorkerTasks(address worker) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= taskCounter; i++) {
            if (tasks[i].worker == worker) {
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= taskCounter; i++) {
            if (tasks[i].worker == worker) {
                result[idx] = i;
                idx++;
            }
        }
        return result;
    }

    /**
     * @notice Withdraw accumulated protocol fees
     */
    function withdrawFees() external onlyOwner {
        uint256 fees = accumulatedFees;
        accumulatedFees = 0;

        (bool sent, ) = owner().call{value: fees}("");
        require(sent, "Fee withdrawal failed");
    }

    // Internal functions

    function _completeTask(uint256 taskId) internal {
        Task storage task = tasks[taskId];

        // Calculate payment with protocol fee
        uint256 fee = (task.payment * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 workerPayment = task.payment - fee;

        accumulatedFees += fee;
        task.status = TaskStatus.Completed;
        task.completedAt = block.timestamp;

        // Pay worker
        (bool sent, ) = payable(task.worker).call{value: workerPayment}("");
        require(sent, "Payment failed");

        // Update reputation (+10 for success)
        agentRegistry.updateReputation(task.worker, REPUTATION_SUCCESS);
        agentRegistry.recordTaskCompletion(task.worker, true, workerPayment);

        // Create ERC-8004 receipt
        receiptVerifier.createReceipt(
            task.client,
            task.worker,
            "task_completion",
            keccak256(abi.encodePacked(taskId, task.deliverableHash))
        );

        emit TaskCompleted(taskId, workerPayment);
    }

    function _failTask(uint256 taskId) internal {
        Task storage task = tasks[taskId];

        // Refund client (minus protocol fee)
        uint256 fee = (task.payment * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 refundAmount = task.payment - fee;

        accumulatedFees += fee;
        task.status = TaskStatus.Failed;
        task.completedAt = block.timestamp;

        // Refund client
        (bool sent, ) = payable(task.client).call{value: refundAmount}("");
        require(sent, "Refund failed");

        // Penalize worker reputation (-50 for failure)
        agentRegistry.updateReputation(task.worker, REPUTATION_FAILURE);
        agentRegistry.recordTaskCompletion(task.worker, false, 0);

        // Slash 50% of worker's stake
        AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(task.worker);
        if (workerAgent.stakedAmount > 0) {
            uint256 slashAmount = workerAgent.stakedAmount / 2;
            if (slashAmount > 0) {
                agentRegistry.slashStake(task.worker, slashAmount);
            }
        }

        emit TaskFailed(taskId, refundAmount);
    }
}
