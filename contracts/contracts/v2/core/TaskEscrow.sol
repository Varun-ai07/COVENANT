// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AgentRegistry.sol";
import "./ReceiptVerifier.sol";

/**
 * @title TaskEscrow v2
 * @notice Minimal escrow + settlement. Queries, milestones descriptions,
 * and coordination are offchain. Only financial state onchain.
 */
contract TaskEscrow is ReentrancyGuard {
    // ─── Enums ─────────────────────────────────────────────────

    enum TaskStatus { Created, Funded, InProgress, Submitted, Completed, Failed, Disputed }
    enum Priority { Low, Medium, High, Urgent }

    // ─── Structs ───────────────────────────────────────────────

    struct Task {
        address client;
        address worker;
        uint256 payment;
        uint256 deadline;
        bytes32 descriptionHash;  // IPFS CID as bytes32
        bytes32 deliverableHash;
        TaskStatus status;
        uint256 createdAt;
        uint256 completedAt;
        Priority priority;
        bool usesMilestones;
        uint256 parentTaskId;
    }

    struct Milestone {
        bytes32 descriptionHash;
        uint256 paymentAmount;
        bytes32 deliverableHash;
        bool completed;
        bool paid;
    }

    // ─── Constants ─────────────────────────────────────────────

    uint256 public constant PROTOCOL_FEE_BPS = 100;  // 1%
    uint256 public constant BPS_DENOMINATOR = 10000;
    int256 public constant REPUTATION_SUCCESS = 10;
    int256 public constant REPUTATION_FAILURE = -20;
    uint256 public constant MIN_DEADLINE_DURATION = 1 hours;
    uint256 public constant MAX_DEADLINE_DURATION = 365 days;

    // ─── Storage ───────────────────────────────────────────────

    mapping(uint256 => Task) public tasks;
    mapping(uint256 => Milestone[]) public milestones;
    mapping(uint256 => uint256[]) public childTasks;
    uint256 public taskCounter;
    uint256 public accumulatedFees;
    address public feeRecipient;

    AgentRegistry public agentRegistry;
    ReceiptVerifier public receiptVerifier;
    address public owner;

    // ─── Priority Fees ─────────────────────────────────────────

    function getPriorityFeeBps(Priority priority) public pure returns (uint256) {
        if (priority == Priority.Low) return 50;
        if (priority == Priority.Medium) return 100;
        if (priority == Priority.High) return 200;
        return 500; // Urgent
    }

    // ─── Events ────────────────────────────────────────────────

    event TaskCreated(uint256 indexed taskId, address indexed client, address indexed worker, uint256 payment, uint256 deadline, Priority priority);
    event TaskFunded(uint256 indexed taskId, uint256 amount);
    event WorkSubmitted(uint256 indexed taskId, bytes32 deliverableHash);
    event TaskCompleted(uint256 indexed taskId, uint256 workerPayment);
    event TaskFailed(uint256 indexed taskId, uint256 refundAmount);
    event TaskDisputed(uint256 indexed taskId, address disputedBy);
    event MilestoneCompleted(uint256 indexed taskId, uint256 milestoneIndex);
    event SubtaskCreated(uint256 indexed parentTaskId, uint256 indexed childTaskId);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    // ─── Constructor ───────────────────────────────────────────

    constructor(address _agentRegistry, address _receiptVerifier, address _feeRecipient) {
        agentRegistry = AgentRegistry(payable(_agentRegistry));
        receiptVerifier = ReceiptVerifier(_receiptVerifier);
        feeRecipient = _feeRecipient;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ─── Task Creation ─────────────────────────────────────────

    function createAndFundTask(
        address worker, uint256 payment, uint256 deadline, bytes32 descriptionHash
    ) external payable nonReentrant returns (uint256) {
        require(payment > 0, "Payment must be > 0");
        require(deadline >= block.timestamp + MIN_DEADLINE_DURATION, "Deadline too soon");
        require(deadline <= block.timestamp + MAX_DEADLINE_DURATION, "Deadline too far");
        require(msg.value == payment, "Must send exact payment");

        uint256 taskId = taskCounter++;
        tasks[taskId] = Task({
            client: msg.sender, worker: worker, payment: payment, deadline: deadline,
            descriptionHash: descriptionHash, deliverableHash: bytes32(0),
            status: TaskStatus.Funded, createdAt: block.timestamp, completedAt: 0,
            priority: Priority.Medium, usesMilestones: false, parentTaskId: 0
        });

        emit TaskCreated(taskId, msg.sender, worker, payment, deadline, Priority.Medium);
        emit TaskFunded(taskId, payment);
        return taskId;
    }

    function createAndFundTaskWithPriority(
        address worker, uint256 payment, uint256 deadline, bytes32 descriptionHash, Priority priority
    ) external payable nonReentrant returns (uint256) {
        require(payment > 0, "Payment must be > 0");
        require(deadline >= block.timestamp + MIN_DEADLINE_DURATION, "Deadline too soon");
        require(deadline <= block.timestamp + MAX_DEADLINE_DURATION, "Deadline too far");

        uint256 priorityFee = (payment * getPriorityFeeBps(priority)) / BPS_DENOMINATOR;
        require(msg.value == payment + priorityFee, "Must send payment + priority fee");

        uint256 taskId = taskCounter++;
        tasks[taskId] = Task({
            client: msg.sender, worker: worker, payment: payment, deadline: deadline,
            descriptionHash: descriptionHash, deliverableHash: bytes32(0),
            status: TaskStatus.Funded, createdAt: block.timestamp, completedAt: 0,
            priority: priority, usesMilestones: false, parentTaskId: 0
        });

        accumulatedFees += priorityFee;
        emit TaskCreated(taskId, msg.sender, worker, payment, deadline, priority);
        emit TaskFunded(taskId, payment);
        return taskId;
    }

    function createTaskWithMilestones(
        address worker, uint256 totalPayment, uint256 deadline, bytes32 descriptionHash,
        bytes32[] calldata milestoneDescriptions, uint256[] calldata milestonePayments
    ) external payable nonReentrant returns (uint256) {
        require(milestoneDescriptions.length == milestonePayments.length, "Array mismatch");
        require(milestoneDescriptions.length > 0 && milestoneDescriptions.length <= 20, "Invalid milestone count");

        uint256 sum = 0;
        for (uint256 i = 0; i < milestonePayments.length; i++) {
            sum += milestonePayments[i];
        }
        require(sum == totalPayment, "Payments must sum to total");
        require(msg.value == totalPayment, "Must send exact payment");

        uint256 taskId = taskCounter++;
        tasks[taskId] = Task({
            client: msg.sender, worker: worker, payment: totalPayment, deadline: deadline,
            descriptionHash: descriptionHash, deliverableHash: bytes32(0),
            status: TaskStatus.Funded, createdAt: block.timestamp, completedAt: 0,
            priority: Priority.Medium, usesMilestones: true, parentTaskId: 0
        });

        for (uint256 i = 0; i < milestoneDescriptions.length; i++) {
            milestones[taskId].push(Milestone({
                descriptionHash: milestoneDescriptions[i],
                paymentAmount: milestonePayments[i],
                deliverableHash: bytes32(0),
                completed: false,
                paid: false
            }));
        }

        emit TaskCreated(taskId, msg.sender, worker, totalPayment, deadline, Priority.Medium);
        emit TaskFunded(taskId, totalPayment);
        return taskId;
    }

    function createSubtask(
        uint256 parentTaskId, address worker, uint256 payment, uint256 deadline, bytes32 descriptionHash
    ) external payable nonReentrant returns (uint256) {
        require(tasks[parentTaskId].client == msg.sender, "Not parent client");
        require(payment > 0, "Payment must be > 0");

        uint256 taskId = taskCounter++;
        tasks[taskId] = Task({
            client: msg.sender, worker: worker, payment: payment, deadline: deadline,
            descriptionHash: descriptionHash, deliverableHash: bytes32(0),
            status: TaskStatus.Funded, createdAt: block.timestamp, completedAt: 0,
            priority: tasks[parentTaskId].priority, usesMilestones: false, parentTaskId: parentTaskId
        });

        childTasks[parentTaskId].push(taskId);
        require(msg.value == payment, "Must send exact payment");

        emit TaskCreated(taskId, msg.sender, worker, payment, deadline, tasks[parentTaskId].priority);
        emit TaskFunded(taskId, payment);
        emit SubtaskCreated(parentTaskId, taskId);
        return taskId;
    }

    // ─── Task Lifecycle ────────────────────────────────────────

    function submitWork(uint256 taskId, bytes32 deliverableHash) external {
        Task storage task = tasks[taskId];
        require(msg.sender == task.worker, "Only worker");
        require(task.status == TaskStatus.Funded || task.status == TaskStatus.InProgress, "Invalid status");
        require(block.timestamp <= task.deadline, "Deadline passed");

        task.deliverableHash = deliverableHash;
        task.status = TaskStatus.Submitted;
        emit WorkSubmitted(taskId, deliverableHash);
    }

    function verifyTask(uint256 taskId, bool success) external nonReentrant {
        Task storage task = tasks[taskId];
        require(msg.sender == task.client, "Only client");
        require(task.status == TaskStatus.Submitted, "Not submitted");

        if (success) {
            task.status = TaskStatus.Completed;
            task.completedAt = block.timestamp;

            uint256 fee = (task.payment * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 workerPayment = task.payment - fee;
            accumulatedFees += fee;

            (bool sent, ) = payable(task.worker).call{value: workerPayment}("");
            require(sent, "ETH transfer failed");

            agentRegistry.recordTaskCompletion(task.worker, true, task.payment);
            emit TaskCompleted(taskId, workerPayment);
        } else {
            task.status = TaskStatus.Failed;

            (bool sent, ) = payable(task.client).call{value: task.payment}("");
            require(sent, "ETH refund failed");

            agentRegistry.recordTaskCompletion(task.worker, false, task.payment);
            emit TaskFailed(taskId, task.payment);
        }
    }

    function disputeTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(msg.sender == task.client || msg.sender == task.worker, "Not authorized");
        require(task.status == TaskStatus.Funded || task.status == TaskStatus.InProgress || task.status == TaskStatus.Submitted, "Invalid status");

        task.status = TaskStatus.Disputed;
        emit TaskDisputed(taskId, msg.sender);
    }

    function resolveDispute(uint256 taskId, bool workerWins, uint256 workerShare) external onlyOwner nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Disputed, "Not disputed");
        require(workerShare <= BPS_DENOMINATOR, "Invalid share");

        if (workerWins) {
            task.status = TaskStatus.Completed;
            task.completedAt = block.timestamp;

            uint256 workerPayment = (task.payment * workerShare) / BPS_DENOMINATOR;
            uint256 clientRefund = task.payment - workerPayment;

            if (workerPayment > 0) {
                (bool sent, ) = payable(task.worker).call{value: workerPayment}("");
                require(sent, "Worker payment failed");
            }
            if (clientRefund > 0) {
                (bool sent, ) = payable(task.client).call{value: clientRefund}("");
                require(sent, "Client refund failed");
            }
        } else {
            task.status = TaskStatus.Failed;
            (bool sent, ) = payable(task.client).call{value: task.payment}("");
            require(sent, "Client refund failed");
        }
    }

    function checkDeadline(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(block.timestamp > task.deadline, "Deadline not passed");
        require(task.status == TaskStatus.Funded || task.status == TaskStatus.InProgress, "Already processed");

        task.status = TaskStatus.Failed;
        (bool sent, ) = payable(task.client).call{value: task.payment}("");
        require(sent, "ETH refund failed");

        emit TaskFailed(taskId, task.payment);
    }

    // ─── Milestones ────────────────────────────────────────────

    function submitMilestone(uint256 taskId, uint256 index, bytes32 deliverableHash) external {
        Task storage task = tasks[taskId];
        require(msg.sender == task.worker, "Only worker");
        require(task.usesMilestones, "Not milestone task");
        require(index < milestones[taskId].length, "Invalid index");

        milestones[taskId][index].deliverableHash = deliverableHash;
        milestones[taskId][index].completed = true;
        emit MilestoneCompleted(taskId, index);
    }

    function verifyMilestone(uint256 taskId, uint256 index, bool success) external nonReentrant {
        Task storage task = tasks[taskId];
        require(msg.sender == task.client, "Only client");
        require(task.usesMilestones, "Not milestone task");
        require(index < milestones[taskId].length, "Invalid index");
        require(milestones[taskId][index].completed, "Not completed");
        require(!milestones[taskId][index].paid, "Already paid");

        if (success) {
            uint256 payment = milestones[taskId][index].paymentAmount;
            uint256 fee = (payment * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 workerPayment = payment - fee;
            accumulatedFees += fee;

            milestones[taskId][index].paid = true;

            (bool sent, ) = payable(task.worker).call{value: workerPayment}("");
            require(sent, "ETH transfer failed");
        }
    }

    // ─── View Functions ────────────────────────────────────────

    function getTask(uint256 taskId) external view returns (
        address client, address worker, uint256 payment, uint256 deadline,
        bytes32 descriptionHash, bytes32 deliverableHash, TaskStatus status,
        uint256 createdAt, uint256 completedAt, Priority priority, bool usesMilestones
    ) {
        Task storage t = tasks[taskId];
        return (t.client, t.worker, t.payment, t.deadline, t.descriptionHash,
                t.deliverableHash, t.status, t.createdAt, t.completedAt, t.priority, t.usesMilestones);
    }

    function getMilestone(uint256 taskId, uint256 index) external view returns (Milestone memory) {
        return milestones[taskId][index];
    }

    function getMilestoneCount(uint256 taskId) external view returns (uint256) {
        return milestones[taskId].length;
    }

    function getChildTasks(uint256 parentTaskId) external view returns (uint256[] memory) {
        return childTasks[parentTaskId];
    }

    // ─── Admin ─────────────────────────────────────────────────

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid recipient");
        emit FeeRecipientUpdated(feeRecipient, _feeRecipient);
        feeRecipient = _feeRecipient;
    }

    function withdrawFees() external onlyOwner {
        uint256 fees = accumulatedFees;
        require(fees > 0, "No fees");
        accumulatedFees = 0;
        (bool sent, ) = payable(feeRecipient).call{value: fees}("");
        require(sent, "Fee transfer failed");
    }

    receive() external payable {}
}
