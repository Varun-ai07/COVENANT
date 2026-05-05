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

    // ============ ENHANCEMENT: Priority Queue ============
    enum Priority {
        Low,
        Medium,
        High,
        Urgent
    }

    uint256 public constant PRIORITY_FEE_BPS_LOW = 50;     // 0.5%
    uint256 public constant PRIORITY_FEE_BPS_MEDIUM = 100; // 1%
    uint256 public constant PRIORITY_FEE_BPS_HIGH = 200;   // 2%
    uint256 public constant PRIORITY_FEE_BPS_URGENT = 500; // 5%

    function getPriorityFeeBps(Priority priority) public pure returns (uint256) {
        if (priority == Priority.Low) return PRIORITY_FEE_BPS_LOW;
        if (priority == Priority.Medium) return PRIORITY_FEE_BPS_MEDIUM;
        if (priority == Priority.High) return PRIORITY_FEE_BPS_HIGH;
        return PRIORITY_FEE_BPS_URGENT;
    }

    // ============ ENHANCEMENT: Milestones ============
    struct Milestone {
        string descriptionHash;
        uint256 paymentAmount;
        bool completed;
        bool paid;
        string deliverableHash;
        uint256 submittedAt;
    }

    event MilestoneCompleted(uint256 indexed taskId, uint256 milestoneIndex);
    event MilestonePaid(uint256 indexed taskId, uint256 milestoneIndex, uint256 amount);
    event TaskWithMilestonesCreated(
        uint256 indexed taskId,
        address indexed client,
        address indexed worker,
        uint256 totalPayment,
        uint256 milestoneCount
    );

    // ============ ENHANCEMENT: Batch Verification ============
    event BatchVerified(
        address indexed verifier,
        uint256 taskCount,
        uint256 successCount,
        uint256 failureCount
    );

    // ====================================================

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
        // Enhancement: Priority
        Priority priority;
        // Enhancement: Milestones (index 0 = no milestones)
        Milestone[] milestones;
        bool usesMilestones;
        // Enhancement: Hierarchical Subtasking
        uint256 parentTaskId; // 0 = top-level task
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
    // Mapping from parent task ID to array of child task IDs
    mapping(uint256 => uint256[]) public childTasks;

    // References to other contracts
    AgentRegistry public agentRegistry;
    ReceiptVerifier public receiptVerifier;

    // Protocol fee accumulator
    uint256 public accumulatedFees;

    // Verifier tracking (for economic incentives)
    mapping(address => uint256) public verifierStakes; // address => stake amount in wei
    mapping(address => bool) public isRegisteredVerifier;
    uint256 public totalVerifierStake;

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
        return createAndFundTaskWithPriority(worker, payment, deadline, descriptionHash, Priority.Medium);
    }

    /**
     * @notice Create and fund a task with a specific priority level
     */
    function createAndFundTaskWithPriority(
        address worker,
        uint256 payment,
        uint256 deadline,
        string calldata descriptionHash,
        Priority priority
    ) public payable returns (uint256) {
        require(payment > 0, "Payment must be positive");
        require(deadline > block.timestamp, "Deadline must be future");
        require(bytes(descriptionHash).length > 0, "Description required");

        // Calculate priority fee
        uint256 priorityFee = (payment * getPriorityFeeBps(priority)) / BPS_DENOMINATOR;
        uint256 requiredTotal = payment + priorityFee;
        require(msg.value >= requiredTotal, "Insufficient funding");

        // Verify both client and worker are registered agents
        AgentRegistry.Agent memory clientAgent = agentRegistry.getAgent(msg.sender);
        require(clientAgent.isActive == 1, "Client not registered");

        AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(worker);
        require(workerAgent.isActive == 1, "Worker not registered");
        require(workerAgent.reputation > 0, "Worker has no reputation");

        taskCounter++;

        Task storage task = tasks[taskCounter];
        task.client = msg.sender;
        task.worker = worker;
        task.payment = payment;
        task.deadline = deadline;
        task.descriptionHash = descriptionHash;
        task.deliverableHash = "";
        task.status = TaskStatus.InProgress;
        task.createdAt = block.timestamp;
        task.completedAt = 0;
        task.priority = priority;
        task.usesMilestones = false;
        task.parentTaskId = 0;

        // Accumulate priority fee as protocol fee
        accumulatedFees += priorityFee;

        emit TaskCreated(taskCounter, msg.sender, worker, payment, deadline);
        emit TaskFunded(taskCounter, msg.value);
        emit TaskInProgress(taskCounter);

        return taskCounter;
    }

    /**
     * @notice Create and fund a task for a collective (skips client check since collective is not a registered agent)
     */
    function createAndFundTaskForCollective(
        address client,
        address worker,
        uint256 payment,
        uint256 deadline,
        string calldata descriptionHash
    ) external payable returns (uint256) {
        return createAndFundTaskForCollectiveWithPriority(
            client, worker, payment, deadline, descriptionHash, Priority.Medium
        );
    }

    function createAndFundTaskForCollectiveWithPriority(
        address client,
        address worker,
        uint256 payment,
        uint256 deadline,
        string calldata descriptionHash,
        Priority priority
    ) public payable returns (uint256) {
        require(payment > 0, "Payment must be positive");
        require(deadline > block.timestamp, "Deadline must be future");
        require(bytes(descriptionHash).length > 0, "Description required");
        require(client != address(0), "Invalid client address");

        uint256 priorityFee = (payment * getPriorityFeeBps(priority)) / BPS_DENOMINATOR;
        uint256 requiredTotal = payment + priorityFee;
        require(msg.value >= requiredTotal, "Insufficient funding");

        // Only verify the worker is a registered agent (skip client check for collectives)
        AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(worker);
        require(workerAgent.isActive == 1, "Worker not registered");
        require(workerAgent.reputation > 0, "Worker has no reputation");

        taskCounter++;

        Task storage task = tasks[taskCounter];
        task.client = client;
        task.worker = worker;
        task.payment = payment;
        task.deadline = deadline;
        task.descriptionHash = descriptionHash;
        task.deliverableHash = "";
        task.status = TaskStatus.InProgress;
        task.createdAt = block.timestamp;
        task.completedAt = 0;
        task.priority = priority;
        task.usesMilestones = false;
        task.parentTaskId = 0;

        accumulatedFees += priorityFee;

        emit TaskCreated(taskCounter, client, worker, payment, deadline);
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
        require(clientAgent.isActive == 1, "Client not registered");

        AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(worker);
        require(workerAgent.isActive == 1, "Worker not registered");
        require(workerAgent.reputation > 0, "Worker has no reputation");

        taskCounter++;

        Task storage task = tasks[taskCounter];
        task.client = msg.sender;
        task.worker = worker;
        task.payment = payment;
        task.deadline = deadline;
        task.descriptionHash = descriptionHash;
        task.deliverableHash = "";
        task.status = TaskStatus.Created;
        task.createdAt = block.timestamp;
        task.completedAt = 0;
        task.priority = Priority.Medium;
        task.usesMilestones = false;
        task.parentTaskId = 0;

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

    // ==========================================================
    // ENHANCEMENT: Task with Milestones
    // ==========================================================

    /**
     * @notice Create a task with milestones (partial payments on checkpoint completion)
     * @param worker Worker address
     * @param totalPayment Total payment across all milestones
     * @param deadline Final deadline for all milestones
     * @param descriptionHash Task description
     * @param milestoneDescriptions IPFS hashes for each milestone description
     * @param milestonePayments Payment amounts for each milestone (must sum to totalPayment)
     */
    function createTaskWithMilestones(
        address worker,
        uint256 totalPayment,
        uint256 deadline,
        string calldata descriptionHash,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestonePayments
    ) external payable returns (uint256) {
        require(milestoneDescriptions.length > 0, "At least one milestone required");
        require(milestoneDescriptions.length == milestonePayments.length, "Milestone length mismatch");
        require(totalPayment > 0, "Payment must be positive");
        require(deadline > block.timestamp, "Deadline must be future");
        require(bytes(descriptionHash).length > 0, "Description required");

        // Verify milestone payments sum to total
        uint256 milestoneSum = 0;
        for (uint256 i = 0; i < milestonePayments.length; i++) {
            milestoneSum += milestonePayments[i];
        }
        require(milestoneSum == totalPayment, "Milestone payments must sum to total");

        // Verify both client and worker are registered agents
        AgentRegistry.Agent memory clientAgent = agentRegistry.getAgent(msg.sender);
        require(clientAgent.isActive == 1, "Client not registered");

        AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(worker);
        require(workerAgent.isActive == 1, "Worker not registered");
        require(workerAgent.reputation > 0, "Worker has no reputation");

        require(msg.value >= totalPayment, "Insufficient funding");

        taskCounter++;

        Task storage task = tasks[taskCounter];
        task.client = msg.sender;
        task.worker = worker;
        task.payment = totalPayment;
        task.deadline = deadline;
        task.descriptionHash = descriptionHash;
        task.deliverableHash = "";
        task.status = TaskStatus.InProgress;
        task.createdAt = block.timestamp;
        task.completedAt = 0;
        task.priority = Priority.Medium;
        task.usesMilestones = true;
        task.parentTaskId = 0;

        for (uint256 i = 0; i < milestoneDescriptions.length; i++) {
            task.milestones.push(Milestone({
                descriptionHash: milestoneDescriptions[i],
                paymentAmount: milestonePayments[i],
                completed: false,
                paid: false,
                deliverableHash: "",
                submittedAt: 0
            }));
        }

        emit TaskCreated(taskCounter, msg.sender, worker, totalPayment, deadline);
        emit TaskFunded(taskCounter, msg.value);
        emit TaskInProgress(taskCounter);
        emit TaskWithMilestonesCreated(taskCounter, msg.sender, worker, totalPayment, milestoneDescriptions.length);

        return taskCounter;
    }

    /**
     * @notice Worker submits deliverable for a specific milestone
     * @param taskId Task ID
     * @param milestoneIndex Index of the milestone (0-based)
     * @param deliverableHash IPFS hash of the milestone deliverable
     */
    function submitMilestone(
        uint256 taskId,
        uint256 milestoneIndex,
        string calldata deliverableHash
    ) external onlyWorker(taskId) {
        Task storage task = tasks[taskId];
        require(task.usesMilestones, "Task does not use milestones");
        require(milestoneIndex < task.milestones.length, "Invalid milestone index");
        require(task.status == TaskStatus.InProgress, "Not in progress");
        require(!task.milestones[milestoneIndex].completed, "Milestone already completed");
        require(block.timestamp <= task.deadline, "Deadline passed");

        // Auto-complete previous milestones if not already submitted
        for (uint256 i = 0; i < milestoneIndex; i++) {
            require(task.milestones[i].completed, "Previous milestone not completed");
        }

        task.milestones[milestoneIndex].deliverableHash = deliverableHash;
        task.milestones[milestoneIndex].completed = true;
        task.milestones[milestoneIndex].submittedAt = block.timestamp;

        emit MilestoneCompleted(taskId, milestoneIndex);
        emit WorkSubmitted(taskId, deliverableHash);
    }

    /**
     * @notice Client verifies and pays for a milestone
     * @param taskId Task ID
     * @param milestoneIndex Index of the milestone
     * @param success Whether the milestone work is accepted
     */
    function verifyMilestone(
        uint256 taskId,
        uint256 milestoneIndex,
        bool success
    ) external onlyClient(taskId) {
        Task storage task = tasks[taskId];
        require(task.usesMilestones, "Task does not use milestones");
        require(milestoneIndex < task.milestones.length, "Invalid milestone index");
        require(task.milestones[milestoneIndex].completed, "Milestone not completed");
        require(!task.milestones[milestoneIndex].paid, "Milestone already paid");

        Milestone storage ms = task.milestones[milestoneIndex];

        if (success) {
            uint256 fee = (ms.paymentAmount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 milestonePayment = ms.paymentAmount - fee;
            accumulatedFees += fee;

            (bool sent, ) = payable(task.worker).call{value: milestonePayment}("");
            require(sent, "Payment failed");

            ms.paid = true;

            emit MilestonePaid(taskId, milestoneIndex, milestonePayment);

            // Check if all milestones are paid — complete the task
            bool allPaid = true;
            for (uint256 i = 0; i < task.milestones.length; i++) {
                if (!task.milestones[i].paid) {
                    allPaid = false;
                    break;
                }
            }
            if (allPaid) {
                task.status = TaskStatus.Completed;
                task.completedAt = block.timestamp;
                agentRegistry.updateReputation(task.worker, REPUTATION_SUCCESS);
                agentRegistry.recordTaskCompletion(task.worker, true, task.payment);

                receiptVerifier.createReceipt(
                    task.client,
                    task.worker,
                    "task_completion",
                    keccak256(abi.encodePacked(taskId))
                );

                emit TaskCompleted(taskId, task.payment);
            }
        } else {
            // Mark milestone as failed — task goes to failed state
            task.status = TaskStatus.Failed;
            task.completedAt = block.timestamp;

            // Refund remaining unpaid milestones to client
            uint256 refundTotal = 0;
            for (uint256 i = milestoneIndex; i < task.milestones.length; i++) {
                if (!task.milestones[i].paid) {
                    refundTotal += task.milestones[i].paymentAmount;
                }
            }

            if (refundTotal > 0) {
                uint256 fee = (refundTotal * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
                uint256 refund = refundTotal - fee;
                accumulatedFees += fee;
                (bool sent, ) = payable(task.client).call{value: refund}("");
                require(sent, "Refund failed");
            }

            agentRegistry.updateReputation(task.worker, REPUTATION_FAILURE);
            agentRegistry.recordTaskCompletion(task.worker, false, 0);

            emit TaskFailed(taskId, refundTotal);
        }
    }

    // ==========================================================
    // ENHANCEMENT: Hierarchical Subtasking
    // ==========================================================

    event SubtaskCreated(
        uint256 indexed parentTaskId,
        uint256 indexed subtaskId,
        address client,
        address worker
    );

    /**
     * @notice Create a subtask linked to a parent task
     * @param parentTaskId The parent task ID
     * @param worker Worker address for the subtask
     * @param payment Payment amount for the subtask
     * @param deadline Deadline for the subtask
     * @param descriptionHash IPFS hash of the subtask description
     */
    function createSubtask(
        uint256 parentTaskId,
        address worker,
        uint256 payment,
        uint256 deadline,
        string calldata descriptionHash
    ) external payable returns (uint256) {
        // Parent task must exist
        Task storage parentTask = tasks[parentTaskId];
        require(parentTask.client != address(0), "Parent task does not exist");

        // Caller must be either the client or worker of the parent task
        require(
            msg.sender == parentTask.client || msg.sender == parentTask.worker,
            "Not authorized to create subtask"
        );

        // Subtask payment must be positive
        require(payment > 0, "Payment must be positive");
        require(deadline > block.timestamp, "Deadline must be future");
        require(bytes(descriptionHash).length > 0, "Description required");

        // Verify worker is a registered agent
        AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(worker);
        require(workerAgent.isActive == 1, "Worker not registered");
        require(workerAgent.reputation > 0, "Worker has no reputation");

        // Medium priority fee for subtask
        uint256 priorityFee = (payment * getPriorityFeeBps(Priority.Medium)) / BPS_DENOMINATOR;
        uint256 requiredTotal = payment + priorityFee;
        require(msg.value >= requiredTotal, "Insufficient funding");

        taskCounter++;

        Task storage subtask = tasks[taskCounter];
        subtask.client = msg.sender; // Subtask creator (client or worker of parent)
        subtask.worker = worker;
        subtask.payment = payment;
        subtask.deadline = deadline;
        subtask.descriptionHash = descriptionHash;
        subtask.deliverableHash = "";
        subtask.status = TaskStatus.InProgress;
        subtask.createdAt = block.timestamp;
        subtask.completedAt = 0;
        subtask.priority = Priority.Medium;
        subtask.usesMilestones = false;
        subtask.parentTaskId = parentTaskId;

        // Link subtask to parent
        childTasks[parentTaskId].push(taskCounter);

        // Accumulate priority fee
        accumulatedFees += priorityFee;

        emit TaskCreated(taskCounter, msg.sender, worker, payment, deadline);
        emit TaskFunded(taskCounter, msg.value);
        emit TaskInProgress(taskCounter);
        emit SubtaskCreated(parentTaskId, taskCounter, msg.sender, worker);
    }

    /**
     * @notice Get child task IDs for a given parent task
     */
    function getChildTasks(uint256 parentTaskId) external view returns (uint256[] memory) {
        return childTasks[parentTaskId];
    }

    // ==========================================================

    /**
     * @notice Get milestone details
     */
    function getMilestone(uint256 taskId, uint256 milestoneIndex) external view returns (
        string memory descriptionHash,
        uint256 paymentAmount,
        bool completed,
        bool paid,
        string memory deliverableHash,
        uint256 submittedAt
    ) {
        Task storage task = tasks[taskId];
        require(milestoneIndex < task.milestones.length, "Invalid milestone index");
        Milestone storage ms = task.milestones[milestoneIndex];
        return (
            ms.descriptionHash,
            ms.paymentAmount,
            ms.completed,
            ms.paid,
            ms.deliverableHash,
            ms.submittedAt
        );
    }

    /**
     * @notice Get milestone count for a task
     */
    function getMilestoneCount(uint256 taskId) external view returns (uint256) {
        return tasks[taskId].milestones.length;
    }

    // ==========================================================
    // ENHANCEMENT: Batch Verification
    // ==========================================================

    /**
     * @notice Verify multiple tasks at once (batch verification)
     * @param taskIds Array of task IDs to verify
     * @param results Array of verification results (true = success, false = failure)
     * @return successCount Number of successfully completed tasks
     * @return failureCount Number of failed tasks
     */
    function verifyBatch(
        uint256[] calldata taskIds,
        bool[] calldata results
    ) external returns (uint256 successCount, uint256 failureCount) {
        require(taskIds.length > 0, "No tasks to verify");
        require(taskIds.length == results.length, "Task/result length mismatch");

        for (uint256 i = 0; i < taskIds.length; i++) {
            uint256 taskId = taskIds[i];
            require(tasks[taskId].status == TaskStatus.Submitted, "Task not submitted");
            require(tasks[taskId].client == msg.sender, "Not task client");

            if (results[i]) {
                _completeTask(taskId);
                successCount++;
            } else {
                _failTask(taskId);
                failureCount++;
            }
        }

        emit BatchVerified(msg.sender, taskIds.length, successCount, failureCount);
    }

    // ==========================================================

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

        if (task.usesMilestones) {
            // For milestone tasks, submitWork submits the final deliverable
            // Individual milestones use submitMilestone instead
            revert("Milestone tasks must use verifyMilestone");
        }

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
        require(!task.usesMilestones, "Milestone tasks must use verifyMilestone");

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
            // If milestone task, pay all unpaid milestones
            if (task.usesMilestones && task.milestones.length > 0) {
                uint256 totalPaid = 0;
                for (uint256 i = 0; i < task.milestones.length; i++) {
                    if (!task.milestones[i].paid) {
                        uint256 fee = (task.milestones[i].paymentAmount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
                        uint256 milestonePayment = task.milestones[i].paymentAmount - fee;
                        accumulatedFees += fee;
                        (bool sent, ) = payable(task.worker).call{value: milestonePayment}("");
                        require(sent, "Payment failed");
                        task.milestones[i].paid = true;
                        totalPaid += milestonePayment;
                    }
                }
                task.status = TaskStatus.Completed;
                emit TaskCompleted(taskId, totalPaid);
            } else {
                // Worker did good work, full payment
                uint256 fee = (task.payment * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
                uint256 workerPayment = task.payment - fee;

                accumulatedFees += fee;
                task.status = TaskStatus.Completed;
                task.completedAt = block.timestamp;

                (bool sent, ) = payable(task.worker).call{value: workerPayment}("");
                require(sent, "Payment failed");

                emit TaskResolved(taskId, true, workerPayment);
            }

            // Update reputation
            agentRegistry.updateReputation(task.worker, REPUTATION_SUCCESS);
            agentRegistry.recordTaskCompletion(task.worker, true, task.payment);

            // Create receipt
            receiptVerifier.createReceipt(
                task.client,
                task.worker,
                "task_completion",
                keccak256(abi.encodePacked(taskId, task.deliverableHash))
            );
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
     * @notice Get task priority
     */
    function getTaskPriority(uint256 taskId) external view returns (Priority) {
        return tasks[taskId].priority;
    }

    /**
     * @notice Check if task uses milestones
     */
    function isMilestoneTask(uint256 taskId) external view returns (bool) {
        return tasks[taskId].usesMilestones;
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

    // ==========================================================
    // VERIFIER ENHANCEMENTS (Optimistic Verification)
    // ==========================================================

    /**
     * @notice Get all tasks in Submitted status (ready for verification)
     * @return taskIds Array of task IDs that are submitted and awaiting verification
     */
    function getSubmittedTasks() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= taskCounter; i++) {
            if (tasks[i].status == TaskStatus.Submitted) {
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= taskCounter; i++) {
            if (tasks[i].status == TaskStatus.Submitted) {
                result[idx] = i;
                idx++;
            }
        }
        return result;
    }

    /**
     * @notice Register as a verifier by staking ETH as a bond
     * Verifiers can lose their stake if they submit false verifications that are successfully challenged
     */
    function registerVerifier() external payable {
        require(msg.value >= 0.01 ether, "Minimum stake of 0.01 ETH required");
        verifierStakes[msg.sender] += msg.value;
        isRegisteredVerifier[msg.sender] = true;
        totalVerifierStake += msg.value;
    }

    /**
     * @notice Create a verification receipt for record-keeping and dispute resolution
     * @param taskId The ID of the task that was verified
     * @param success Whether the verification determined the work was successful
     * @param score Numerical score from 0-100 indicating work quality
     * @param feedback Textual feedback about the work
     */
    function createVerificationReceipt(
        uint256 taskId,
        bool success,
        uint256 score,
        string calldata feedback
    ) external {
        require(tasks[taskId].status == TaskStatus.Completed || tasks[taskId].status == TaskStatus.Failed, 
                "Task must be completed or failed to create verification receipt");
        require(msg.sender == tasks[taskId].client || msg.sender == tasks[taskId].worker,
                "Only task participants can create verification receipts");
        
        // In a full implementation, we would store this receipt on-chain or in IPFS
        // For now, we emit an event for off-chain indexing
        emit VerificationReceiptCreated(taskId, msg.sender, success, score, feedback);
    }

    // ==========================================================
    // VERIFIER CHALLENGE SYSTEM (Optimistic Verification)
    // ==========================================================

    /**
     * @notice Stake ETH on a verification decision to earn rewards or risk slashing
     * @param taskId The ID of the task being verified
     * @param verifierDecision The verifier's decision (true = work acceptable, false = work unacceptable)
     */
    function stakeOnVerification(
        uint256 taskId,
        bool verifierDecision
    ) external payable {
        require(tasks[taskId].status == TaskStatus.Completed || tasks[taskId].status == TaskStatus.Failed, 
                "Can only stake on completed or failed tasks");
        require(msg.value >= 0.001 ether, "Minimum stake of 0.001 ETH required");
        
        // Record the verifier's stake and decision
        // In a full implementation, we would have a more complex tracking system
        // For now, we rely on the challenge mechanism and social consensus
        
        emit VerifierStaked(taskId, msg.sender, msg.value, verifierDecision);
    }

    /**
     * @notice Challenge a verifier's decision on a task
     * @param taskId The ID of the task being challenged
     * @param evidence Evidence supporting the challenge (IPFS hash or similar)
     */
    function challengeVerification(
        uint256 taskId,
        string calldata evidence
    ) external {
        require(tasks[taskId].status == TaskStatus.Completed || tasks[taskId].status == TaskStatus.Failed, 
                "Can only challenge completed or failed tasks");
        require(bytes(evidence).length > 0, "Evidence required");
        
        // In a full implementation, we would:
        // 1. Review the evidence
        // 2. If challenge is valid, slash the verifier's stake and reward the challenger
        // 3. If challenge is invalid, slash the challenger's stake (if any) and reward the verifier
        // For now, we emit an event for off-chain resolution
        
        emit VerificationChallenged(taskId, msg.sender, evidence);
    }

    /**
     * @notice Resolve a verification challenge (called by administrator or via social consensus)
     * @param taskId The ID of the task being resolved
     * @param challengerWins Whether the challenge was successful (true) or not (false)
     * @param challenger The address of the challenger
     * @param verifier The address of the verifier whose decision was challenged
     */
    function resolveVerificationChallenge(
        uint256 taskId,
        bool challengerWins,
        address challenger,
        address verifier
    ) external onlyOwner {
        require(tasks[taskId].status == TaskStatus.Completed || tasks[taskId].status == TaskStatus.Failed, 
                "Can only resolve challenges on completed or failed tasks");
        
        // In a full implementation, we would:
        // 1. Transfer stakes appropriately
        // 2. If challenger wins: slash verifier, reward challenger
        // 3. If verifier wins: slash challenger (if they staked), reward verifier
        // For now, we emit an event for off-chain resolution
        
        emit VerificationChallengeResolved(taskId, challenger, verifier, challengerWins);
    }

    // Events for verifier staking and challenges
    event VerifierStaked(
        uint256 indexed taskId,
        address indexed verifier,
        uint256 amountStaked,
        bool verifierDecision
    );

    event VerificationChallenged(
        uint256 indexed taskId,
        address indexed challenger,
        string evidence
    );

    event VerificationChallengeResolved(
        uint256 indexed taskId,
        address indexed challenger,
        address indexed verifier,
        bool challengerWins
    );

    // Event for verification receipts
    event VerificationReceiptCreated(
        uint256 indexed taskId,
        address indexed verifier,
        bool success,
        uint256 score,
        string feedback
    );
}
