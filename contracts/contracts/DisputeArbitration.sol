// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AgentRegistry.sol";
import "./TaskEscrow.sol";

contract DisputeArbitration is Ownable, ReentrancyGuard {
    error DisputeNotFound();
    error DisputeAlreadyResolved();
    error InsufficientBond();
    error NotDisputeParticipant();

    event DisputeCreated(uint256 indexed disputeId, uint256 indexed taskId, address indexed initiator);
    event DisputeResolved(uint256 indexed disputeId, bool workerWins);

    struct Dispute {
        uint256 taskId;
        address client;
        address worker;
        address initiator;
        uint256 bond;
        bool resolved;
        bool workerWins;
    }

    mapping(uint256 => Dispute) public disputes;
    uint256 public disputeCounter;

    AgentRegistry public immutable agentRegistry;
    TaskEscrow public immutable taskEscrow;

    constructor(
        address _agentRegistry,
        address _taskEscrow
    ) Ownable(msg.sender) {
        agentRegistry = AgentRegistry(_agentRegistry);
        taskEscrow = TaskEscrow(_taskEscrow);
    }

    modifier disputeExists(uint256 disputeId) {
        if (disputeId == 0 || disputeId > disputeCounter) revert DisputeNotFound();
        _;
    }

    modifier disputeNotResolved(uint256 disputeId) {
        if (disputes[disputeId].resolved) revert DisputeAlreadyResolved();
        _;
    }

    function disputeTask(uint256 taskId) external payable {
        TaskEscrow.Task memory task = taskEscrow.getTask(taskId);
        require(
            task.status == TaskEscrow.TaskStatus.InProgress || task.status == TaskEscrow.TaskStatus.Submitted,
            "Task not in disputable state"
        );
        require(
            msg.sender == task.client || msg.sender == task.worker,
            "Not participant"
        );

        uint256 bond = 0.0002 ether;
        if (msg.value < bond) revert InsufficientBond();

        disputeCounter++;
        Dispute storage dispute = disputes[disputeCounter];
        dispute.taskId = taskId;
        dispute.client = task.client;
        dispute.worker = task.worker;
        dispute.initiator = msg.sender;
        dispute.bond = msg.value;
        dispute.resolved = false;
        dispute.workerWins = false;

        emit DisputeCreated(disputeCounter, taskId, msg.sender);
    }

    function resolveDispute(
        uint256 disputeId,
        bool workerWins
    ) external onlyOwner disputeExists(disputeId) disputeNotResolved(disputeId) nonReentrant {
        Dispute storage dispute = disputes[disputeId];
        dispute.workerWins = workerWins;
        dispute.resolved = true;

        if (workerWins) {
            agentRegistry.updateReputation(dispute.worker, 10);
            (bool success, ) = payable(dispute.initiator).call{value: dispute.bond}("");
            require(success, "ETH transfer failed");
        } else {
            agentRegistry.updateReputation(dispute.worker, -20);
            AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(dispute.worker);
            if (workerAgent.stakedAmount > 0) {
                uint256 slashAmount = workerAgent.stakedAmount / 2;
                if (slashAmount > 0) {
                    agentRegistry.slashStake(dispute.worker, slashAmount);
                }
            }
            (bool success, ) = payable(dispute.initiator).call{value: dispute.bond}("");
            require(success, "ETH transfer failed");
        }

        emit DisputeResolved(disputeId, workerWins);
    }

    function getDispute(uint256 disputeId) external view disputeExists(disputeId) returns (
        uint256 taskId,
        address client,
        address worker,
        address initiator,
        uint256 bond,
        bool resolved,
        bool workerWins
    ) {
        Dispute storage dispute = disputes[disputeId];
        return (
            dispute.taskId,
            dispute.client,
            dispute.worker,
            dispute.initiator,
            dispute.bond,
            dispute.resolved,
            dispute.workerWins
        );
    }
}
