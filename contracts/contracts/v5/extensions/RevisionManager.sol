// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/// @title RevisionManager V5 — Revision tracking with access control
contract RevisionManager is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    struct Revision {
        uint256 taskId;
        uint256 revisionNumber;
        bytes32 deliverableHash;
        string feedbackHash;
        address requestedBy;
        uint256 requestedAt;
        uint256 completedAt;
        bool completed;
    }

    mapping(uint256 => Revision[]) public revisions;
    mapping(uint256 => uint256) public maxRevisions;
    mapping(uint256 => bool) public revisionAllowed;
    mapping(uint256 => address) public taskClient;

    uint256 public defaultMaxRevisions = 3;

    event RevisionRequested(uint256 indexed taskId, uint256 revisionNumber, address indexed requestedBy);
    event RevisionCompleted(uint256 indexed taskId, uint256 revisionNumber, bytes32 newHash);

    error RevisionsNotAllowed();
    error MaxRevisionsReached();
    error NoRevisionRequested();
    error AlreadyCompleted();
    error CannotReviseOwnRequest();
    error ClientCannotSubmit();
    error NotTaskClient();

    constructor() {}

    function initialize() public initializer { __Ownable_init(); }

    function setTaskClient(uint256 taskId, address client) external onlyOwner { taskClient[taskId] = client; }
    function setRevisionAllowed(uint256 taskId, bool allowed) external onlyOwner { revisionAllowed[taskId] = allowed; }
    function setMaxRevisions(uint256 taskId, uint256 max) external onlyOwner { maxRevisions[taskId] = max; }
    function setDefaultMaxRevisions(uint256 max) external onlyOwner { defaultMaxRevisions = max; }

    function requestRevision(uint256 taskId, string calldata feedbackHash) external {
        if (!revisionAllowed[taskId]) revert RevisionsNotAllowed();
        if (msg.sender != taskClient[taskId]) revert NotTaskClient();

        uint256 max = maxRevisions[taskId] > 0 ? maxRevisions[taskId] : defaultMaxRevisions;
        if (revisions[taskId].length >= max) revert MaxRevisionsReached();

        revisions[taskId].push(Revision({
            taskId: taskId, revisionNumber: revisions[taskId].length + 1, deliverableHash: bytes32(0),
            feedbackHash: feedbackHash, requestedBy: msg.sender, requestedAt: block.timestamp, completedAt: 0, completed: false
        }));

        emit RevisionRequested(taskId, revisions[taskId].length, msg.sender);
    }

    function submitRevision(uint256 taskId, bytes32 newHash) external {
        if (revisions[taskId].length == 0) revert NoRevisionRequested();
        Revision storage rev = revisions[taskId][revisions[taskId].length - 1];
        if (rev.completed) revert AlreadyCompleted();
        if (rev.requestedBy == msg.sender) revert CannotReviseOwnRequest();
        if (msg.sender == taskClient[taskId]) revert ClientCannotSubmit();

        rev.deliverableHash = newHash;
        rev.completed = true;
        rev.completedAt = block.timestamp;

        emit RevisionCompleted(taskId, rev.revisionNumber, newHash);
    }

    function getRevisionCount(uint256 taskId) external view returns (uint256) { return revisions[taskId].length; }

    function getLatestRevision(uint256 taskId) external view returns (Revision memory) {
        require(revisions[taskId].length > 0, "No revisions");
        return revisions[taskId][revisions[taskId].length - 1];
    }
    receive() external payable {}
}
