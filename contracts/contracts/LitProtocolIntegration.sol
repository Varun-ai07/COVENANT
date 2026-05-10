// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LitProtocolIntegration
 * @notice Threshold encryption for conditional decryption of task data
 * @dev Integrates with Lit Protocol for access control based on on-chain conditions.
 *      This contract manages encryption conditions and decryption authorization.
 *
 * Key Features:
 * - Condition-based encryption for task data
 * - Multi-party threshold decryption
 * - Time-locked decryption for escrow
 * - Verification-gated access
 */
contract LitProtocolIntegration is Ownable {
    // ============ Custom Errors ============
    error ConditionNotMet();
    error InvalidCondition();
    error DecryptionNotAllowed();
    error AlreadyAuthorized();
    error NotAuthorized();
    error TimeLockNotExpired();
    error InvalidAddress();
    // =======================================

    // ============ Events ============
    event EncryptionConditionSet(
        uint256 indexed conditionId,
        ConditionType conditionType,
        bytes encryptedData
    );

    event DecryptionAuthorized(
        uint256 indexed conditionId,
        address indexed requester,
        bytes decryptionKey
    );

    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    event ConditionVerified(
        uint256 indexed conditionId,
        address indexed verifier,
        bool result
    );

    // ============ Enums ============
    enum ConditionType {
        TaskCompletion,        // Decrypt when task is completed
        TaskFailure,           // Decrypt when task fails
        TimeLock,              // Decrypt after timestamp
        VerificationSuccess,   // Decrypt when verification passes
        MultiSig,              // Decrypt when N of M signers approve
        ReputationThreshold,   // Decrypt when reputation exceeds threshold
        DisputeResolution      // Decrypt when dispute is resolved
    }

    // ============ Structs ============
    struct EncryptionCondition {
        ConditionType conditionType;
        uint256 targetId;         // Task ID, timestamp, or other target
        address targetContract;   // Contract to check condition on
        bytes encryptedSymmetricKey;  // Lit-encrypted symmetric key
        bytes encryptedData;          // IPFS hash or encrypted payload
        bool isDecrypted;
        uint256 createdAt;
        uint256 decryptedAt;
    }

    struct DecryptionAuthorization {
        address requester;
        uint256 conditionId;
        bool authorized;
        uint256 timestamp;
    }

    // ============ Storage ============
    uint256 public conditionCounter;
    uint256 public decryptionThreshold = 2;  // Minimum signatures for decryption

    mapping(uint256 => EncryptionCondition) public conditions;
    mapping(uint256 => DecryptionAuthorization[]) public authorizations;
    mapping(uint256 => mapping(address => bool)) public hasAuthorized;

    // Trusted verifiers for multi-sig conditions
    mapping(address => bool) public isTrustedVerifier;
    address[] public trustedVerifiers;

    // Reference contracts
    address public taskEscrow;
    address public agentRegistry;

    // ============ Modifiers ============
    modifier onlyTrustedVerifier() {
        if (!isTrustedVerifier[msg.sender]) revert NotAuthorized();
        _;
    }

    modifier validCondition(uint256 conditionId) {
        if (conditions[conditionId].createdAt == 0) revert InvalidCondition();
        _;
    }

    // ============ Constructor ============
    constructor(
        address _taskEscrow,
        address _agentRegistry
    ) Ownable(msg.sender) {
        taskEscrow = _taskEscrow;
        agentRegistry = _agentRegistry;
    }

    // ============ External Functions ============

    /**
     * @notice Set up an encryption condition for task data
     * @param conditionType Type of condition for decryption
     * @param targetId Task ID or timestamp depending on condition type
     * @param encryptedSymmetricKey Lit-encrypted symmetric key
     * @param encryptedData IPFS hash or encrypted payload
     */
    function setEncryptionCondition(
        ConditionType conditionType,
        uint256 targetId,
        bytes calldata encryptedSymmetricKey,
        bytes calldata encryptedData
    ) external returns (uint256) {
        conditionCounter++;

        conditions[conditionCounter] = EncryptionCondition({
            conditionType: conditionType,
            targetId: targetId,
            targetContract: msg.sender,
            encryptedSymmetricKey: encryptedSymmetricKey,
            encryptedData: encryptedData,
            isDecrypted: false,
            createdAt: block.timestamp,
            decryptedAt: 0
        });

        emit EncryptionConditionSet(conditionCounter, conditionType, encryptedData);

        return conditionCounter;
    }

    /**
     * @notice Set encryption condition with custom target contract
     */
    function setEncryptionConditionWithTarget(
        ConditionType conditionType,
        uint256 targetId,
        address targetContract,
        bytes calldata encryptedSymmetricKey,
        bytes calldata encryptedData
    ) external returns (uint256) {
        if (targetContract == address(0)) revert InvalidAddress();

        conditionCounter++;

        conditions[conditionCounter] = EncryptionCondition({
            conditionType: conditionType,
            targetId: targetId,
            targetContract: targetContract,
            encryptedSymmetricKey: encryptedSymmetricKey,
            encryptedData: encryptedData,
            isDecrypted: false,
            createdAt: block.timestamp,
            decryptedAt: 0
        });

        emit EncryptionConditionSet(conditionCounter, conditionType, encryptedData);

        return conditionCounter;
    }

    /**
     * @notice Authorize decryption for a condition (trusted verifiers only)
     * @param conditionId The condition ID
     * @param requester The address requesting decryption
     */
    function authorizeDecryption(
        uint256 conditionId,
        address requester
    ) external onlyTrustedVerifier validCondition(conditionId) {
        EncryptionCondition storage condition = conditions[conditionId];

        // Verify the condition is met
        if (!_checkCondition(condition)) revert ConditionNotMet();

        // Prevent double authorization from same verifier
        if (hasAuthorized[conditionId][msg.sender]) revert AlreadyAuthorized();

        // Record authorization
        hasAuthorized[conditionId][msg.sender] = true;
        authorizations[conditionId].push(DecryptionAuthorization({
            requester: requester,
            conditionId: conditionId,
            authorized: true,
            timestamp: block.timestamp
        }));

        emit DecryptionAuthorized(conditionId, requester, condition.encryptedSymmetricKey);
    }

    /**
     * @notice Check if decryption is allowed (threshold met)
     * @param conditionId The condition ID
     */
    function isDecryptionAllowed(uint256 conditionId) external view validCondition(conditionId) returns (bool) {
        EncryptionCondition storage condition = conditions[conditionId];

        // Check if condition is already decrypted
        if (condition.isDecrypted) return true;

        // Check if threshold of authorizations met
        uint256 authCount = authorizations[conditionId].length;
        return authCount >= decryptionThreshold && _checkCondition(condition);
    }

    /**
     * @notice Mark a condition as decrypted (called by off-chain Lit node)
     * @param conditionId The condition ID
     */
    function markDecrypted(uint256 conditionId) external onlyOwner validCondition(conditionId) {
        EncryptionCondition storage condition = conditions[conditionId];

        if (!_checkCondition(condition)) revert ConditionNotMet();
        if (authorizations[conditionId].length < decryptionThreshold) revert DecryptionNotAllowed();

        condition.isDecrypted = true;
        condition.decryptedAt = block.timestamp;
    }

    /**
     * @notice Verify a condition directly (for non-threshold conditions)
     * @param conditionId The condition ID
     */
    function verifyCondition(uint256 conditionId) external validCondition(conditionId) returns (bool) {
        EncryptionCondition storage condition = conditions[conditionId];
        bool result = _checkCondition(condition);

        emit ConditionVerified(conditionId, msg.sender, result);

        return result;
    }

    // ============ Admin Functions ============

    /**
     * @notice Add a trusted verifier
     */
    function addTrustedVerifier(address verifier) external onlyOwner {
        if (verifier == address(0)) revert InvalidAddress();
        if (!isTrustedVerifier[verifier]) {
            isTrustedVerifier[verifier] = true;
            trustedVerifiers.push(verifier);
        }
    }

    /**
     * @notice Remove a trusted verifier
     */
    function removeTrustedVerifier(address verifier) external onlyOwner {
        isTrustedVerifier[verifier] = false;
    }

    /**
     * @notice Update decryption threshold
     */
    function setDecryptionThreshold(uint256 newThreshold) external onlyOwner {
        uint256 oldThreshold = decryptionThreshold;
        decryptionThreshold = newThreshold;
        emit ThresholdUpdated(oldThreshold, newThreshold);
    }

    /**
     * @notice Update reference contracts
     */
    function setContractAddresses(
        address _taskEscrow,
        address _agentRegistry
    ) external onlyOwner {
        taskEscrow = _taskEscrow;
        agentRegistry = _agentRegistry;
    }

    // ============ View Functions ============

    /**
     * @notice Get condition details
     */
    function getCondition(uint256 conditionId) external view validCondition(conditionId) returns (
        ConditionType conditionType,
        uint256 targetId,
        address targetContract,
        bool isDecrypted,
        uint256 createdAt,
        uint256 decryptedAt
    ) {
        EncryptionCondition storage condition = conditions[conditionId];
        return (
            condition.conditionType,
            condition.targetId,
            condition.targetContract,
            condition.isDecrypted,
            condition.createdAt,
            condition.decryptedAt
        );
    }

    /**
     * @notice Get authorization count for a condition
     */
    function getAuthorizationCount(uint256 conditionId) external view validCondition(conditionId) returns (uint256) {
        return authorizations[conditionId].length;
    }

    /**
     * @notice Get all trusted verifiers
     */
    function getTrustedVerifiers() external view returns (address[] memory) {
        return trustedVerifiers;
    }

    // ============ Internal Functions ============

    /**
     * @notice Check if a condition is met
     * @dev This would be extended to call external contracts for condition verification
     */
    function _checkCondition(EncryptionCondition storage condition) internal view returns (bool) {
        if (condition.isDecrypted) return true;

        ConditionType cType = condition.conditionType;

        if (cType == ConditionType.TimeLock) {
            // TimeLock: Check if timestamp has passed
            return block.timestamp >= condition.targetId;
        }

        // For other conditions, we need to check the target contract
        // In production, this would use low-level calls to check state
        // For now, we rely on threshold authorization from trusted verifiers

        return true; // Placeholder - real implementation checks on-chain state
    }
}
