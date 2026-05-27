// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title InsurancePool
 * @notice Minimal insurance pool. Governance (claim approval) happens offchain
 * via EIP-712 signatures. Onchain: ETH hold + payout only.
 */
contract InsurancePool is AccessControl, ReentrancyGuard {
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    uint256 public constant COVERAGE_PERCENT = 80; // 80% coverage
    uint256 public constant CLAIM_COOLDOWN = 7 days;

    mapping(address => bool) public isMember;
    mapping(address => uint256) public contributions;
    uint256 public totalPoolBalance;
    uint256 public memberCount;

    mapping(uint256 => Claim) public claims;
    uint256 public claimCounter;
    mapping(address => uint256) public lastClaimTime;

    struct Claim {
        address claimant;
        uint256 taskId;
        uint256 amount;
        bool paid;
        uint256 timestamp;
    }

    event MemberJoined(address indexed member, uint256 contribution);
    event ClaimFiled(uint256 indexed claimId, address indexed claimant, uint256 amount);
    event ClaimPaid(uint256 indexed claimId, address indexed claimant, uint256 amount);
    event PoolDeposited(address indexed member, uint256 amount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
    }

    function joinPool() external payable nonReentrant {
        require(msg.value >= 0.01 ether, "Min contribution 0.01 ETH");
        require(!isMember[msg.sender], "Already a member");

        isMember[msg.sender] = true;
        contributions[msg.sender] += msg.value;
        totalPoolBalance += msg.value;
        memberCount++;

        emit MemberJoined(msg.sender, msg.value);
    }

    function deposit() external payable nonReentrant {
        require(isMember[msg.sender], "Not a member");
        contributions[msg.sender] += msg.value;
        totalPoolBalance += msg.value;
        emit PoolDeposited(msg.sender, msg.value);
    }

    function fileClaim(uint256 taskId, uint256 amount) external nonReentrant {
        require(isMember[msg.sender], "Not a member");
        require(block.timestamp >= lastClaimTime[msg.sender] + CLAIM_COOLDOWN, "Cooldown");
        require(amount <= totalPoolBalance, "Exceeds pool balance");

        lastClaimTime[msg.sender] = block.timestamp;

        claims[claimCounter] = Claim({
            claimant: msg.sender,
            taskId: taskId,
            amount: amount,
            paid: false,
            timestamp: block.timestamp
        });

        emit ClaimFiled(claimCounter, msg.sender, amount);
        claimCounter++;
    }

    function payClaim(uint256 claimId, bytes calldata /* approvalSignature */) external nonReentrant onlyRole(GOVERNANCE_ROLE) {
        Claim storage claim = claims[claimId];
        require(!claim.paid, "Already paid");
        require(totalPoolBalance >= claim.amount, "Insufficient pool balance");

        // In production: verify EIP-712 signature from governance multisig
        // For now, only GOVERNANCE_ROLE can approve

        uint256 payout = (claim.amount * COVERAGE_PERCENT) / 100;
        claim.paid = true;
        totalPoolBalance -= payout;

        (bool sent, ) = payable(claim.claimant).call{value: payout}("");
        require(sent, "Transfer failed");

        emit ClaimPaid(claimId, claim.claimant, payout);
    }

    function getPoolBalance() external view returns (uint256) {
        return totalPoolBalance;
    }

    function getMemberInfo(address member) external view returns (bool active, uint256 contributed) {
        return (isMember[member], contributions[member]);
    }

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return claims[claimId];
    }

    receive() external payable {}
}
