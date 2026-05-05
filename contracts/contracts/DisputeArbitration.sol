// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "./AgentRegistry.sol";
import "./TaskEscrow.sol";

/**
 * @dev Contract for random jury-based dispute resolution using Chainlink VRF
 * Implements Section 4C: Dispute Resolution V2 - Randomised Jury
 */
contract DisputeArbitration is Ownable, VRFConsumerBaseV2 {
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

    event DisputeCreated(
        uint256 indexed disputeId,
        uint256 indexed taskId,
        address indexed client
    );
    event JurySelected(
        uint256 indexed disputeId,
        address[] jurors
    );
    event VoteCast(
        uint256 indexed disputeId,
        address indexed juror,
        bool inFavorOfWorker
    );
    event DisputeResolved(
        uint256 indexed disputeId,
        bool workerWins,
        uint256 amountToWorker
    );
    event VRFRequestSent(uint256 requestId, uint256 disputeId);
    event VRFRequestFulfilled(uint256 requestId, uint256[] randomWords);

    struct Dispute {
        uint256 taskId;
        address client;
        address worker;
        uint256 disputeBond;
        address[] jurors;
        mapping(address => bool) votes;
        bool resolved;
        bool workerWins;
        uint256 createdAt;
        uint256 votingEndsAt;
        uint256 vrfRequestId;
    }

    mapping(uint256 => Dispute) public disputes;
    uint256 public disputeCounter;

    AgentRegistry public immutable agentRegistry;
    TaskEscrow public immutable taskEscrow;
    address internal s_vrfCoordinatorAddr;

    bytes32 internal keyHash;
    uint64 internal s_subscriptionId;
    uint32 internal callbackGasLimit = 100000;
    uint16 internal requestConfirmations = 3;
    uint32 internal numWords = 1;

    constructor(
        address _agentRegistry,
        address _taskEscrow,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint64 _subscriptionId
    ) Ownable(msg.sender) VRFConsumerBaseV2(_vrfCoordinator) {
        agentRegistry = AgentRegistry(_agentRegistry);
        taskEscrow = TaskEscrow(_taskEscrow);
        s_vrfCoordinatorAddr = _vrfCoordinator;
        keyHash = _keyHash;
        s_subscriptionId = _subscriptionId;
    }

    modifier disputeExists(uint256 disputeId) {
        if (disputeId == 0 || disputeId > disputeCounter) revert DisputeNotFound();
        _;
    }

    modifier onlyDisputeParticipant(uint256 disputeId) {
        Dispute storage dispute = disputes[disputeId];
        if (msg.sender != dispute.client && msg.sender != dispute.worker) {
            revert NotDisputeParticipant();
        }
        _;
    }

    modifier votingPeriodActive(uint256 disputeId) {
        Dispute storage dispute = disputes[disputeId];
        if (block.timestamp > dispute.votingEndsAt) revert VotingPeriodEnded();
        _;
    }

    modifier vrfInitialized() {
        if (keyHash == bytes32(0) || s_subscriptionId == 0) revert VRFNotInitialized();
        _;
    }

    function disputeTask(uint256 taskId) external payable vrfInitialized {
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

        VRFCoordinatorV2Interface COORDINATOR = VRFCoordinatorV2Interface(s_vrfCoordinatorAddr);
        uint256 requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        if (requestId == 0) {
            revert VRFRequestFailed();
        }
        dispute.vrfRequestId = requestId;

        emit VRFRequestSent(requestId, disputeCounter);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords)
        internal
        override
    {
        uint256 disputeId = 0;
        for (uint256 i = 1; i <= disputeCounter; i++) {
            if (disputes[i].vrfRequestId == requestId) {
                disputeId = i;
                break;
            }
        }
        if (disputeId == 0) {
            return;
        }
        _selectJurorsWithVRFCallback(disputeId, randomWords[0]);
        emit VRFRequestFulfilled(requestId, randomWords);
    }

    function _selectJurorsWithVRFCallback(uint256 disputeId, uint256 randomWord) internal {
        Dispute storage dispute = disputes[disputeId];
        address[] memory allAgents = agentRegistry.getAllAgents();
        address[] memory eligibleJurors = new address[](allAgents.length);
        uint256 eligibleCount = 0;

        for (uint256 i = 0; i < allAgents.length; i++) {
            AgentRegistry.Agent memory agent = agentRegistry.getAgent(allAgents[i]);
            if (
                agent.isActive == 1 &&
                agent.reputation > 600 &&
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
        uint256 seed = randomWord;
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
        require(!dispute.votes[msg.sender], "Already voted");

        dispute.votes[msg.sender] = inFavorOfWorker;
        emit VoteCast(disputeId, msg.sender, inFavorOfWorker);

        bool allVoted = true;
        for (uint256 i = 0; i < dispute.jurors.length; i++) {
            if (!dispute.votes[dispute.jurors[i]]) {
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

        if (workerWins) {
            uint256 jurorReward = dispute.disputeBond / dispute.jurors.length;
            for (uint256 i = 0; i < dispute.jurors.length; i++) {
                (bool success, ) = payable(dispute.jurors[i]).call{value: jurorReward}("");
                require(success, "ETH transfer to juror failed");
            }
            agentRegistry.updateReputation(dispute.worker, 10);
        } else {
            uint256 jurorReward = dispute.disputeBond / dispute.jurors.length;
            for (uint256 i = 0; i < dispute.jurors.length; i++) {
                (bool success, ) = payable(dispute.jurors[i]).call{value: jurorReward}("");
                require(success, "ETH transfer to juror failed");
            }
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