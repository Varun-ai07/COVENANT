// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GrantProgram
 * @notice Enable COVENANT DAO to manage grants for ecosystem development
 */
contract GrantProgram is Ownable, ReentrancyGuard {

    enum GrantStatus { Pending, Active, Approved, Rejected, Funded, Completed }
    enum GrantCategory { EcosystemGrowth, Research, Community, Security, Infrastructure }

    struct Grant {
        uint256 id;
        address applicant;
        string title;
        string description;
        GrantCategory category;
        uint256 amountRequested;
        GrantStatus status;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 totalVotes;
        uint256 createdAt;
        uint256 votingEndsAt;
    }

    struct Vote {
        address voter;
        bool support;
        uint256 weight;
        uint256 timestamp;
    }

    mapping(uint256 => Grant) public grants;
    mapping(uint256 => Vote[]) public grantVotes;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(address => uint256[]) public applicantGrants;
    mapping(address => uint256[]) public voterHistory;

    uint256 public grantCounter;
    uint256 public treasury;
    uint256 public votingPeriod = 3 days;
    uint256 public quorumBps = 1000; // 10%
    uint256 public approvalThresholdBps = 5000; // 50%
    address public governance;

    event GrantCreated(uint256 indexed grantId, address indexed applicant, string title, uint256 amount);
    event GrantVoted(uint256 indexed grantId, address indexed voter, bool support, uint256 weight);
    event GrantApproved(uint256 indexed grantId, uint256 amount);
    event GrantRejected(uint256 indexed grantId);
    event GrantFunded(uint256 indexed grantId, address indexed recipient, uint256 amount);

    constructor(address _governance) Ownable(msg.sender) {
        governance = _governance;
    }

    function setGovernance(address _governance) external onlyOwner {
        governance = _governance;
    }

    function setVotingPeriod(uint256 _period) external onlyOwner {
        votingPeriod = _period;
    }

    function deposit() external payable {
        treasury += msg.value;
    }

    function withdraw(uint256 amount) external onlyOwner {
        require(amount <= treasury, "Insufficient treasury");
        treasury -= amount;
        (bool success, ) = owner().call{value: amount}("");
        require(success, "Withdraw failed");
    }

    function createGrant(
        string calldata title,
        string calldata description,
        GrantCategory category,
        uint256 amountRequested
    ) external returns (uint256) {
        require(amountRequested > 0, "Zero amount");

        uint256 grantId = grantCounter++;

        grants[grantId] = Grant({
            id: grantId,
            applicant: msg.sender,
            title: title,
            description: description,
            category: category,
            amountRequested: amountRequested,
            status: GrantStatus.Active,
            votesFor: 0,
            votesAgainst: 0,
            totalVotes: 0,
            createdAt: block.timestamp,
            votingEndsAt: block.timestamp + votingPeriod
        });

        applicantGrants[msg.sender].push(grantId);
        emit GrantCreated(grantId, msg.sender, title, amountRequested);
        return grantId;
    }

    function voteOnGrant(uint256 grantId, bool support) external {
        Grant storage grant = grants[grantId];
        require(grant.status == GrantStatus.Active, "Not active");
        require(block.timestamp <= grant.votingEndsAt, "Voting ended");
        require(!hasVoted[grantId][msg.sender], "Already voted");

        uint256 weight = 1;

        grantVotes[grantId].push(Vote({
            voter: msg.sender,
            support: support,
            weight: weight,
            timestamp: block.timestamp
        }));

        if (support) {
            grant.votesFor += weight;
        } else {
            grant.votesAgainst += weight;
        }
        grant.totalVotes += weight;
        hasVoted[grantId][msg.sender] = true;
        voterHistory[msg.sender].push(grantId);

        emit GrantVoted(grantId, msg.sender, support, weight);
    }

    function finalizeGrant(uint256 grantId) external {
        Grant storage grant = grants[grantId];
        require(grant.status == GrantStatus.Active, "Not active");
        require(block.timestamp > grant.votingEndsAt, "Voting not ended");

        uint256 totalWeight = grant.votesFor + grant.votesAgainst;
        uint256 approvalRate = totalWeight > 0 ? (grant.votesFor * 10000) / totalWeight : 0;

        if (totalWeight > 0 && approvalRate >= approvalThresholdBps) {
            grant.status = GrantStatus.Approved;
            emit GrantApproved(grantId, grant.amountRequested);
        } else {
            grant.status = GrantStatus.Rejected;
            emit GrantRejected(grantId);
        }
    }

    function fundGrant(uint256 grantId) external nonReentrant {
        Grant storage grant = grants[grantId];
        require(grant.status == GrantStatus.Approved, "Not approved");
        require(treasury >= grant.amountRequested, "Insufficient treasury");

        treasury -= grant.amountRequested;
        grant.status = GrantStatus.Funded;

        (bool success, ) = grant.applicant.call{value: grant.amountRequested}("");
        require(success, "Funding transfer failed");

        emit GrantFunded(grantId, grant.applicant, grant.amountRequested);
    }

    function getGrant(uint256 grantId) external view returns (Grant memory) {
        return grants[grantId];
    }

    function getGrantVotes(uint256 grantId) external view returns (Vote[] memory) {
        return grantVotes[grantId];
    }

    function getGrantCount() external view returns (uint256) {
        return grantCounter;
    }

    function getTreasury() external view returns (uint256) {
        return treasury;
    }

    function getApplicantGrants(address applicant) external view returns (uint256[] memory) {
        return applicantGrants[applicant];
    }

    receive() external payable {
        treasury += msg.value;
    }
}
