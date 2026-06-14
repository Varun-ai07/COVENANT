// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../interfaces/ICovenantIdentity.sol";

/// @title CovenantInsurance V3 - Insurance pool with off-chain governance
contract CovenantInsurance is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    struct Policy {
        address agent;
        uint96 premiumPaid;
        uint32 enrolledAt;
        bool active;
    }

    struct Claim {
        address claimant;
        uint256 taskId;
        uint128 claimAmount;
        uint32 filedAt;
        bool approved;
        bool processed;
    }

    mapping(address => Policy) public policies;
    mapping(uint256 => Claim) public claims;
    uint256 public claimCount;

    address public identity;
    uint256 public poolBalance;
    uint256 public coverageMultiplier;
    uint256 public claimCooldown;

    event PolicyEnrolled(address indexed agent, uint96 premium);
    event ClaimFiled(uint256 indexed claimId, address indexed claimant, uint256 taskId);
    event ClaimApproved(uint256 indexed claimId, uint128 payout);
    event ClaimRejected(uint256 indexed claimId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(
        address _identity,
        uint256 _coverageMultiplier,
        uint256 _claimCooldown
    ) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        identity = _identity;
        coverageMultiplier = _coverageMultiplier;
        claimCooldown = _claimCooldown;
    }

    function enroll() external payable nonReentrant {
        require(msg.value > 0, "must pay premium");
        require(!policies[msg.sender].active, "already enrolled");

        ICovenantIdentity.AgentRecord memory agent = ICovenantIdentity(identity).getAgent(msg.sender);
        require(agent.active, "not registered");

        policies[msg.sender] = Policy({
            agent: msg.sender,
            premiumPaid: uint96(msg.value),
            enrolledAt: uint32(block.timestamp),
            active: true
        });

        poolBalance += msg.value;
        emit PolicyEnrolled(msg.sender, uint96(msg.value));
    }

    function fileClaim(uint256 taskId) external nonReentrant {
        Policy storage policy = policies[msg.sender];
        require(policy.active, "not enrolled");
        require(block.timestamp >= policy.enrolledAt + claimCooldown, "cooldown active");

        uint256 claimId = ++claimCount;
        uint128 claimAmount = uint128((uint256(policy.premiumPaid) * coverageMultiplier) / 100);

        claims[claimId] = Claim({
            claimant: msg.sender,
            taskId: taskId,
            claimAmount: claimAmount,
            filedAt: uint32(block.timestamp),
            approved: false,
            processed: false
        });

        emit ClaimFiled(claimId, msg.sender, taskId);
    }

    function approveClaim(uint256 claimId) external onlyOwner {
        Claim storage claim = claims[claimId];
        require(claim.claimant != address(0), "claim not found");
        require(!claim.approved, "already approved");
        require(poolBalance >= claim.claimAmount, "insufficient pool");

        claim.approved = true;
        poolBalance -= claim.claimAmount;

        (bool success, ) = claim.claimant.call{value: claim.claimAmount}("");
        require(success, "payout failed");

        claim.processed = true;
        emit ClaimApproved(claimId, claim.claimAmount);
    }

    function rejectClaim(uint256 claimId) external onlyOwner {
        Claim storage claim = claims[claimId];
        require(claim.claimant != address(0), "claim not found");
        require(!claim.approved, "already approved");

        claim.processed = true;
        emit ClaimRejected(claimId);
    }

    function setCoverageMultiplier(uint256 multiplier) external onlyOwner {
        coverageMultiplier = multiplier;
    }

    function setClaimCooldown(uint256 cooldown) external onlyOwner {
        claimCooldown = cooldown;
    }

    receive() external payable {
        poolBalance += msg.value;
    }
}
