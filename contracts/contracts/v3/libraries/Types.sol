// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

library Types {
    enum TaskStatus {
        None,
        Created,
        Funded,
        Submitted,
        Disputed,
        Completed,
        Failed,
        Cancelled
    }

    enum DisputeRuling {
        None,
        ClientWins,
        WorkerWins,
        Split
    }

    struct Task {
        address client;
        address worker;
        uint128 amount;
        uint32 deadline;
        TaskStatus status;
        uint8 disputeCount;
        bytes32 metaHash;
    }

    struct Delegation {
        address delegate;
        bytes32 permissionHash;
        uint32 expiry;
        uint128 valueLimit;
        bool revoked;
    }

    struct PaymentStream {
        address payer;
        address payee;
        uint128 ratePerSecond;
        uint32 startTime;
        uint32 endTime;
        uint128 deposited;
        uint128 streamed;
        bool active;
    }

    struct Dispute {
        uint256 taskId;
        address disputant;
        DisputeRuling ruling;
        uint8 splitBps;
        uint32 createdAt;
        bytes32 evidenceHash;
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

    struct Proposal {
        address proposer;
        bytes32 descriptionHash;
        bytes callData;
        address target;
        uint32 votingEnd;
        uint8 status;
        uint256 forVotes;
        uint256 againstVotes;
    }
}
