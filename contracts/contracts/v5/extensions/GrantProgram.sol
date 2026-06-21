// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/// @title GrantProgram V5 — DAO-funded grants for agent development
contract GrantProgram is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    struct Grant {
        address applicant;
        uint256 amount;
        bool approved;
        bool disbursed;
        uint256 votesFor;
        uint256 votesAgainst;
    }

    mapping(uint256 => Grant) public grants;
    uint256 public grantCount;
    uint256 public treasury;
    uint256 public votingPeriod = 7 days;
    uint256 public constant MIN_APPROVAL_VOTES = 3;

    event GrantApplied(uint256 indexed grantId, address indexed applicant, uint256 amount);
    event GrantVoted(uint256 indexed grantId, address indexed voter, bool inFavor);
    event GrantDisbursed(uint256 indexed grantId, address indexed applicant, uint256 amount);
    event GrantApproved(uint256 indexed grantId, uint256 votesFor, uint256 votesAgainst);

    error InsufficientTreasury();
    error GrantNotActive();
    error AlreadyVoted();
    error NotApproved();
    error AlreadyDisbursed();
    error InvalidAmount();
    error InvalidAddress();
    error ExcessiveWithdraw();

    constructor() {}

    function initialize() public initializer { __Ownable_init(); __ReentrancyGuard_init(); }

    function deposit() external payable { treasury += msg.value; }

    function applyGrant(uint256 amount) external returns (uint256) {
        if (amount == 0 || amount > treasury) revert InvalidAmount();
        grantCount++;
        grants[grantCount] = Grant({applicant: msg.sender, amount: amount, approved: false, disbursed: false, votesFor: 0, votesAgainst: 0});
        emit GrantApplied(grantCount, msg.sender, amount);
        return grantCount;
    }

    function voteGrant(uint256 grantId, bool inFavor) external {
        Grant storage g = grants[grantId];
        if (g.applicant == address(0) || g.approved) revert GrantNotActive();
        if (inFavor) g.votesFor++; else g.votesAgainst++;
        emit GrantVoted(grantId, msg.sender, inFavor);

        // Auto-approve when enough votes in favor and more for than against
        if (!g.approved && g.votesFor >= MIN_APPROVAL_VOTES && g.votesFor > g.votesAgainst) {
            g.approved = true;
            emit GrantApproved(grantId, g.votesFor, g.votesAgainst);
        }
    }

    function disburseGrant(uint256 grantId) external onlyOwner nonReentrant {
        Grant storage g = grants[grantId];
        if (!g.approved || g.disbursed) revert AlreadyDisbursed();
        if (treasury < g.amount) revert InsufficientTreasury();

        g.disbursed = true;
        treasury -= g.amount;

        (bool s, ) = g.applicant.call{value: g.amount}("");
        require(s, "transfer failed");

        emit GrantDisbursed(grantId, g.applicant, g.amount);
    }

    function setVotingPeriod(uint256 _period) external onlyOwner { votingPeriod = _period; }

    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (amount > address(this).balance / 10) revert ExcessiveWithdraw();
        (bool s, ) = to.call{value: amount}("");
        require(s, "withdraw failed");
    }
    receive() external payable {}
}
