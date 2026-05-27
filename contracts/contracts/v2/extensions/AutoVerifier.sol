// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AutoVerifier - Automated task verification with threshold-based verdicts
/// @notice Verifies task deliverables using authorized verifiers and a configurable score threshold
contract AutoVerifier is Ownable, ReentrancyGuard {

    enum Verdict { Fail, Partial, Pass }

    /// @notice Verification record for a task
    /// @dev Struct fields ordered for optimal storage packing (5 slots instead of 7)
    struct Verification {
        uint256 taskId;        // slot 1: task identifier
        uint256 score;         // slot 2: score 0-100
        bytes32 evidenceHash;  // slot 3: IPFS hash of full report
        uint256 timestamp;     // slot 4: block.timestamp
        address verifier;      // slot 5: off-chain verifier address (20 bytes)
        Verdict verdict;       // slot 5: auto-calculated from score (1 byte, packed)
        bool exists;           // slot 5: whether verification exists (1 byte, packed)
    }

    mapping(uint256 => Verification) public verifications;
    mapping(uint256 => uint256) public verificationCount;
    mapping(address => bool) public authorizedVerifiers;

    uint256 public passThreshold = 70; // score >= 70 = pass

    event Verified(uint256 indexed taskId, uint256 score, uint8 verdict, bytes32 evidenceHash, address verifier);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event VerifierAuthorized(address verifier, bool authorized);

    constructor() Ownable(msg.sender) {
        authorizedVerifiers[msg.sender] = true;
    }

    /// @notice Update the pass/fail score threshold
    /// @param _threshold New threshold value (0-100)
    function setThreshold(uint256 _threshold) external onlyOwner {
        emit ThresholdUpdated(passThreshold, _threshold);
        passThreshold = _threshold;
    }

    /// @notice Authorize or deauthorize a verifier address
    /// @param verifier Address to authorize/deauthorize
    /// @param authorized True to authorize, false to deauthorize
    function authorizeVerifier(address verifier, bool authorized) external onlyOwner {
        require(verifier != address(0), "Invalid address");
        authorizedVerifiers[verifier] = authorized;
        emit VerifierAuthorized(verifier, authorized);
    }

    /// @notice Submit verification for a single task. Verdict is auto-calculated from score.
    /// @dev Verdict = Pass if score >= passThreshold, Partial if score >= passThreshold/2, else Fail
    /// @param taskId Task to verify
    /// @param score Score from 0-100
    /// @param evidenceHash IPFS CID of full verification report
    function submitVerification(
        uint256 taskId,
        uint256 score,
        bytes32 evidenceHash
    ) external nonReentrant {
        require(authorizedVerifiers[msg.sender], "Not authorized");
        require(score <= 100, "Score must be 0-100");

        Verdict verdict = score >= passThreshold
            ? Verdict.Pass
            : (score >= passThreshold / 2 ? Verdict.Partial : Verdict.Fail);

        verifications[taskId] = Verification({
            taskId: taskId,
            score: score,
            evidenceHash: evidenceHash,
            verifier: msg.sender,
            timestamp: block.timestamp,
            verdict: verdict,
            exists: true
        });
        verificationCount[taskId]++;

        emit Verified(taskId, score, uint8(verdict), evidenceHash, msg.sender);
    }

    /// @notice Submit verifications for multiple tasks in one transaction
    /// @dev Reverts if any taskId already has a verification
    /// @param taskIds Array of task IDs
    /// @param scores Array of scores (0-100)
    /// @param verdicts Array of verdicts (0=Fail, 1=Partial, 2=Pass)
    /// @param evidenceHashes Array of IPFS CIDs
    function batchVerify(
        uint256[] calldata taskIds,
        uint256[] calldata scores,
        Verdict[] calldata verdicts,
        bytes32[] calldata evidenceHashes
    ) external nonReentrant {
        require(taskIds.length > 0, "Empty batch");
        require(authorizedVerifiers[msg.sender], "Not authorized");
        require(taskIds.length == scores.length, "Length mismatch");
        require(taskIds.length == verdicts.length, "Length mismatch");
        require(taskIds.length == evidenceHashes.length, "Length mismatch");

        for (uint256 i = 0; i < taskIds.length; i++) {
            require(scores[i] <= 100, "Score must be 0-100");
            require(!verifications[taskIds[i]].exists, "Duplicate taskId");

            verifications[taskIds[i]] = Verification({
                taskId: taskIds[i],
                score: scores[i],
                evidenceHash: evidenceHashes[i],
                verifier: msg.sender,
                timestamp: block.timestamp,
                verdict: verdicts[i],
                exists: true
            });
            verificationCount[taskIds[i]]++;

            emit Verified(taskIds[i], scores[i], uint8(verdicts[i]), evidenceHashes[i], msg.sender);
        }
    }

    /// @notice Get the full verification record for a task
    /// @param taskId Task identifier
    /// @return Verification struct with all fields
    function getVerification(uint256 taskId) external view returns (Verification memory) {
        return verifications[taskId];
    }

    /// @notice Check if a task has been verified and passed
    /// @param taskId Task identifier
    /// @return True if verified and verdict is Pass
    function isVerified(uint256 taskId) external view returns (bool) {
        return verifications[taskId].exists && verifications[taskId].verdict == Verdict.Pass;
    }

    /// @notice Get the score for a verified task
    /// @param taskId Task identifier
    /// @return Score (0-100)
    function getScore(uint256 taskId) external view returns (uint256) {
        return verifications[taskId].score;
    }

    /// @notice Get the verdict for a verified task
    /// @param taskId Task identifier
    /// @return Verdict (0=Fail, 1=Partial, 2=Pass)
    function getVerdict(uint256 taskId) external view returns (Verdict) {
        return verifications[taskId].verdict;
    }
}
