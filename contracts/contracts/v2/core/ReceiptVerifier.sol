// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReceiptVerifier
 * @notice ERC-8004 compliant on-chain attestation/receipt system (v2)
 * @dev Deterministic receipt IDs, enum types, no unbounded arrays, batch verify.
 */
contract ReceiptVerifier is Ownable {
    // ─── Enums ──────────────────────────────────────────────────────────
    enum ReceiptType {
        TaskCompletion,
        AgentVerified,
        CapabilityProven,
        ReputationVerified,
        DisputeResolved,
        InsuranceClaimed
    }

    // ─── Structs ────────────────────────────────────────────────────────
    struct Receipt {
        bytes32 receiptId;
        address issuer;
        address counterparty;
        ReceiptType receiptType;
        bytes32 dataHash;
        uint256 timestamp;
        bool isValid;
    }

    // ─── State ──────────────────────────────────────────────────────────
    mapping(bytes32 => Receipt) public receipts;
    uint256 public receiptCount;
    mapping(address => bool) public authorizedIssuers;

    // ─── Events ─────────────────────────────────────────────────────────
    event ReceiptCreated(
        bytes32 indexed receiptId,
        address indexed issuer,
        address indexed counterparty,
        ReceiptType receiptType,
        uint256 timestamp
    );
    event ReceiptInvalidated(bytes32 indexed receiptId, uint256 timestamp);

    // ─── Constructor ────────────────────────────────────────────────────
    constructor() Ownable(msg.sender) {}

    // ─── Modifiers ──────────────────────────────────────────────────────
    modifier onlyAuthorized() {
        require(
            authorizedIssuers[msg.sender] || msg.sender == owner(),
            "Not authorized issuer"
        );
        _;
    }

    // ─── External / Public ──────────────────────────────────────────────

    /**
     * @notice Create a new attestation receipt (ERC-8004)
     * @param issuer       Agent issuing the receipt
     * @param counterparty Other party in the interaction
     * @param receiptType  Enum receipt type
     * @param dataHash     Hash of attested off-chain data
     * @return receiptId   Deterministic receipt identifier
     */
    function createReceipt(
        address issuer,
        address counterparty,
        ReceiptType receiptType,
        bytes32 dataHash
    ) external onlyAuthorized returns (bytes32 receiptId) {
        require(issuer != address(0), "Invalid issuer");
        require(counterparty != address(0), "Invalid counterparty");

        // Deterministic ID -- no block.timestamp or block.number
        receiptId = keccak256(
            abi.encodePacked(
                issuer,
                counterparty,
                receiptType,
                dataHash,
                receiptCount
            )
        );

        receipts[receiptId] = Receipt({
            receiptId: receiptId,
            issuer: issuer,
            counterparty: counterparty,
            receiptType: receiptType,
            dataHash: dataHash,
            timestamp: block.timestamp,
            isValid: true
        });

        receiptCount++;

        emit ReceiptCreated(
            receiptId,
            issuer,
            counterparty,
            receiptType,
            block.timestamp
        );
    }

    /**
     * @notice Retrieve a receipt by its deterministic ID
     */
    function getReceipt(bytes32 receiptId) external view returns (Receipt memory) {
        return receipts[receiptId];
    }

    /**
     * @notice Verify a single receipt is valid
     * @return True if the receipt exists and has not been invalidated
     */
    function verifyReceipt(bytes32 receiptId) external view returns (bool) {
        Receipt storage r = receipts[receiptId];
        return r.isValid && r.timestamp > 0;
    }

    /**
     * @notice Batch verify multiple receipts in a single call
     * @param receiptIds Array of receipt IDs to verify
     * @return results   Parallel array of validity booleans
     */
    function batchVerifyReceipts(
        bytes32[] calldata receiptIds
    ) external view returns (bool[] memory results) {
        results = new bool[](receiptIds.length);
        for (uint256 i = 0; i < receiptIds.length; ) {
            Receipt storage r = receipts[receiptIds[i]];
            results[i] = r.isValid && r.timestamp > 0;
            unchecked { ++i; }
        }
    }

    /**
     * @notice Invalidate a receipt (owner only)
     */
    function invalidateReceipt(bytes32 receiptId) external onlyOwner {
        Receipt storage r = receipts[receiptId];
        require(r.timestamp > 0, "Receipt not found");
        require(r.isValid, "Already invalidated");

        r.isValid = false;
        emit ReceiptInvalidated(receiptId, block.timestamp);
    }

    /**
     * @notice Authorize an address to create receipts
     */
    function addAuthorizedIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = true;
    }

    /**
     * @notice Revoke receipt-creation authorization
     */
    function removeAuthorizedIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
    }
}
