// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/// @title CovenantPaymaster V3 - Gas sponsorship for new agents
/// @notice Sponsors first registration, first task for new users
contract CovenantPaymaster is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    struct UserBudget {
        uint256 lifetimeUsed;
        uint256 lastSponsorTime;
        bool hasRegistered;
        bool hasCreatedTask;
    }

    mapping(address => UserBudget) public budgets;

    uint256 public lifetimeBudgetPerUser;
    uint256 public cooldownPeriod;
    uint256 public totalSponsored;
    address public identity;

    event GasSponsored(address indexed user, uint256 amount, string reason);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(
        address _identity,
        uint256 _lifetimeBudgetPerUser,
        uint256 _cooldownPeriod
    ) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        identity = _identity;
        lifetimeBudgetPerUser = _lifetimeBudgetPerUser;
        cooldownPeriod = _cooldownPeriod;
    }

    function sponsorRegistration(address user) external nonReentrant {
        UserBudget storage budget = budgets[user];
        require(!budget.hasRegistered, "already sponsored");
        require(budget.lifetimeUsed < lifetimeBudgetPerUser, "budget exceeded");

        budget.hasRegistered = true;
        budget.lifetimeUsed += gasleft() * tx.gasprice;
        budget.lastSponsorTime = block.timestamp;
        totalSponsored += gasleft() * tx.gasprice;

        emit GasSponsored(user, gasleft() * tx.gasprice, "registration");
    }

    function sponsorFirstTask(address user) external nonReentrant {
        UserBudget storage budget = budgets[user];
        require(!budget.hasCreatedTask, "already sponsored");
        require(budget.lifetimeUsed < lifetimeBudgetPerUser, "budget exceeded");

        budget.hasCreatedTask = true;
        budget.lifetimeUsed += gasleft() * tx.gasprice;
        budget.lastSponsorTime = block.timestamp;
        totalSponsored += gasleft() * tx.gasprice;

        emit GasSponsored(user, gasleft() * tx.gasprice, "first_task");
    }

    function canSponsor(address user) external view returns (bool) {
        UserBudget storage budget = budgets[user];
        return budget.lifetimeUsed < lifetimeBudgetPerUser;
    }

    function setLifetimeBudget(uint256 budget) external onlyOwner {
        lifetimeBudgetPerUser = budget;
    }

    function setCooldownPeriod(uint256 period) external onlyOwner {
        cooldownPeriod = period;
    }
}
