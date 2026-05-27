// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MultiPartyReview
/// @notice Multi-party peer review system for task deliverables
/// @dev Manages review rounds with access-controlled creation and submission,
///      snapshot-based threshold evaluation, and automatic finalization.
contract MultiPartyReview is Ownable {

    constructor() Ownable(msg.sender) {}

    // ─── Structs ────────────────────────────────────────────────

    /// @notice A single review submitted by a reviewer
    struct Review {
        uint256 taskId;
        address reviewer;
        uint8 score;        // 1-10
        string feedback;    // IPFS hash of detailed feedback
        uint256 timestamp;
    }

    /// @notice State for a review round on a given task
    struct ReviewRound {
        uint256 taskId;
        uint256 requiredReviews;
        uint256 submittedReviews;
        uint256 totalScore;
        bool finalized;
        bool approved;      // average >= threshold
        uint256 approvalThresholdAtCreation; // snapshot of threshold at round creation
    }

    // ─── State ──────────────────────────────────────────────────

    mapping(uint256 => ReviewRound) public reviewRounds;
    mapping(uint256 => Review[]) public reviews;
    mapping(uint256 => mapping(address => bool)) public hasReviewed;

    /// @notice Access control for creating review rounds
    mapping(address => bool) public authorizedCreators;

    /// @notice Per-task whitelist of approved reviewers
    mapping(uint256 => mapping(address => bool)) public approvedReviewers;

    uint256 public approvalThreshold = 7; // average >= 7 = approved
    uint256 public constant MIN_SCORE = 1;
    uint256 public constant MAX_SCORE = 10;

    // ─── Events ─────────────────────────────────────────────────

    event ReviewRoundCreated(uint256 indexed taskId, uint256 requiredReviews);
    event ReviewSubmitted(uint256 indexed taskId, address indexed reviewer, uint8 score);
    event ReviewRoundFinalized(uint256 indexed taskId, bool approved, uint256 averageScore);
    event AuthorizedCreatorSet(address indexed creator, bool authorized);
    event ApprovedReviewerSet(uint256 indexed taskId, address indexed reviewer, bool approved);

    // ─── Access Control ─────────────────────────────────────────

    /// @notice Grant or revoke authorization to create review rounds
    /// @param creator Address to authorize or deauthorize
    /// @param authorized True to authorize, false to revoke
    function setAuthorizedCreator(address creator, bool authorized) external onlyOwner {
        authorizedCreators[creator] = authorized;
        emit AuthorizedCreatorSet(creator, authorized);
    }

    /// @notice Approve or remove a reviewer for a specific task
    /// @param taskId Task the reviewer is approved for
    /// @param reviewer Address to approve or remove
    /// @param approved True to approve, false to remove
    function setApprovedReviewer(uint256 taskId, address reviewer, bool approved) external onlyOwner {
        approvedReviewers[taskId][reviewer] = approved;
        emit ApprovedReviewerSet(taskId, reviewer, approved);
    }

    // ─── Core Functions ─────────────────────────────────────────

    /// @notice Create a new review round for a task
    /// @dev Caller must be the owner or an authorized creator
    /// @param taskId Task identifier to create a round for
    /// @param requiredReviews Number of reviews needed before auto-finalization (1-10)
    function createReviewRound(uint256 taskId, uint256 requiredReviews) external {
        require(authorizedCreators[msg.sender] || msg.sender == owner(), "Not authorized");
        require(reviewRounds[taskId].requiredReviews == 0, "Round exists");
        require(requiredReviews > 0 && requiredReviews <= 10, "Invalid required reviews");

        reviewRounds[taskId] = ReviewRound({
            taskId: taskId,
            requiredReviews: requiredReviews,
            submittedReviews: 0,
            totalScore: 0,
            finalized: false,
            approved: false,
            approvalThresholdAtCreation: approvalThreshold
        });

        emit ReviewRoundCreated(taskId, requiredReviews);
    }

    /// @notice Submit a review for a task
    /// @dev Caller must be the owner or an approved reviewer for this task
    /// @param taskId Task to review
    /// @param score Score from 1 (worst) to 10 (best)
    /// @param feedback IPFS CID of detailed review content
    function submitReview(uint256 taskId, uint8 score, string calldata feedback) external {
        ReviewRound storage round = reviewRounds[taskId];
        require(!round.finalized, "Round finalized");
        require(round.requiredReviews > 0, "No round");
        require(approvedReviewers[taskId][msg.sender] || msg.sender == owner(), "Not approved reviewer");
        require(!hasReviewed[taskId][msg.sender], "Already reviewed");
        require(score >= MIN_SCORE && score <= MAX_SCORE, "Invalid score");

        reviews[taskId].push(Review({
            taskId: taskId,
            reviewer: msg.sender,
            score: score,
            feedback: feedback,
            timestamp: block.timestamp
        }));

        round.submittedReviews++;
        round.totalScore += score;
        hasReviewed[taskId][msg.sender] = true;

        emit ReviewSubmitted(taskId, msg.sender, score);

        // Auto-finalize if all reviews submitted
        if (round.submittedReviews >= round.requiredReviews) {
            _finalizeRound(taskId);
        }
    }

    /// @notice Manually finalize a review round before all reviews are submitted
    /// @dev Can be called by anyone once at least one review exists
    /// @param taskId Task whose review round to finalize
    function finalizeRound(uint256 taskId) external {
        ReviewRound storage round = reviewRounds[taskId];
        require(!round.finalized, "Already finalized");
        require(round.submittedReviews > 0, "No reviews");
        _finalizeRound(taskId);
    }

    /// @dev Internal finalization using the threshold snapshot from round creation
    function _finalizeRound(uint256 taskId) internal {
        ReviewRound storage round = reviewRounds[taskId];
        uint256 average = round.totalScore / round.submittedReviews;
        round.approved = average >= round.approvalThresholdAtCreation;
        round.finalized = true;
        emit ReviewRoundFinalized(taskId, round.approved, average);
    }

    /// @notice Update the approval threshold for future review rounds
    /// @dev Existing rounds use their snapshot; only future rounds are affected
    /// @param _threshold New threshold value (1-10)
    function setApprovalThreshold(uint256 _threshold) external onlyOwner {
        approvalThreshold = _threshold;
    }

    // ─── View Functions ─────────────────────────────────────────

    /// @notice Get full details of a review round
    /// @param taskId Task identifier
    /// @return The ReviewRound struct for the task
    function getReviewRound(uint256 taskId) external view returns (ReviewRound memory) {
        return reviewRounds[taskId];
    }

    /// @notice Get all reviews for a task
    /// @param taskId Task identifier
    /// @return Array of Review structs
    function getReviews(uint256 taskId) external view returns (Review[] memory) {
        return reviews[taskId];
    }

    /// @notice Calculate the current average score for a task
    /// @param taskId Task identifier
    /// @return Average score (0 if no reviews)
    function getAverageScore(uint256 taskId) external view returns (uint256) {
        ReviewRound storage round = reviewRounds[taskId];
        if (round.submittedReviews == 0) return 0;
        return round.totalScore / round.submittedReviews;
    }

    /// @notice Check whether an address has already reviewed a task
    /// @param taskId Task identifier
    /// @param reviewer Address to check
    /// @return True if the reviewer has already submitted a review
    function isReviewed(uint256 taskId, address reviewer) external view returns (bool) {
        return hasReviewed[taskId][reviewer];
    }
}
