// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

interface ICovenantAttestation {
    event AttestationIssued(bytes32 indexed attestationId, address indexed issuer, address indexed subject, bytes32 schemaHash);
    event AttestationRevoked(bytes32 indexed attestationId);
    event SchemaRegistered(bytes32 indexed schemaHash, string name);
    event IssuerRegistered(address indexed issuer, string name);

    function attest(
        address subject,
        bytes32 schemaHash,
        bytes32 dataHash,
        uint32 expiresAt
    ) external returns (bytes32 attestationId);

    function attestBatch(
        address[] calldata subjects,
        bytes32 schemaHash,
        bytes32[] calldata dataHashes,
        uint32 expiresAt
    ) external returns (bytes32[] memory attestationIds);

    function revoke(bytes32 attestationId) external;
    function verify(bytes32 attestationId) external view returns (bool valid, Attestation memory attestation);
    function getAgentAttestations(address agent) external view returns (bytes32[] memory);
    function registerSchema(bytes32 schemaHash, string calldata name) external;
    function registerIssuer(address issuer, string calldata name) external;
    function isIssuer(address issuer) external view returns (bool);

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
