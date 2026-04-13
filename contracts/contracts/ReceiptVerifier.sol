// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReceiptVerifier
 * @notice ERC-8004 compliant on-chain attestation/receipt system
 * @dev Provides verifiable interaction receipts for the agent economy
 */
contract ReceiptVerifier is Ownable {
    // Events
    event ReceiptCreated(
        uint256 indexed receiptId,
        address indexed issuer,
        address indexed counterparty,
        string interactionType,
        bytes32 dataHash
    );
    event ReceiptVerified(uint256 indexed receiptId, bool isValid);

    enum ReceiptType {
        TaskCompletion,
        ServiceDelivery,
        DisputeResolution,
        ReputationAttestation,
        Custom
    }

    struct Receipt {
        bytes32 receiptId;          // Unique receipt identifier
        address issuer;             // Who created the receipt
        address counterparty;       // The other party
        string interactionType;     // Type of interaction (e.g., "task_completion")
        bytes32 dataHash;           // Hash of attested data
        uint256 timestamp;          // When the receipt was created
        uint256 blockNumber;        // Block number for verification
        bool isValid;               // Whether the receipt is still valid
    }

    // Storage
    mapping(bytes32 => Receipt) public receipts;
    mapping(address => bytes32[]) public agentReceipts;
    uint256 public receiptCount;

    // Authorized contracts that can create receipts
    mapping(address => bool) public authorizedIssuers;

    constructor() Ownable(msg.sender) {}

    modifier onlyAuthorized() {
        require(
            authorizedIssuers[msg.sender] || msg.sender == owner(),
            "Not authorized issuer"
        );
        _;
    }

    /**
     * @notice Create a new attestation receipt (ERC-8004)
     * @param issuer The agent issuing the receipt
     * @param counterparty The other party in the interaction
     * @param interactionType Description of the interaction type
     * @param dataHash Hash of the attested data
     * @return receiptId The unique receipt identifier
     */
    function createReceipt(
        address issuer,
        address counterparty,
        string calldata interactionType,
        bytes32 dataHash
    ) external onlyAuthorized returns (bytes32) {
        require(issuer != address(0), "Invalid issuer");
        require(counterparty != address(0), "Invalid counterparty");
        require(bytes(interactionType).length > 0, "Type required");

        // Generate unique receipt ID
        bytes32 receiptId = keccak256(
            abi.encodePacked(
                issuer,
                counterparty,
                interactionType,
                dataHash,
                block.timestamp,
                block.number,
                receiptCount
            )
        );

        // Store receipt
        receipts[receiptId] = Receipt({
            receiptId: receiptId,
            issuer: issuer,
            counterparty: counterparty,
            interactionType: interactionType,
            dataHash: dataHash,
            timestamp: block.timestamp,
            blockNumber: block.number,
            isValid: true
        });

        // Index by agent (both issuer and counterparty)
        agentReceipts[issuer].push(receiptId);
        agentReceipts[counterparty].push(receiptId);

        receiptCount++;

        emit ReceiptCreated(
            receiptCount,
            issuer,
            counterparty,
            interactionType,
            dataHash
        );

        return receiptId;
    }

    /**
     * @notice Verify a receipt exists and is valid
     * @param receiptId The receipt identifier
     * @return isValid Whether the receipt is valid
     * @return receipt The receipt data
     */
    function verifyReceipt(
        bytes32 receiptId
    ) external view returns (bool isValid, Receipt memory receipt) {
        receipt = receipts[receiptId];
        isValid = receipt.isValid && receipt.timestamp > 0;
        return (isValid, receipt);
    }

    /**
     * @notice Get all receipts for an agent
     * @param agent The agent address
     * @return Array of receipt IDs
     */
    function getReceiptsByAgent(
        address agent
    ) external view returns (bytes32[] memory) {
        return agentReceipts[agent];
    }

    /**
     * @notice Get receipt count for an agent
     */
    function getAgentReceiptCount(address agent) external view returns (uint256) {
        return agentReceipts[agent].length;
    }

    /**
     * @notice Get a specific receipt by ID
     */
    function getReceipt(bytes32 receiptId) external view returns (Receipt memory) {
        return receipts[receiptId];
    }

    /**
     * @notice Invalidate a receipt (only issuer or owner)
     */
    function invalidateReceipt(bytes32 receiptId) external {
        Receipt storage receipt = receipts[receiptId];
        require(receipt.timestamp > 0, "Receipt not found");
        require(
            receipt.issuer == msg.sender || msg.sender == owner(),
            "Not authorized"
        );

        receipt.isValid = false;
    }

    /**
     * @notice Add an authorized issuer (contract that can create receipts)
     */
    function addAuthorizedIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = true;
    }

    /**
     * @notice Remove an authorized issuer
     */
    function removeAuthorizedIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
    }

    /**
     * @notice Batch verify multiple receipts
     */
    function batchVerifyReceipts(
        bytes32[] calldata receiptIds
    ) external view returns (bool[] memory results) {
        results = new bool[](receiptIds.length);
        for (uint256 i = 0; i < receiptIds.length; i++) {
            Receipt memory receipt = receipts[receiptIds[i]];
            results[i] = receipt.isValid && receipt.timestamp > 0;
        }
        return results;
    }
}
