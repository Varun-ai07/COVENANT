// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AgentRegistry.sol";

/**
 * @title MultiTokenEscrow
 * @notice Escrow contract supporting both native ETH and ERC-20 tokens (USDC, DAI, USDT).
 * @dev Extends the escrow pattern to multi-token. Owner can manage accepted tokens.
 *
 * Architecture: This is a settlement-layer contract (onchain trust guarantee).
 * Coordination (matching, templates, messaging) stays offchain.
 */
contract MultiTokenEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum TaskStatus {
        Created,
        Funded,
        InProgress,
        Submitted,
        Completed,
        Failed,
        Disputed
    }

    // ============ Structs ============

    struct Task {
        address client;
        address worker;
        uint256 payment;
        uint256 deadline;
        string descriptionHash;
        string deliverableHash;
        TaskStatus status;
        uint256 createdAt;
        uint256 completedAt;
        address token; // address(0) = native ETH
    }

    // ============ Constants ============

    uint256 public constant PROTOCOL_FEE_BPS = 100; // 1%
    uint256 public constant BPS_DENOMINATOR = 10000;
    int256 public constant REPUTATION_SUCCESS = 10;
    int256 public constant REPUTATION_FAILURE = -50;

    // ============ Storage ============

    mapping(uint256 => Task) public tasks;
    uint256 public taskCounter;

    // Accepted ERC-20 tokens (owner-managed whitelist)
    mapping(address => bool) public acceptedTokens;

    // Token balances held in escrow (token address => amount)
    mapping(address => uint256) public escrowedTokenBalances;

    // References
    AgentRegistry public agentRegistry;

    // Protocol fees
    uint256 public accumulatedFees;
    mapping(address => uint256) public accumulatedTokenFees; // token => fee amount
    address public feeRecipient;

    // ============ Events ============

    event TaskCreated(
        uint256 indexed taskId,
        address indexed client,
        address indexed worker,
        uint256 payment,
        uint256 deadline,
        address token
    );
    event TaskFunded(uint256 indexed taskId, uint256 amount, address token);
    event WorkSubmitted(uint256 indexed taskId, string deliverableHash);
    event TaskCompleted(uint256 indexed taskId, uint256 workerPayment, address token);
    event TaskFailed(uint256 indexed taskId, uint256 refundAmount, address token);
    event TaskDisputed(uint256 indexed taskId, address disputedBy);
    event TokenAccepted(address indexed token, bool accepted);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    // ============ Constructor ============

    constructor(address _agentRegistry, address _feeRecipient) Ownable(msg.sender) {
        agentRegistry = AgentRegistry(_agentRegistry);
        feeRecipient = _feeRecipient;
    }

    // ============ Token Management (Owner) ============

    function setAcceptedToken(address token, bool accepted) external onlyOwner {
        require(token != address(0), "Use address(0) for ETH");
        acceptedTokens[token] = accepted;
        emit TokenAccepted(token, accepted);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid recipient");
        emit FeeRecipientUpdated(feeRecipient, _feeRecipient);
        feeRecipient = _feeRecipient;
    }

    // ============ Task Creation & Funding ============

    /**
     * @notice Create and fund a task in one transaction (ETH)
     */
    function createAndFundTask(
        address worker,
        uint256 payment,
        uint256 deadline,
        string calldata descriptionHash
    ) external payable nonReentrant returns (uint256) {
        require(worker != address(0), "Invalid worker");
        require(payment > 0, "Payment must be > 0");
        require(deadline > block.timestamp, "Deadline must be future");
        require(msg.value == payment, "Must send exact payment");

        uint256 taskId = taskCounter++;
        tasks[taskId] = Task({
            client: msg.sender,
            worker: worker,
            payment: payment,
            deadline: deadline,
            descriptionHash: descriptionHash,
            deliverableHash: "",
            status: TaskStatus.Funded,
            createdAt: block.timestamp,
            completedAt: 0,
            token: address(0)
        });

        emit TaskCreated(taskId, msg.sender, worker, payment, deadline, address(0));
        emit TaskFunded(taskId, payment, address(0));
        return taskId;
    }

    /**
     * @notice Create and fund a task with an ERC-20 token
     */
    function createAndFundTaskERC20(
        address worker,
        uint256 payment,
        uint256 deadline,
        string calldata descriptionHash,
        address token
    ) external nonReentrant returns (uint256) {
        require(worker != address(0), "Invalid worker");
        require(payment > 0, "Payment must be > 0");
        require(deadline > block.timestamp, "Deadline must be future");
        require(token != address(0), "Use ETH function for native token");
        require(acceptedTokens[token], "Token not accepted");

        // Transfer tokens from sender to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), payment);
        escrowedTokenBalances[token] += payment;

        uint256 taskId = taskCounter++;
        tasks[taskId] = Task({
            client: msg.sender,
            worker: worker,
            payment: payment,
            deadline: deadline,
            descriptionHash: descriptionHash,
            deliverableHash: "",
            status: TaskStatus.Funded,
            createdAt: block.timestamp,
            completedAt: 0,
            token: token
        });

        emit TaskCreated(taskId, msg.sender, worker, payment, deadline, token);
        emit TaskFunded(taskId, payment, token);
        return taskId;
    }

    // ============ Task Lifecycle ============

    function submitWork(uint256 taskId, string calldata deliverableHash) external {
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

            // Calculate payment after fee
            uint256 fee = (task.payment * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 workerPayment = task.payment - fee;

            if (task.token == address(0)) {
                // ETH payment
                accumulatedFees += fee;
                (bool sent, ) = payable(task.worker).call{value: workerPayment}("");
                require(sent, "ETH transfer failed");
            } else {
                // ERC-20 payment
                accumulatedTokenFees[task.token] += fee;
                escrowedTokenBalances[task.token] -= task.payment;
                IERC20(task.token).safeTransfer(task.worker, workerPayment);
            }

            // Update reputation
            agentRegistry.recordTaskCompletion(task.worker, true, task.payment);
            emit TaskCompleted(taskId, workerPayment, task.token);
        } else {
            task.status = TaskStatus.Failed;

            // Refund client
            if (task.token == address(0)) {
                (bool sent, ) = payable(task.client).call{value: task.payment}("");
                require(sent, "ETH refund failed");
            } else {
                escrowedTokenBalances[task.token] -= task.payment;
                IERC20(task.token).safeTransfer(task.client, task.payment);
            }

            // Slash reputation
            agentRegistry.recordTaskCompletion(task.worker, false, task.payment);
            emit TaskFailed(taskId, task.payment, task.token);
        }
    }

    function disputeTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(
            msg.sender == task.client || msg.sender == task.worker,
            "Not authorized"
        );
        require(
            task.status == TaskStatus.Funded ||
            task.status == TaskStatus.InProgress ||
            task.status == TaskStatus.Submitted,
            "Invalid status"
        );

        task.status = TaskStatus.Disputed;
        emit TaskDisputed(taskId, msg.sender);
    }

    function resolveDispute(uint256 taskId, bool workerWins, uint256 workerShare) external onlyOwner {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Disputed, "Not disputed");

        if (workerWins) {
            task.status = TaskStatus.Completed;
            task.completedAt = block.timestamp;
            uint256 workerPayment = (task.payment * workerShare) / BPS_DENOMINATOR;
            uint256 clientRefund = task.payment - workerPayment;

            if (task.token == address(0)) {
                if (workerPayment > 0) {
                    (bool sent, ) = payable(task.worker).call{value: workerPayment}("");
                    require(sent, "Worker payment failed");
                }
                if (clientRefund > 0) {
                    (bool sent, ) = payable(task.client).call{value: clientRefund}("");
                    require(sent, "Client refund failed");
                }
            } else {
                if (workerPayment > 0) {
                    IERC20(task.token).safeTransfer(task.worker, workerPayment);
                }
                if (clientRefund > 0) {
                    IERC20(task.token).safeTransfer(task.client, clientRefund);
                }
                escrowedTokenBalances[task.token] -= task.payment;
            }
        } else {
            task.status = TaskStatus.Failed;
            if (task.token == address(0)) {
                (bool sent, ) = payable(task.client).call{value: task.payment}("");
                require(sent, "Client refund failed");
            } else {
                IERC20(task.token).safeTransfer(task.client, task.payment);
                escrowedTokenBalances[task.token] -= task.payment;
            }
        }
    }

    // ============ Deadline Check ============

    function checkDeadline(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(block.timestamp > task.deadline, "Deadline not passed");
        require(task.status == TaskStatus.Funded || task.status == TaskStatus.InProgress, "Already processed");

        task.status = TaskStatus.Failed;

        // Refund client
        if (task.token == address(0)) {
            (bool sent, ) = payable(task.client).call{value: task.payment}("");
            require(sent, "ETH refund failed");
        } else {
            escrowedTokenBalances[task.token] -= task.payment;
            IERC20(task.token).safeTransfer(task.client, task.payment);
        }

        emit TaskFailed(taskId, task.payment, task.token);
    }

    // ============ Fee Withdrawal ============

    function withdrawFees() external onlyOwner {
        uint256 fees = accumulatedFees;
        require(fees > 0, "No ETH fees");
        accumulatedFees = 0;
        (bool sent, ) = payable(feeRecipient).call{value: fees}("");
        require(sent, "Fee transfer failed");
    }

    function withdrawTokenFees(address token) external onlyOwner {
        uint256 fees = accumulatedTokenFees[token];
        require(fees > 0, "No token fees");
        accumulatedTokenFees[token] = 0;
        IERC20(token).safeTransfer(feeRecipient, fees);
    }

    // ============ Read Functions ============

    function getTask(uint256 taskId) external view returns (
        address client,
        address worker,
        uint256 payment,
        uint256 deadline,
        string memory descriptionHash,
        string memory deliverableHash,
        TaskStatus status,
        uint256 createdAt,
        uint256 completedAt,
        address token
    ) {
        Task storage task = tasks[taskId];
        return (
            task.client,
            task.worker,
            task.payment,
            task.deadline,
            task.descriptionHash,
            task.deliverableHash,
            task.status,
            task.createdAt,
            task.completedAt,
            task.token
        );
    }

    function getTaskCount() external view returns (uint256) {
        return taskCounter;
    }

    function isAcceptedToken(address token) external view returns (bool) {
        return acceptedTokens[token];
    }

    // Allow ETH deposits for task funding
    receive() external payable {}
}
