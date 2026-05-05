// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AgentRegistry.sol";
import "./TaskEscrow.sol";

/**
 * @dev Insurance pool for agents to protect against task failures
 * Implements Section 5D: Agent Insurance Pool
 */
contract AgentInsurance is Ownable {
    // ============ Custom Errors (Gas Optimized) ============
    error NotMember();
    error AlreadyMember();
    error InsufficientFunds();
    error InvalidPremium();
    error NoClaim();
    error ClaimAlreadyPaid();
    error TaskNotFailed();
    error InsufficientPoolBalance();
    error NotAuthorized();
    error VotingNotStarted();
    error VotingEnded();
    error InvalidVote();
    error MinimumMembersNotMet();

    // ============ Events ============
    event MemberJoined(address indexed agent);
    event PremiumPaid(address indexed agent, uint256 taskId, uint256 amount);
    event ClaimSubmitted(address indexed agent, uint256 taskId);
    event ClaimPaid(address indexed agent, uint256 taskId, uint256 amount);
    event ClaimRejected(address indexed agent, uint256 taskId);
    event Withdrawal(address indexed agent, uint256 amount);
    event GovernanceVote(address indexed voter, uint256 claimId, bool inFavor);
    event ClaimApproved(uint256 claimId);
    event ClaimRejectedByGovernance(uint256 claimId);

    // ============ Storage ============
    struct MemberInfo {
        bool isMember;
        uint256 totalPremiumsPaid;
        uint256 totalClaimsReceived;
    }

    struct Claim {
        uint256 taskId;
        address agent;
        uint256 amountRequested;
        uint256 amountAwarded;
        bool isPaid;
        bool isGovernanceVoteComplete;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 votingStartTime;
        uint256 votingEndTime;
    }

    mapping(address => MemberInfo) public members;
    uint256 public memberCount;
    mapping(uint256 => Claim) public claims;
    uint256 public claimCounter;

    // Insurance pool balance
    uint256 public poolBalance;

    // Governance parameters
    uint256 public constant VOTING_DURATION = 1 days; // 1 day for governance vote
    uint256 public constant MIN_GOVERNANCE_MEMBERS = 3; // Minimum members needed for governance
    uint256 public constant CLAIM_COVERAGE_PERCENT = 50; // 50% coverage of task value

    // Contract references
    AgentRegistry public agentRegistry;
    TaskEscrow public taskEscrow;

    // ============ Constructor ============
    constructor(address _agentRegistry, address _taskEscrow) Ownable(msg.sender) {
        agentRegistry = AgentRegistry(_agentRegistry);
        taskEscrow = TaskEscrow(_taskEscrow);
    }

    // ============ Modifiers ============
    modifier onlyMember() {
        if (!members[msg.sender].isMember) {
            revert NotMember();
        }
        _;
    }

    modifier onlyGovernanceMember() {
        // Check if caller is among top 10 reputation agents
        if (!isTopReputationAgent(msg.sender)) {
            revert NotAuthorized();
        }
        _;
    }

    modifier claimExists(uint256 claimId) {
        if (claimId == 0 || claimId > claimCounter) revert NoClaim();
        _;
    }

    modifier claimNotPaid(uint256 claimId) {
        if (claims[claimId].isPaid) revert ClaimAlreadyPaid();
        _;
    }

    modifier claimSubmitted(uint256 claimId) {
        if (!claims[claimId].isPaid && claims[claimId].agent == address(0)) revert NoClaim();
        _;
    }

    modifier votingActive(uint256 claimId) {
        Claim storage claim = claims[claimId];
        if (block.timestamp < claim.votingStartTime) revert VotingNotStarted();
        if (block.timestamp > claim.votingEndTime) revert VotingEnded();
        _;
    }

    // ============ Functions ============

    /**
     * @dev Join the insurance pool by paying a minimum deposit
     * @dev Minimum deposit: 0.01 ETH
     */
    function joinPool() external payable {
        require(msg.value >= 0.01 ether, "Minimum deposit is 0.01 ETH");
        require(!members[msg.sender].isMember, "Already a member");

        members[msg.sender] = MemberInfo({
            isMember: true,
            totalPremiumsPaid: msg.value,
            totalClaimsReceived: 0
        });

        memberCount++;

        poolBalance += msg.value;
        emit MemberJoined(msg.sender);
    }

    /**
     * @dev Pay insurance premium for a specific task
     * @dev Premium is based on agent's reputation:
     *      rep 500-600: 2% of task value
     *      rep 600-800: 1% of task value
     *      rep 800+: 0.5% of task value
     * @param taskId The ID of the task being insured
     */
    function payPremium(uint256 taskId) external payable onlyMember {
        // Get agent's reputation to determine premium rate
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(msg.sender);
        require(agent.isActive == 1, "Agent not active");

        // Get the actual task value from TaskEscrow
        TaskEscrow.Task memory task = taskEscrow.getTask(taskId);
        require(
            task.status == TaskEscrow.TaskStatus.InProgress || task.status == TaskEscrow.TaskStatus.Submitted,
            "Task not in active state"
        );

        uint256 taskValue = task.payment;
        require(taskValue > 0, "Task value must be greater than zero");

        uint256 premium;
        uint16 reputation = uint16(agent.reputation);

        if (reputation >= 500 && reputation < 600) {
            premium = (taskValue * 2) / 100; // 2%
        } else if (reputation >= 600 && reputation < 800) {
            premium = (taskValue * 1) / 100; // 1%
        } else if (reputation >= 800) {
            premium = (taskValue * 5) / 1000; // 0.5%
        } else {
            // Default to 2% for agents with reputation < 500
            premium = (taskValue * 2) / 100; // 2%
        }

        require(premium > 0, "Invalid premium calculated");
        require(msg.value >= premium, "Insufficient funds for premium");

        members[msg.sender].totalPremiumsPaid += premium;
        poolBalance += premium;

        emit PremiumPaid(msg.sender, taskId, premium);
    }

    /**
     * @dev Submit a claim for insurance after a task failure
     * @dev Covers part of the client's loss and tops up agent's reputation
     * @param taskId The ID of the failed task
     */
    function claimInsurance(uint256 taskId) external onlyMember {
        // Verify the task actually failed by checking with TaskEscrow
        TaskEscrow.Task memory task = taskEscrow.getTask(taskId);
        require(
            task.status == TaskEscrow.TaskStatus.Failed || task.status == TaskEscrow.TaskStatus.Disputed,
            "Task has not failed or been disputed"
        );

        // Verify the caller is the worker of this task
        require(task.worker == msg.sender, "Only the worker can claim insurance");

        // Check if already claimed for this task
        for (uint256 i = 1; i <= claimCounter; i++) {
            if (claims[i].taskId == taskId && claims[i].agent == msg.sender) {
                revert ClaimAlreadyPaid();
            }
        }

        claimCounter++;

        // Calculate claim amount: 50% of task value
        uint256 taskValue = task.payment;
        uint256 claimAmount = (taskValue * CLAIM_COVERAGE_PERCENT) / 100; // 50% coverage

        // Ensure we have sufficient funds in the pool
        require(poolBalance >= claimAmount, "Insufficient pool balance");

        // Initialize claim
        claims[claimCounter] = Claim({
            taskId: taskId,
            agent: msg.sender,
            amountRequested: claimAmount,
            amountAwarded: 0,
            isPaid: false,
            isGovernanceVoteComplete: false,
            votesFor: 0,
            votesAgainst: 0,
            votingStartTime: 0,
            votingEndTime: 0
        });

        emit ClaimSubmitted(msg.sender, taskId);
    }

    /**
     * @dev Start governance vote for a claim (can only be called by governance members)
     * @param claimId The ID of the claim to start voting on
     */
    function startGovernanceVote(uint256 claimId) external onlyGovernanceMember claimExists(claimId) {
        Claim storage claim = claims[claimId];
        require(!claim.isPaid, "Claim already paid");
        require(!claim.isGovernanceVoteComplete, "Governance vote already completed");

        // Check if we have enough governance members
        require(getGovernanceMemberCount() >= MIN_GOVERNANCE_MEMBERS, "Minimum members not met");

        claim.votingStartTime = block.timestamp;
        claim.votingEndTime = block.timestamp + VOTING_DURATION;

        // Reset vote counts
        claim.votesFor = 0;
        claim.votesAgainst = 0;
    }

    /**
     * @dev Vote on a claim (governance members only)
     * @param claimId The ID of the claim to vote on
     * @param inFavor True if voting in favor of paying the claim, false otherwise
     */
    function voteOnClaim(uint256 claimId, bool inFavor) external onlyGovernanceMember claimExists(claimId) votingActive(claimId) {
        Claim storage claim = claims[claimId];

        // Record the vote
        if (inFavor) {
            claim.votesFor++;
        } else {
            claim.votesAgainst++;
        }

        emit GovernanceVote(msg.sender, claimId, inFavor);

        // Check if voting period has ended
        if (block.timestamp >= claim.votingEndTime) {
            _finalizeGovernanceVote(claimId);
        }
    }

    /**
     * @dev Pay out an approved claim
     * @dev Can only be called after governance vote approves the claim
     * @param claimId The ID of the claim to pay
     */
    function payClaim(uint256 claimId) external claimExists(claimId) claimNotPaid(claimId) {
        Claim storage claim = claims[claimId];
        require(msg.sender == claim.agent, "Only claimant can trigger payout");
        require(claim.isGovernanceVoteComplete, "Governance vote not completed");
        require(claim.votesFor > claim.votesAgainst, "Claim not approved by governance");

        // Check if we still have sufficient funds
        require(poolBalance >= claim.amountRequested, "Insufficient pool balance");

        // Pay the claim
        poolBalance -= claim.amountRequested;
        claim.amountAwarded = claim.amountRequested;
        claim.isPaid = true;

        // Update member's total claims received
        members[claim.agent].totalClaimsReceived += claim.amountRequested;

        // Top up the agent's reputation in AgentRegistry
        // As per Section 5D: "the insurance pool tops up their reputation"
        uint256 reputationTopUp = 25; // Fixed amount for reputation top-up
        agentRegistry.updateReputation(claim.agent, int256(reputationTopUp));

        emit ClaimPaid(claim.agent, claim.taskId, claim.amountRequested);
    }

    /**
     * @dev Withdraw excess funds from the insurance pool (for members only)
     * @dev Only available if pool balance exceeds required reserves
     */
    function withdraw() external onlyMember {
        require(members[msg.sender].isMember, "Not a member");

        // Only allow withdrawal if pool balance is above minimum reserve
        // Minimum reserve: 0.01 ETH per member
        uint256 minimumReserve = memberCount * 0.01 ether;
        require(poolBalance > minimumReserve, "Pool balance below minimum reserve");

        // Allow withdrawal of excess funds above minimum reserve
        uint256 withdrawAmount = poolBalance - minimumReserve;
        require(withdrawAmount > 0, "Nothing to withdraw");

        poolBalance -= withdrawAmount;

        emit Withdrawal(msg.sender, withdrawAmount);
        (bool success, ) = payable(msg.sender).call{value: withdrawAmount}("");
        require(success, "ETH transfer failed");
    }

    /**
     * @dev Get member information
     * @param agent The agent address
     * @return isMember Whether the agent is a member
     * @return totalPremiumsPaid Total premiums paid by the agent
     * @return totalClaimsReceived Total claims received by the agent
     */
    function getMemberInfo(address agent) external view returns (
        bool isMember,
        uint256 totalPremiumsPaid,
        uint256 totalClaimsReceived
    ) {
        MemberInfo memory info = members[agent];
        return (
            info.isMember,
            info.totalPremiumsPaid,
            info.totalClaimsReceived
        );
    }

    /**
     * @dev Get current insurance pool balance
     */
    function getPoolBalance() external view returns (uint256) {
        return poolBalance;
    }

    /**
     * @dev Get the number of claims submitted
     */
    function getClaimCount() external view returns (uint256) {
        return claimCounter;
    }

    /**
     * @dev Get claim details
     * @param claimId The ID of the claim
     * @return taskId The task ID associated with the claim
     * @return agent The agent who submitted the claim
     * @return amountRequested The amount requested in the claim
     * @return amountAwarded The amount awarded (0 if not paid)
     * @return isPaid Whether the claim has been paid
     * @return isGovernanceVoteComplete Whether governance voting is complete
     * @return votesFor Number of votes in favor
     * @return votesAgainst Number of votes against
     * @return votingStartTime When voting started
     * @return votingEndTime When voting ends
     */
    function getClaim(uint256 claimId) external view claimExists(claimId) returns (
        uint256 taskId,
        address agent,
        uint256 amountRequested,
        uint256 amountAwarded,
        bool isPaid,
        bool isGovernanceVoteComplete,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 votingStartTime,
        uint256 votingEndTime
    ) {
        Claim storage claim = claims[claimId];
        return (
            claim.taskId,
            claim.agent,
            claim.amountRequested,
            claim.amountAwarded,
            claim.isPaid,
            claim.isGovernanceVoteComplete,
            claim.votesFor,
            claim.votesAgainst,
            claim.votingStartTime,
            claim.votingEndTime
        );
    }

    // ============ Helper Functions ============

    /**
     * @dev Check if an agent is among the top reputation agents (for governance)
     * @param agent The agent address to check
     * @return true if agent is in top 10 by reputation
     */
    function isTopReputationAgent(address agent) internal view returns (bool) {
        // Get all agents and sort by reputation (simplified approach)
        address[] memory allAgents = agentRegistry.getAllAgents();

        // Simple bubble sort by reputation (for small numbers of agents)
        // In production, you might want a more efficient sorting algorithm
        bool swapped;
        for (uint256 i = 0; i < allAgents.length; i++) {
            swapped = false;
            for (uint256 j = 0; j < allAgents.length - i - 1; j++) {
                uint16 repJ = uint16(agentRegistry.getAgent(allAgents[j]).reputation);
                uint16 repJPlus1 = uint16(agentRegistry.getAgent(allAgents[j + 1]).reputation);

                if (repJ < repJPlus1) {
                    // Swap
                    address temp = allAgents[j];
                    allAgents[j] = allAgents[j + 1];
                    allAgents[j + 1] = temp;
                    swapped = true;
                }
            }
            if (!swapped) break;
        }

        // Check if agent is in top 10 (or fewer if less than 10 agents exist)
        uint256 topCount = allAgents.length < 10 ? allAgents.length : 10;
        for (uint256 i = 0; i < topCount; i++) {
            if (allAgents[i] == agent) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Get the count of governance members (top reputation agents)
     */
    function getGovernanceMemberCount() internal view returns (uint256) {
        address[] memory allAgents = agentRegistry.getAllAgents();
        uint256 count = 0;
        for (uint256 i = 0; i < allAgents.length; i++) {
            if (isTopReputationAgent(allAgents[i])) {
                count++;
            }
        }
        return count;
    }

    /**
     * @dev Finalize a governance vote after voting period ends
     * @param claimId The ID of the claim to finalize
     */
    function _finalizeGovernanceVote(uint256 claimId) internal {
        Claim storage claim = claims[claimId];
        claim.isGovernanceVoteComplete = true;

        if (claim.votesFor > claim.votesAgainst) {
            emit ClaimApproved(claimId);
        } else {
            emit ClaimRejectedByGovernance(claimId);
            // Mark claim as rejected so it can't be paid
            // In a more complex system, we might allow resubmission
        }
    }
}
