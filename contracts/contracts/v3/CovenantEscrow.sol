// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "./interfaces/ICovenantEscrow.sol";
import "./interfaces/ICovenantIdentity.sol";

/// @title CovenantEscrow V3 - Minimal trust primitive: lock funds, conditional release
/// @notice ~40K gas for create+fund, 96 bytes storage per task
contract CovenantEscrow is
    ICovenantEscrow,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using ECDSAUpgradeable for bytes32;

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

    mapping(uint256 => TaskStorage) private _tasks;
    uint256 public override taskCount;

    address public identity;
    address public authorizedSettlement;
    address public authorizedArbitration;
    uint256 public constant MIN_DEADLINE = 1 hours;
    uint256 public constant MAX_DEADLINE = 365 days;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(address _identity) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        identity = _identity;
    }

    function createTask(
        address worker,
        uint128 amount,
        uint32 deadline,
        bytes32 metaHash
    ) external override payable nonReentrant whenNotPaused returns (uint256 taskId) {
        require(deadline >= block.timestamp + MIN_DEADLINE, "deadline too soon");
        require(deadline <= block.timestamp + MAX_DEADLINE, "deadline too far");
        require(msg.value >= amount, "insufficient value");

        taskId = ++taskCount;

        _tasks[taskId] = TaskStorage({
            client: msg.sender,
            worker: worker,
            amount: amount,
            deadline: deadline,
            status: TaskStatus.Created,
            disputeCount: 0,
            metaHash: metaHash
        });

        if (worker != address(0)) {
            _tasks[taskId].status = TaskStatus.Funded;
        }

        emit TaskCreated(taskId, msg.sender, metaHash);

        if (msg.value > amount) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - amount}("");
            require(refundSuccess, "refund failed");
        }
    }

    function fundTask(uint256 taskId) external override payable nonReentrant {
        TaskStorage storage task = _tasks[taskId];
        require(task.status == TaskStatus.Created, "not creatable");
        require(task.client == msg.sender, "not client");
        require(msg.value >= task.amount, "insufficient value");

        task.status = TaskStatus.Funded;
        emit TaskFunded(taskId, task.amount);

        if (msg.value > task.amount) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - task.amount}("");
            require(refundSuccess, "refund failed");
        }
    }

    function submitWork(uint256 taskId, bytes32 deliverableHash) external override nonReentrant {
        TaskStorage storage task = _tasks[taskId];
        require(task.status == TaskStatus.Funded, "not funded");
        require(task.worker == msg.sender, "not worker");
        require(block.timestamp <= task.deadline, "deadline exceeded");

        task.status = TaskStatus.Submitted;
        task.metaHash = deliverableHash;
        emit TaskSubmitted(taskId, msg.sender, deliverableHash);
    }

    function completeTask(uint256 taskId, bytes calldata clientSignature) external override nonReentrant {
        TaskStorage storage task = _tasks[taskId];
        require(task.status == TaskStatus.Submitted, "not submitted");

        bytes32 message = keccak256(abi.encodePacked(taskId, block.chainid));
        bytes32 ethSignedHash = message.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(clientSignature);
        require(signer == task.client, "invalid client signature");

        task.status = TaskStatus.Completed;
        uint128 payout = task.amount;

        emit TaskCompleted(taskId, payout);

        (bool success, ) = task.worker.call{value: payout}("");
        require(success, "payout failed");
    }

    function failTask(uint256 taskId, bytes32 reason) external override nonReentrant {
        require(msg.sender == authorizedArbitration || msg.sender == owner(), "unauthorized");
        TaskStorage storage task = _tasks[taskId];
        require(
            task.status == TaskStatus.Submitted || task.status == TaskStatus.Funded,
            "not actionable"
        );

        task.status = TaskStatus.Failed;
        emit TaskFailed(taskId, reason);

        (bool success, ) = task.client.call{value: task.amount}("");
        require(success, "refund failed");
    }

    function cancelTask(uint256 taskId) external override nonReentrant {
        TaskStorage storage task = _tasks[taskId];
        require(task.client == msg.sender, "not client");
        require(
            task.status == TaskStatus.Created || task.status == TaskStatus.Funded,
            "not cancellable"
        );
        require(task.status == TaskStatus.Created || task.worker == address(0), "worker assigned");

        task.status = TaskStatus.Cancelled;
        emit TaskCancelled(taskId);

        (bool success, ) = task.client.call{value: task.amount}("");
        require(success, "refund failed");
    }

    function disputeTask(uint256 taskId) external override nonReentrant {
        TaskStorage storage task = _tasks[taskId];
        require(
            task.status == TaskStatus.Submitted || task.status == TaskStatus.Funded,
            "not disputable"
        );
        require(
            msg.sender == task.client || msg.sender == task.worker || msg.sender == authorizedArbitration,
            "not party"
        );

        task.status = TaskStatus.Disputed;
        task.disputeCount++;
        emit TaskDisputed(taskId, msg.sender);
    }

    function getTask(uint256 taskId) external view override returns (Task memory) {
        TaskStorage storage t = _tasks[taskId];
        return Task({
            client: t.client,
            worker: t.worker,
            amount: t.amount,
            deadline: t.deadline,
            status: uint8(t.status),
            disputeCount: t.disputeCount,
            metaHash: t.metaHash
        });
    }

    function setAuthorizedSettlement(address addr) external onlyOwner {
        authorizedSettlement = addr;
    }

    function setAuthorizedArbitration(address addr) external onlyOwner {
        authorizedArbitration = addr;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
