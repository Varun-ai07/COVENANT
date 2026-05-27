// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RevisionManager
 * @notice On-chain revision tracking for task deliverables.
 *         Clients request revisions (free), workers submit revised work.
 *         Max revisions configurable per-task or globally.
 */
contract RevisionManager is Ownable, ReentrancyGuard {

    struct Revision {
        uint256 taskId;
        uint256 revisionNumber;
        bytes32 deliverableHash;
        string feedbackHash;       // IPFS hash of client feedback
        address requestedBy;       // who requested revision
        uint256 requestedAt;
        uint256 completedAt;
        bool completed;
    }

    mapping(uint256 => Revision[]) public revisions;
    mapping(uint256 => uint256) public maxRevisions;
    mapping(uint256 => bool) public revisionAllowed;

    uint256 public defaultMaxRevisions = 3;

    event RevisionRequested(uint256 indexed taskId, uint256 revisionNumber, address indexed requestedBy, string feedbackHash);
    event RevisionCompleted(uint256 indexed taskId, uint256 revisionNumber, bytes32 newHash);
    event MaxRevisionsUpdated(uint256 indexed taskId, uint256 maxRevisions);
    event RevisionAllowed(uint256 indexed taskId, bool allowed);

    constructor() Ownable(msg.sender) {}

    function setDefaultMaxRevisions(uint256 _max) external onlyOwner {
        defaultMaxRevisions = _max;
    }

    function setMaxRevisions(uint256 taskId, uint256 _max) external onlyOwner {
        maxRevisions[taskId] = _max;
        emit MaxRevisionsUpdated(taskId, _max);
    }

    function setRevisionAllowed(uint256 taskId, bool allowed) external onlyOwner {
        revisionAllowed[taskId] = allowed;
        emit RevisionAllowed(taskId, allowed);
    }

    function requestRevision(uint256 taskId, string calldata feedbackHash) external {
        require(revisionAllowed[taskId], "Revisions not allowed for this task");

        uint256 max = maxRevisions[taskId] > 0 ? maxRevisions[taskId] : defaultMaxRevisions;
        require(revisions[taskId].length < max, "Max revisions reached");

        revisions[taskId].push(Revision({
            taskId: taskId,
            revisionNumber: revisions[taskId].length + 1,
            deliverableHash: bytes32(0),
            feedbackHash: feedbackHash,
            requestedBy: msg.sender,
            requestedAt: block.timestamp,
            completedAt: 0,
            completed: false
        }));

        emit RevisionRequested(taskId, revisions[taskId].length, msg.sender, feedbackHash);
    }

    function submitRevision(uint256 taskId, bytes32 newHash) external {
        require(revisions[taskId].length > 0, "No revision requested");

        Revision storage rev = revisions[taskId][revisions[taskId].length - 1];
        require(!rev.completed, "Already completed");
        require(rev.requestedBy != msg.sender, "Cannot revise your own request");

        rev.deliverableHash = newHash;
        rev.completed = true;
        rev.completedAt = block.timestamp;

        emit RevisionCompleted(taskId, rev.revisionNumber, newHash);
    }

    function getRevisionCount(uint256 taskId) external view returns (uint256) {
        return revisions[taskId].length;
    }

    function getLatestRevision(uint256 taskId) external view returns (Revision memory) {
        require(revisions[taskId].length > 0, "No revisions");
        return revisions[taskId][revisions[taskId].length - 1];
    }

    function getRevisions(uint256 taskId) external view returns (Revision[] memory) {
        return revisions[taskId];
    }

    function canRevise(uint256 taskId) external view returns (bool) {
        if (!revisionAllowed[taskId]) return false;
        uint256 max = maxRevisions[taskId] > 0 ? maxRevisions[taskId] : defaultMaxRevisions;
        return revisions[taskId].length < max;
    }
}
