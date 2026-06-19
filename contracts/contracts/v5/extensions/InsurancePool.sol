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
    uint256 public claimCount;
    uint256 public poolBalance;

    uint256 public constant MIN_JOIN_AMOUNT = 0.01 ether;
    uint256 public constant CLAIM_COVERAGE_PERCENT = 50;

    event MemberJoined(address indexed agent, uint256 amount);
    event PremiumPaid(address indexed agent, uint256 taskId, uint256 amount);
    event ClaimFiled(uint256 indexed claimId, address indexed claimant, uint256 amount);
    event ClaimPaid(uint256 indexed claimId, address indexed claimant, uint256 amount);

    error NotMember();
    error InsufficientPool();
    error ClaimAlreadyPaid();
    error InvalidAmount();

    modifier onlyMember() {
        if (!members[msg.sender].isMember) revert NotMember();
        _;
    }

    constructor() {}

    function initialize() public initializer { __Ownable_init(); }

    function joinPool() external payable nonReentrant {
        if (msg.value < MIN_JOIN_AMOUNT) revert InvalidAmount();
        members[msg.sender] = MemberInfo({isMember: true, totalPremiumsPaid: msg.value, totalClaimsReceived: 0});
        memberCount++;
        poolBalance += msg.value;
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
        if (inFavor) c.votesFor++; else c.votesAgainst++;
    }

    function approveClaim(uint256 claimId) external onlyOwner {
        claims[claimId].approved = true;
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
        uint256 minReserve = memberCount * MIN_JOIN_AMOUNT;
        if (poolBalance <= minReserve) revert InsufficientPool();
        uint256 amount = poolBalance - minReserve;
        poolBalance -= amount;
        (bool s, ) = msg.sender.call{value: amount}("");
        require(s, "transfer failed");
    }

    function getPoolBalance() external view returns (uint256) { return poolBalance; }

    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        (bool s, ) = to.call{value: amount}("");
        require(s, "withdraw failed");
    }
    receive() external payable {}
}
