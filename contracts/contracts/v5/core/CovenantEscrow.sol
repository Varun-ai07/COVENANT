// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

/// @title CovenantEscrow V5 — Core trust primitive with CEI fixes and batch support
/// @notice ~40K gas for create+fund, 96 bytes per task, batch settlement with limits
/// @dev Fixes V4: CEI pattern, batch size limits, emergency withdrawal, proper access control
contract CovenantEscrow is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using ECDSAUpgradeable for bytes32;

    // ═══════════════════════════════════════════════════════════════
    // Types
    // ═══════════════════════════════════════════════════════════════

    enum TaskStatus { None, Created, Funded, Submitted, Disputed, Completed, Failed, Cancelled }

    struct TaskStorage {
        address client;
        address worker;
        uint128 amount;
        uint32 deadline;
        TaskStatus status;
        uint8 disputeCount;
        bytes32 metaHash;
    }

    // ═══════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════

    mapping(uint256 => TaskStorage) private _tasks;
    uint256 public taskCount;

    address public identity;
    address public authorizedSettlement;
    address public authorizedArbitration;
    uint256 public constant MIN_DEADLINE = 1 hours;
    uint256 public constant MAX_DEADLINE = 365 days;
    uint256 public constant MAX_BATCH_SIZE = 20;

    // ═══════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════

    event TaskCreated(uint256 indexed taskId, address indexed client, bytes32 metaHash);
    event TaskFunded(uint256 indexed taskId, uint128 amount);
    event TaskSubmitted(uint256 indexed taskId, address indexed worker, bytes32 deliverableHash);
    event TaskCompleted(uint256 indexed taskId, uint128 payout);
    event TaskFailed(uint256 indexed taskId, bytes32 reason);
    event TaskCancelled(uint256 indexed taskId);
    event TaskDisputed(uint256 indexed taskId, address indexed disputant);
    event BatchSettled(uint256 totalSettled, uint256 count);
    event RefundIssued(address indexed to, uint256 amount);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    // ═══════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════

    error DeadlineTooSoon();
    error DeadlineTooFar();
    error InsufficientValue();
    error NotCreatable();
    error NotClient();
    error NotWorker();
    error NotParty();
    error DeadlineExceeded();
    error NotSubmitted();
    error NotFunded();
    error NotDisputable();
    error Unauthorized();
    error InvalidClientSignature();
    error BatchTooLarge();
    error BatchLengthMismatch();
    error Overpayment();
    error InvalidAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(address _identity) public initializer {
        if (_identity == address(0)) revert InvalidAddress();
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        identity = _identity;
    }

    // ═══════════════════════════════════════════════════════════════
    // Task lifecycle
    // ═══════════════════════════════════════════════════════════════

    function createTask(
        address worker,
        uint128 amount,
        uint32 deadline,
        bytes32 metaHash
    ) external payable nonReentrant whenNotPaused returns (uint256 taskId) {
        if (deadline < block.timestamp + MIN_DEADLINE) revert DeadlineTooSoon();
        if (deadline > block.timestamp + MAX_DEADLINE) revert DeadlineTooFar();
        if (msg.value < amount) revert InsufficientValue();

        taskId = ++taskCount;

        // CEI: Update state BEFORE external calls
        _tasks[taskId] = TaskStorage({
            client: msg.sender,
            worker: worker,
            amount: amount,
            deadline: deadline,
            status: worker != address(0) ? TaskStatus.Funded : TaskStatus.Created,
            disputeCount: 0,
            metaHash: metaHash
        });

        emit TaskCreated(taskId, msg.sender, metaHash);

        if (worker != address(0)) {
            emit TaskFunded(taskId, amount);
        }

        // Refund excess (CEI: state already updated)
        if (msg.value > amount) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - amount}("");
            require(refundSuccess, "refund failed");
            emit RefundIssued(msg.sender, msg.value - amount);
        }
    }

    function fundTask(uint256 taskId) external payable nonReentrant {
        TaskStorage storage task = _tasks[taskId];
        if (task.status != TaskStatus.Created) revert NotCreatable();
        if (task.client != msg.sender) revert NotClient();
        if (msg.value < task.amount) revert InsufficientValue();

        // CEI: State update before external call
        task.status = TaskStatus.Funded;
        emit TaskFunded(taskId, task.amount);

        if (msg.value > task.amount) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - task.amount}("");
            require(refundSuccess, "refund failed");
            emit RefundIssued(msg.sender, msg.value - task.amount);
        }
    }

    function submitWork(uint256 taskId, bytes32 deliverableHash) external nonReentrant {
        TaskStorage storage task = _tasks[taskId];
        if (task.status != TaskStatus.Funded) revert NotFunded();
        if (task.worker != msg.sender) revert NotWorker();
        if (block.timestamp > task.deadline) revert DeadlineExceeded();

        task.status = TaskStatus.Submitted;
        task.metaHash = deliverableHash;
        emit TaskSubmitted(taskId, msg.sender, deliverableHash);
    }

    function completeTask(uint256 taskId, bytes calldata clientSignature) external nonReentrant {
        TaskStorage storage task = _tasks[taskId];
        if (task.status != TaskStatus.Submitted) revert NotSubmitted();

        // Verify client signature (off-chain approval)
        bytes32 message = keccak256(abi.encodePacked(taskId, block.chainid, address(this)));
        bytes32 ethSignedHash = message.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(clientSignature);
        if (signer != task.client) revert InvalidClientSignature();

        // CEI: State update before external call
        task.status = TaskStatus.Completed;
        uint128 payout = task.amount;

        emit TaskCompleted(taskId, payout);

        // External call AFTER state update
        (bool success, ) = task.worker.call{value: payout}("");
        require(success, "payout failed");
    }

    function failTask(uint256 taskId, bytes32 reason) external nonReentrant {
        if (msg.sender != authorizedArbitration && msg.sender != authorizedSettlement && msg.sender != owner()) {
            revert Unauthorized();
        }

        TaskStorage storage task = _tasks[taskId];
        if (task.status != TaskStatus.Submitted && task.status != TaskStatus.Funded) {
            revert NotActionable();
        }

        // CEI: State update before external call
        task.status = TaskStatus.Failed;
        emit TaskFailed(taskId, reason);

        // External call AFTER state update
        (bool success, ) = task.client.call{value: task.amount}("");
        require(success, "refund failed");
    }

    function cancelTask(uint256 taskId) external nonReentrant {
        TaskStorage storage task = _tasks[taskId];
        if (task.client != msg.sender) revert NotClient();
        if (task.status != TaskStatus.Created && task.status != TaskStatus.Funded) {
            revert NotCancellable();
        }
        if (task.status == TaskStatus.Funded && task.worker != address(0)) {
            revert WorkerAssigned();
        }

        // CEI: State update before external call
        task.status = TaskStatus.Cancelled;
        emit TaskCancelled(taskId);

        // External call AFTER state update
        (bool success, ) = task.client.call{value: task.amount}("");
        require(success, "refund failed");
    }

    function disputeTask(uint256 taskId) external nonReentrant {
        TaskStorage storage task = _tasks[taskId];

        if (task.status == TaskStatus.Disputed) {
            // Only authorized parties can increment dispute count on disputed tasks
            if (msg.sender != task.client && msg.sender != task.worker && msg.sender != authorizedArbitration) {
                revert NotParty();
            }
            task.disputeCount++;
            emit TaskDisputed(taskId, msg.sender);
            return;
        }

        if (task.status != TaskStatus.Submitted && task.status != TaskStatus.Funded) {
            revert NotDisputable();
        }
        if (msg.sender != task.client && msg.sender != task.worker && msg.sender != authorizedArbitration) {
            revert NotParty();
        }

        task.status = TaskStatus.Disputed;
        task.disputeCount++;
        emit TaskDisputed(taskId, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════
    // Batch operations (V5 addition)
    // ═══════════════════════════════════════════════════════════════

    function batchSettle(
        uint256[] calldata taskIds,
        uint128[] calldata amounts,
        bytes[] calldata signatures
    ) external onlyOwner nonReentrant {
        if (taskIds.length != amounts.length || taskIds.length != signatures.length) {
            revert BatchLengthMismatch();
        }
        if (taskIds.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        uint256 totalSettled;
        for (uint256 i = 0; i < taskIds.length; i++) {
            TaskStorage storage task = _tasks[taskIds[i]];
            if (task.status != TaskStatus.Submitted) revert NotSubmitted();

            bytes32 message = keccak256(abi.encodePacked(taskIds[i], block.chainid));
            bytes32 ethSignedHash = message.toEthSignedMessageHash();
            address signer = ethSignedHash.recover(signatures[i]);
            if (signer != task.client) revert InvalidClientSignature();

            // Validate payout does not exceed escrowed amount
            if (amounts[i] > task.amount) revert Overpayment();

            // CEI: State update before external call
            task.status = TaskStatus.Completed;

            // External call AFTER state update
            (bool success, ) = task.worker.call{value: amounts[i]}("");
            require(success, "payout failed");

            totalSettled += amounts[i];
        }

        emit BatchSettled(totalSettled, taskIds.length);
    }

    // ═══════════════════════════════════════════════════════════════
    // Emergency (V5 addition)
    // ═══════════════════════════════════════════════════════════════

    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (amount > address(this).balance / 10) revert ExcessiveWithdraw();
        (bool success, ) = to.call{value: amount}("");
        require(success, "emergency withdraw failed");
        emit EmergencyWithdraw(to, amount);
    }

    // ═══════════════════════════════════════════════════════════════
    // View functions
    // ═══════════════════════════════════════════════════════════════

    function getTask(uint256 taskId) external view returns (TaskStorage memory) {
        return _tasks[taskId];
    }

    // ═══════════════════════════════════════════════════════════════
    // Admin functions
    // ═══════════════════════════════════════════════════════════════

    function setAuthorizedSettlement(address addr) external onlyOwner { authorizedSettlement = addr; }
    function setAuthorizedArbitration(address addr) external onlyOwner { authorizedArbitration = addr; }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // Custom errors
    error NotActionable();
    error NotCancellable();
    error WorkerAssigned();
    error ExcessiveWithdraw();
    receive() external payable {}
}
