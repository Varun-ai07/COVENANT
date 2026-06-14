// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

library Types {
    enum TaskStatus { None, Created, Funded, Submitted, Disputed, Completed, Failed, Cancelled }

    enum DisputeRuling { None, ClientWins, WorkerWins, Split }

    struct Task {
        address client;
        address worker;
        uint128 amount;
        uint32 deadline;
        TaskStatus status;
        uint8 disputeCount;
        bytes32 metaHash;
    }

    struct Capability {
        bytes32 capabilityHash;
        uint32 expiry;
        uint128 valueLimit;
        bool revoked;
    }

    struct ReceiptEnvelope {
        address agent;
        uint256 sessionId;
        uint256 nonce;
        uint256 timestamp;
        bytes32 actionHash;
        uint8 actionType;
    }

    struct Attestation {
        address issuer;
        address subject;
        bytes32 schemaHash;
        bytes32 dataHash;
        uint32 issuedAt;
        uint32 expiresAt;
        bool revoked;
    }
}
