// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AgentRegistry.sol";
import "./TaskEscrow.sol";

contract AgentInsurance is Ownable, ReentrancyGuard {
    error NotMember();
    error AlreadyMember();
    error NoClaim();
    error ClaimAlreadyPaid();
    error ClaimNotPending();
    error InsufficientPoolBalance();

    event MemberJoined(address indexed agent);
    event PremiumPaid(address indexed agent, uint256 taskId, uint256 amount);
    event ClaimSubmitted(address indexed agent, uint256 taskId);
    event ClaimPaid(address indexed agent, uint256 taskId, uint256 amount);
    event ClaimRejected(address indexed agent, uint256 taskId);
    event Withdrawal(address indexed agent, uint256 amount);

    struct MemberInfo {
        bool isMember;
        uint256 totalPremiumsPaid;
        uint256 totalClaimsReceived;
    }

    struct Claim {
        uint256 taskId;
        address agent;
        uint256 amountRequested;
        bool isPaid;
        bool isRejected;
    }

    mapping(address => MemberInfo) public members;
    uint256 public memberCount;
    mapping(uint256 => Claim) public claims;
    uint256 public claimCounter;
    uint256 public poolBalance;

    uint256 public constant CLAIM_COVERAGE_PERCENT = 50;

    AgentRegistry public agentRegistry;
    TaskEscrow public taskEscrow;

    constructor(address _agentRegistry, address _taskEscrow) Ownable(msg.sender) {
        agentRegistry = AgentRegistry(_agentRegistry);
        taskEscrow = TaskEscrow(_taskEscrow);
    }

    modifier onlyMember() {
        if (!members[msg.sender].isMember) revert NotMember();
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

    function joinPool() external payable {
        require(msg.value >= 0.01 ether, "Minimum deposit is 0.01 ETH");
        if (members[msg.sender].isMember) revert AlreadyMember();

        members[msg.sender] = MemberInfo({
            isMember: true,
            totalPremiumsPaid: msg.value,
            totalClaimsReceived: 0
        });
        memberCount++;
        poolBalance += msg.value;
        emit MemberJoined(msg.sender);
    }

    function payPremium(uint256 taskId) external payable onlyMember {
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(msg.sender);
        require(agent.isActive == 1, "Agent not active");

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
            premium = (taskValue * 2) / 100;
        } else if (reputation >= 600 && reputation < 800) {
            premium = (taskValue * 1) / 100;
        } else if (reputation >= 800) {
            premium = (taskValue * 5) / 1000;
        } else {
            premium = (taskValue * 2) / 100;
        }

        require(premium > 0, "Invalid premium calculated");
        require(msg.value >= premium, "Insufficient funds for premium");

        members[msg.sender].totalPremiumsPaid += premium;
        poolBalance += premium;

        emit PremiumPaid(msg.sender, taskId, premium);
    }

    function claimInsurance(uint256 taskId) external onlyMember nonReentrant {
        TaskEscrow.Task memory task = taskEscrow.getTask(taskId);
        require(
            task.status == TaskEscrow.TaskStatus.Failed || task.status == TaskEscrow.TaskStatus.Disputed,
            "Task has not failed or been disputed"
        );
        require(task.worker == msg.sender, "Only the worker can claim insurance");

        for (uint256 i = 1; i <= claimCounter; i++) {
            if (claims[i].taskId == taskId && claims[i].agent == msg.sender) {
                revert ClaimAlreadyPaid();
            }
        }

        claimCounter++;

        uint256 taskValue = task.payment;
        uint256 claimAmount = (taskValue * CLAIM_COVERAGE_PERCENT) / 100;
        require(poolBalance >= claimAmount, "Insufficient pool balance");

        claims[claimCounter] = Claim({
            taskId: taskId,
            agent: msg.sender,
            amountRequested: claimAmount,
            isPaid: false,
            isRejected: false
        });

        emit ClaimSubmitted(msg.sender, taskId);
    }

    function payClaim(uint256 claimId) external onlyOwner claimExists(claimId) claimNotPaid(claimId) nonReentrant {
        Claim storage claim = claims[claimId];
        if (claim.isRejected) revert ClaimNotPending();
        require(poolBalance >= claim.amountRequested, "Insufficient pool balance");

        poolBalance -= claim.amountRequested;
        claim.isPaid = true;

        members[claim.agent].totalClaimsReceived += claim.amountRequested;
        agentRegistry.updateReputation(claim.agent, 25);

        emit ClaimPaid(claim.agent, claim.taskId, claim.amountRequested);
    }

    function rejectClaim(uint256 claimId) external onlyOwner claimExists(claimId) claimNotPaid(claimId) {
        Claim storage claim = claims[claimId];
        claim.isRejected = true;
        emit ClaimRejected(claim.agent, claim.taskId);
    }

    function withdraw(uint256 amount) external onlyMember nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(amount <= members[msg.sender].totalPremiumsPaid - members[msg.sender].totalClaimsReceived, "Exceeds net contribution");

        uint256 minimumReserve = memberCount * 0.01 ether;
        require(poolBalance - amount >= minimumReserve, "Pool balance below minimum reserve");

        members[msg.sender].totalPremiumsPaid -= amount;
        poolBalance -= amount;

        emit Withdrawal(msg.sender, amount);
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    function getMemberInfo(address agent) external view returns (
        bool isMember,
        uint256 totalPremiumsPaid,
        uint256 totalClaimsReceived
    ) {
        MemberInfo memory info = members[agent];
        return (info.isMember, info.totalPremiumsPaid, info.totalClaimsReceived);
    }

    function getPoolBalance() external view returns (uint256) {
        return poolBalance;
    }

    function getClaimCount() external view returns (uint256) {
        return claimCounter;
    }

    function getClaim(uint256 claimId) external view claimExists(claimId) returns (
        uint256 taskId,
        address agent,
        uint256 amountRequested,
        bool isPaid,
        bool isRejected
    ) {
        Claim storage claim = claims[claimId];
        return (
            claim.taskId,
            claim.agent,
            claim.amountRequested,
            claim.isPaid,
            claim.isRejected
        );
    }
}
