// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "./interfaces/ICovenantAttestation.sol";

/// @title CovenantAttestation V4 - Verifiable credentials, receipts, reputation proofs
contract CovenantAttestation is
    ICovenantAttestation,
    OwnableUpgradeable
{
    using ECDSAUpgradeable for bytes32;

    struct AttestationStorage {
        address issuer;
        address subject;
        bytes32 schemaHash;
        bytes32 dataHash;
        uint32 issuedAt;
        uint32 expiresAt;
        bool revoked;
    }

    mapping(bytes32 => AttestationStorage) private _attestations;
    mapping(address => bytes32[]) private _agentAttestations;
    mapping(bytes32 => bool) public schemas;
    mapping(address => bool) public override isIssuer;

    uint256 public attestationCount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize() public initializer {
        __Ownable_init();
    }

    function attest(
        address subject,
        bytes32 schemaHash,
        bytes32 dataHash,
        uint32 expiresAt
    ) external override returns (bytes32 attestationId) {
        require(isIssuer[msg.sender], "not authorized issuer");
        require(subject != address(0), "invalid subject");
        require(schemas[schemaHash], "schema not registered");
        require(expiresAt > block.timestamp, "already expired");

        attestationId = keccak256(
            abi.encodePacked(
                msg.sender,
                subject,
                schemaHash,
                dataHash,
                block.timestamp,
                attestationCount
            )
        );

        unchecked {
            attestationCount++;
        }

        _attestations[attestationId] = AttestationStorage({
            issuer: msg.sender,
            subject: subject,
            schemaHash: schemaHash,
            dataHash: dataHash,
            issuedAt: uint32(block.timestamp),
            expiresAt: expiresAt,
            revoked: false
        });

        _agentAttestations[subject].push(attestationId);

        emit AttestationIssued(attestationId, msg.sender, subject, schemaHash);
    }

    function attestBatch(
        address[] calldata subjects,
        bytes32 schemaHash,
        bytes32[] calldata dataHashes,
        uint32 expiresAt
    ) external override returns (bytes32[] memory attestationIds) {
        require(isIssuer[msg.sender], "not authorized issuer");
        require(subjects.length == dataHashes.length, "length mismatch");
        require(schemas[schemaHash], "schema not registered");
        require(expiresAt > block.timestamp, "already expired");

        attestationIds = new bytes32[](subjects.length);

        for (uint256 i = 0; i < subjects.length; i++) {
            require(subjects[i] != address(0), "invalid subject");

            bytes32 id = keccak256(
                abi.encodePacked(
                    msg.sender,
                    subjects[i],
                    schemaHash,
                    dataHashes[i],
                    block.timestamp,
                    attestationCount
                )
            );

            unchecked {
                attestationCount++;
            }

            _attestations[id] = AttestationStorage({
                issuer: msg.sender,
                subject: subjects[i],
                schemaHash: schemaHash,
                dataHash: dataHashes[i],
                issuedAt: uint32(block.timestamp),
                expiresAt: expiresAt,
                revoked: false
            });

            _agentAttestations[subjects[i]].push(id);
            attestationIds[i] = id;

            emit AttestationIssued(id, msg.sender, subjects[i], schemaHash);
        }
    }

    function revoke(bytes32 attestationId) external override {
        AttestationStorage storage att = _attestations[attestationId];
        require(att.issuer != address(0), "attestation not found");
        require(msg.sender == att.issuer || msg.sender == owner(), "unauthorized");
        require(!att.revoked, "already revoked");

        att.revoked = true;
        emit AttestationRevoked(attestationId);
    }

    function verify(
        bytes32 attestationId
    ) external view override returns (bool valid, Attestation memory attestation) {
        AttestationStorage storage att = _attestations[attestationId];
        require(att.issuer != address(0), "attestation not found");

        valid = !att.revoked && block.timestamp <= att.expiresAt;
        attestation = Attestation({
            issuer: att.issuer,
            subject: att.subject,
            schemaHash: att.schemaHash,
            dataHash: att.dataHash,
            issuedAt: att.issuedAt,
            expiresAt: att.expiresAt,
            revoked: att.revoked
        });
    }

    function getAgentAttestations(address agent) external view override returns (bytes32[] memory) {
        return _agentAttestations[agent];
    }

    function registerSchema(bytes32 schemaHash, string calldata) external override onlyOwner {
        schemas[schemaHash] = true;
    }

    function registerIssuer(address issuer, string calldata) external override onlyOwner {
        isIssuer[issuer] = true;
        emit IssuerRegistered(issuer, "");
    }
}
