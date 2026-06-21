// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/// @title InsurancePool V5 — Insurance pool with premiums, claims, and governance
contract InsurancePool is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    struct MemberInfo {
        bool isMember;
        uint256 totalPremiumsPaid;
        uint256 totalClaimsReceived;
    }

    struct Claim {
        address claimant;
        uint256 taskId;
        uint256 amountRequested;
        bool approved;
        bool paid;
        uint256 votesFor;
        uint256 votesAgainst;
    }

    mapping(address => MemberInfo) public members;
    uint256 public memberCount;
    mapping(uint256 => Claim) public claims;
    mapping(uint256 => mapping(address => bool)) public claimVoters;
    uint256 public claimCount;
    uint256 public poolBalance;
    uint256 public totalContributions;

    uint256 public constant MIN_JOIN_AMOUNT = 0.01 ether;
    uint256 public constant CLAIM_COVERAGE_PERCENT = 50;

    event MemberJoined(address indexed agent, uint256 amount);
    event PremiumPaid(address indexed agent, uint256 taskId, uint256 amount);
    event ClaimFiled(uint256 indexed claimId, address indexed claimant, uint256 amount);
    event ClaimPaid(uint256 indexed claimId, address indexed claimant, uint256 amount);
    event ClaimApproved(uint256 indexed claimId);

    error NotMember();
    error InsufficientPool();
    error ClaimAlreadyPaid();
    error ClaimAlreadyApproved();
    error InvalidAmount();
    error AlreadyVoted();
    error AlreadyMember();
    error InvalidAddress();
    error ExcessiveWithdraw();

    modifier onlyMember() {
        if (!members[msg.sender].isMember) revert NotMember();
        _;
    }

    constructor() {}

    function initialize() public initializer { __Ownable_init(); __ReentrancyGuard_init(); }

    function joinPool() external payable nonReentrant {
        if (msg.value < MIN_JOIN_AMOUNT) revert InvalidAmount();
        if (members[msg.sender].isMember) revert AlreadyMember();
        members[msg.sender] = MemberInfo({isMember: true, totalPremiumsPaid: msg.value, totalClaimsReceived: 0});
        memberCount++;
        poolBalance += msg.value;
        totalContributions += msg.value;
        emit MemberJoined(msg.sender, msg.value);
    }

    function fileClaim(uint256 taskId, uint256 amount) external {
        if (!members[msg.sender].isMember) revert NotMember();
        claimCount++;
        claims[claimCount] = Claim({claimant: msg.sender, taskId: taskId, amountRequested: amount, approved: false, paid: false, votesFor: 0, votesAgainst: 0});
    }

    function voteOnClaim(uint256 claimId, bool inFavor) external {
        Claim storage c = claims[claimId];
        if (c.claimant == address(0)) revert InvalidAmount();
        if (claimVoters[claimId][msg.sender]) revert AlreadyVoted();
        claimVoters[claimId][msg.sender] = true;
        if (inFavor) c.votesFor++; else c.votesAgainst++;
    }

    function approveClaim(uint256 claimId) external onlyOwner {
        Claim storage c = claims[claimId];
        if (c.claimant == address(0)) revert InvalidAmount();
        if (c.approved) revert ClaimAlreadyApproved();
        if (c.paid) revert ClaimAlreadyPaid();
        c.approved = true;
        emit ClaimApproved(claimId);
    }

    function payClaim(uint256 claimId) external onlyOwner nonReentrant {
        Claim storage c = claims[claimId];
        if (!c.approved || c.paid) revert ClaimAlreadyPaid();
        if (poolBalance < c.amountRequested) revert InsufficientPool();

        c.paid = true;
        poolBalance -= c.amountRequested;
        members[c.claimant].totalClaimsReceived += c.amountRequested;

        (bool s, ) = c.claimant.call{value: c.amountRequested}("");
        require(s, "transfer failed");

        emit ClaimPaid(claimId, c.claimant, c.amountRequested);
    }

    function withdraw() external onlyMember nonReentrant {
        MemberInfo storage member = members[msg.sender];
        if (totalContributions == 0) revert InsufficientPool();

        // Proportional withdrawal: member gets their contribution share of the pool
        uint256 amount = (poolBalance * member.totalPremiumsPaid) / totalContributions;
        if (amount == 0) revert InsufficientPool();

        // Update state before external call (CEI)
        poolBalance -= amount;
        totalContributions -= member.totalPremiumsPaid;
        member.totalPremiumsPaid = 0;
        member.isMember = false;
        memberCount--;

        (bool s, ) = msg.sender.call{value: amount}("");
        require(s, "transfer failed");
    }

    function getPoolBalance() external view returns (uint256) { return poolBalance; }

    function emergencyWithdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        if (amount > address(this).balance / 10) revert ExcessiveWithdraw();
        (bool s, ) = to.call{value: amount}("");
        require(s, "withdraw failed");
    }
    receive() external payable {}
}
