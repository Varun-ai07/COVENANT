// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/AgentRegistry.sol";
import "../contracts/TaskEscrow.sol";

/**
 * @title DisputeArbitrationMock
 * @notice Mock version of DisputeArbitration that skips Chainlink VRF
 *         for testing purposes. Automatically selects jurors on dispute creation.
 */
contract DisputeArbitrationMock {
    error InvalidJurySelection();
    error DisputeNotFound();
    error DisputeAlreadyResolved();
    error NotDisputeParticipant();
    error VotingPeriodEnded();
    error InvalidVote();
    error InsufficientJurors();
    error InsufficientBond();
    error VRFNotInitialized();
    error VRFRequestFailed();

    event DisputeCreated(uint256 indexed disputeId, uint256 indexed taskId, address indexed client);
    event JurySelected(uint256 indexed disputeId, address[] jurors);
    event VoteCast(uint256 indexed disputeId, address indexed juror, bool inFavorOfWorker);
    event DisputeResolved(uint256 indexed disputeId, bool workerWins, uint256 amountToWorker);

    struct Dispute {
        uint256 taskId;
        address client;
        address worker;
        uint256 disputeBond;
        address[] jurors;
        mapping(address => bool) hasVoted;
        mapping(address => bool) votes;
        bool resolved;
        bool workerWins;
        uint256 createdAt;
        uint256 votingEndsAt;
    }

    mapping(uint256 => Dispute) public disputes;
    uint256 public disputeCounter;

    AgentRegistry public immutable agentRegistry;
    TaskEscrow public immutable taskEscrow;

    constructor(
        address _agentRegistry,
        address _taskEscrow,
        address /* _vrfCoordinator */,
        bytes32 /* _keyHash */
    ) {
        agentRegistry = AgentRegistry(_agentRegistry);
        taskEscrow = TaskEscrow(_taskEscrow);
    }

    modifier disputeExists(uint256 disputeId) {
        if (disputeId == 0 || disputeId > disputeCounter) revert DisputeNotFound();
        _;
    }

    modifier votingPeriodActive(uint256 disputeId) {
        if (block.timestamp > disputes[disputeId].votingEndsAt) revert VotingPeriodEnded();
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

        uint256 disputeBond = 0.0002 ether;
        require(msg.value == disputeBond, "Incorrect dispute bond amount");

        disputeCounter++;
        Dispute storage dispute = disputes[disputeCounter];
        dispute.taskId = taskId;
        dispute.client = msg.sender;
        dispute.worker = task.worker;
        dispute.disputeBond = disputeBond;
        dispute.jurors = new address[](0);
        dispute.resolved = false;
        dispute.workerWins = false;
        dispute.createdAt = block.timestamp;
        dispute.votingEndsAt = block.timestamp + 2 days;

        emit DisputeCreated(disputeCounter, taskId, msg.sender);

        // Mock VRF: auto-select jurors
        _selectJurors(disputeCounter);
    }

    function _selectJurors(uint256 disputeId) internal {
        Dispute storage dispute = disputes[disputeId];
        address[] memory allAgents = agentRegistry.getAllAgents();
        address[] memory eligibleJurors = new address[](allAgents.length);
        uint256 eligibleCount = 0;

        for (uint256 i = 0; i < allAgents.length; i++) {
            AgentRegistry.Agent memory agent = agentRegistry.getAgent(allAgents[i]);
            if (
                agent.isActive &&
                agent.reputation > 400 &&
                allAgents[i] != dispute.client &&
                allAgents[i] != dispute.worker
            ) {
                eligibleJurors[eligibleCount] = allAgents[i];
                eligibleCount++;
            }
        }

        if (eligibleCount < 3) {
            revert InsufficientJurors();
        }

        address[] memory selectedJurors = new address[](3);
        uint256 seed = uint256(keccak256(abi.encodePacked(disputeId, blockhash(block.number - 1))));
        for (uint256 i = 0; i < 3; i++) {
            seed = uint256(keccak256(abi.encodePacked(seed, block.timestamp, i)));
            uint256 index = seed % eligibleCount;
            selectedJurors[i] = eligibleJurors[index];
            if (index < eligibleCount - 1) {
                eligibleJurors[index] = eligibleJurors[eligibleCount - 1];
            }
            eligibleCount--;
        }

        dispute.jurors = selectedJurors;
        emit JurySelected(disputeId, selectedJurors);
    }

    function castVote(
        uint256 disputeId,
        bool inFavorOfWorker
    ) external votingPeriodActive(disputeId) disputeExists(disputeId) {
        Dispute storage dispute = disputes[disputeId];

        bool isJuror = false;
        for (uint256 i = 0; i < dispute.jurors.length; i++) {
            if (dispute.jurors[i] == msg.sender) {
                isJuror = true;
                break;
            }
        }
        require(isJuror, "Not a juror for this dispute");
        require(!dispute.hasVoted[msg.sender], "Already voted");

        dispute.hasVoted[msg.sender] = true;
        dispute.votes[msg.sender] = inFavorOfWorker;
        emit VoteCast(disputeId, msg.sender, inFavorOfWorker);

        bool allVoted = true;
        for (uint256 i = 0; i < dispute.jurors.length; i++) {
            if (!dispute.hasVoted[dispute.jurors[i]]) {
                allVoted = false;
                break;
            }
        }
        if (allVoted) {
            _resolveDispute(disputeId);
        }
    }

    function _resolveDispute(uint256 disputeId) internal {
        Dispute storage dispute = disputes[disputeId];
        require(!dispute.resolved, "Dispute already resolved");

        uint256 votesForWorker = 0;
        uint256 votesForClient = 0;
        for (uint256 i = 0; i < dispute.jurors.length; i++) {
            if (dispute.votes[dispute.jurors[i]]) {
                votesForWorker++;
            } else {
                votesForClient++;
            }
        }

        bool workerWins = votesForWorker > votesForClient;
        dispute.workerWins = workerWins;
        dispute.resolved = true;

        // Distribute dispute bond to jurors
        uint256 jurorReward = dispute.disputeBond / dispute.jurors.length;
        for (uint256 i = 0; i < dispute.jurors.length; i++) {
            payable(dispute.jurors[i]).transfer(jurorReward);
        }

        if (workerWins) {
            agentRegistry.updateReputation(dispute.worker, 10);
        } else {
            agentRegistry.updateReputation(dispute.worker, -50);
            AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(dispute.worker);
            if (workerAgent.stakedAmount > 0) {
                uint256 slashAmount = workerAgent.stakedAmount / 2;
                if (slashAmount > 0) {
                    agentRegistry.slashStake(dispute.worker, slashAmount);
                }
            }
        }

        emit DisputeResolved(disputeId, workerWins, workerWins ? 0 : dispute.disputeBond);
    }

    function getDispute(uint256 disputeId) external view disputeExists(disputeId) returns (
        uint256 taskId,
        address client,
        address worker,
        uint256 disputeBond,
        address[] memory jurors,
        bool resolved,
        bool workerWins,
        uint256 createdAt,
        uint256 votingEndsAt
    ) {
        Dispute storage dispute = disputes[disputeId];
        return (
            dispute.taskId,
            dispute.client,
            dispute.worker,
            dispute.disputeBond,
            dispute.jurors,
            dispute.resolved,
            dispute.workerWins,
            dispute.createdAt,
            dispute.votingEndsAt
        );
    }
}
