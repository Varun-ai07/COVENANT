// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MilestoneVerification is Ownable {
    constructor() Ownable(msg.sender) {}

    struct Milestone {
        uint256 taskId;
        uint256 milestoneIndex;
        bytes32 deliverableHash;
        uint256 score;        // 0-100
        bool verified;
        bool approved;
        address verifier;
        uint256 timestamp;
    }

    mapping(uint256 => mapping(uint256 => Milestone)) public milestones; // taskId => index => milestone
    mapping(uint256 => uint256) public milestoneCount;
    mapping(uint256 => address) public taskWorkers; // taskId => worker address

    uint256 public approvalThreshold = 70;

    event MilestoneVerified(uint256 indexed taskId, uint256 indexed milestoneIndex, uint256 score, bool approved);
    event MilestoneSubmitted(uint256 indexed taskId, uint256 indexed milestoneIndex, bytes32 deliverableHash);
    event ApprovalThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    function setTaskWorker(uint256 taskId, address worker) external onlyOwner {
        taskWorkers[taskId] = worker;
    }

    function submitMilestone(
        uint256 taskId,
        uint256 milestoneIndex,
        bytes32 deliverableHash
    ) external {
        require(
            msg.sender == taskWorkers[taskId] || msg.sender == owner(),
            "Not authorized"
        );
        require(
            milestones[taskId][milestoneIndex].deliverableHash == bytes32(0),
            "Already submitted"
        );

        milestones[taskId][milestoneIndex] = Milestone({
            taskId: taskId,
            milestoneIndex: milestoneIndex,
            deliverableHash: deliverableHash,
            score: 0,
            verified: false,
            approved: false,
            verifier: address(0),
            timestamp: block.timestamp
        });
        if (milestoneIndex >= milestoneCount[taskId]) {
            milestoneCount[taskId] = milestoneIndex + 1;
        }

        emit MilestoneSubmitted(taskId, milestoneIndex, deliverableHash);
    }

    function verifyMilestone(
        uint256 taskId,
        uint256 milestoneIndex,
        uint256 score,
        bool approved
    ) external onlyOwner {
        Milestone storage m = milestones[taskId][milestoneIndex];
        require(m.deliverableHash != bytes32(0), "Not submitted");
        require(!m.verified, "Already verified");

        if (approved) {
            require(score >= approvalThreshold, "Score below threshold");
        }

        m.score = score;
        m.approved = approved;
        m.verified = true;
        m.verifier = msg.sender;

        emit MilestoneVerified(taskId, milestoneIndex, score, approved);
    }

    function getMilestone(uint256 taskId, uint256 milestoneIndex) external view returns (Milestone memory) {
        return milestones[taskId][milestoneIndex];
    }

    function getMilestoneCount(uint256 taskId) external view returns (uint256) {
        return milestoneCount[taskId];
    }

    function setApprovalThreshold(uint256 _threshold) external onlyOwner {
        uint256 oldThreshold = approvalThreshold;
        approvalThreshold = _threshold;
        emit ApprovalThresholdUpdated(oldThreshold, _threshold);
    }

    function allMilestonesApproved(uint256 taskId) external view returns (bool) {
        uint256 count = milestoneCount[taskId];
        for (uint256 i = 0; i < count; i++) {
            if (!milestones[taskId][i].approved) return false;
        }
        return count > 0;
    }
}
