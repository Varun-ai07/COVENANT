// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title CovenantAttestation V5 — Verifiable credentials with batch support
/// @notice Schema-based attestations with issuer authorization
contract CovenantAttestation is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {
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
    mapping(address => bool) public isIssuer;

    uint256 public attestationCount;
    uint256 public constant MAX_BATCH_SIZE = 100;

    event AttestationIssued(bytes32 indexed attestationId, address indexed issuer, address indexed subject, bytes32 schemaHash);
    event AttestationRevoked(bytes32 indexed attestationId);
    event IssuerRegistered(address indexed issuer, string name);
    event SchemaRegistered(bytes32 indexed schemaHash, string name);

    error NotAuthorizedIssuer();
    error InvalidSubject();
    error SchemaNotRegistered();
    error AlreadyExpired();
    error AttestationNotFound();
    error AlreadyRevoked();
    error Unauthorized();
    error BatchTooLarge();
    error BatchLengthMismatch();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize() public initializer { __Ownable_init(); __ReentrancyGuard_init(); __Pausable_init(); __UUPSUpgradeable_init(); }

    function attest(
        address subject,
        bytes32 schemaHash,
        bytes32 dataHash,
        uint32 expiresAt
    ) external whenNotPaused returns (bytes32 attestationId) {
        if (!isIssuer[msg.sender]) revert NotAuthorizedIssuer();
        if (subject == address(0)) revert InvalidSubject();
        if (!schemas[schemaHash]) revert SchemaNotRegistered();
        if (expiresAt <= block.timestamp) revert AlreadyExpired();

        attestationId = keccak256(abi.encodePacked(
            msg.sender, subject, schemaHash, dataHash, block.timestamp, attestationCount
        ));

        unchecked { attestationCount++; }

        _attestations[attestationId] = AttestationStorage({
            issuer: msg.sender, subject: subject, schemaHash: schemaHash,
            dataHash: dataHash, issuedAt: uint32(block.timestamp), expiresAt: expiresAt, revoked: false
        });

        _agentAttestations[subject].push(attestationId);
        emit AttestationIssued(attestationId, msg.sender, subject, schemaHash);
    }

    function attestBatch(
        address[] calldata subjects,
        bytes32 schemaHash,
        bytes32[] calldata dataHashes,
        uint32 expiresAt
    ) external whenNotPaused returns (bytes32[] memory attestationIds) {
        if (!isIssuer[msg.sender]) revert NotAuthorizedIssuer();
        if (subjects.length != dataHashes.length) revert BatchLengthMismatch();
        if (subjects.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        if (!schemas[schemaHash]) revert SchemaNotRegistered();
        if (expiresAt <= block.timestamp) revert AlreadyExpired();

        attestationIds = new bytes32[](subjects.length);
        for (uint256 i = 0; i < subjects.length; i++) {
            if (subjects[i] == address(0)) revert InvalidSubject();

            bytes32 id = keccak256(abi.encodePacked(
                msg.sender, subjects[i], schemaHash, dataHashes[i], block.timestamp, attestationCount
            ));
            unchecked { attestationCount++; }

            _attestations[id] = AttestationStorage({
                issuer: msg.sender, subject: subjects[i], schemaHash: schemaHash,
                dataHash: dataHashes[i], issuedAt: uint32(block.timestamp), expiresAt: expiresAt, revoked: false
            });

            _agentAttestations[subjects[i]].push(id);
            attestationIds[i] = id;
            emit AttestationIssued(id, msg.sender, subjects[i], schemaHash);
        }
    }

    function revoke(bytes32 attestationId) external nonReentrant {
        AttestationStorage storage att = _attestations[attestationId];
        if (att.issuer == address(0)) revert AttestationNotFound();
        if (msg.sender != att.issuer && msg.sender != owner()) revert Unauthorized();
        if (att.revoked) revert AlreadyRevoked();

        att.revoked = true;
        emit AttestationRevoked(attestationId);
    }

    function verify(bytes32 attestationId) external view returns (bool valid, AttestationStorage memory attestation) {
        AttestationStorage storage att = _attestations[attestationId];
        if (att.issuer == address(0)) revert AttestationNotFound();

        valid = !att.revoked && block.timestamp <= att.expiresAt;
        attestation = att;
    }

    function getAgentAttestations(address agent) external view returns (bytes32[] memory) {
        return _agentAttestations[agent];
    }

    function registerSchema(bytes32 schemaHash, string calldata) external onlyOwner { schemas[schemaHash] = true; }
    function registerIssuer(address issuer, string calldata) external onlyOwner { isIssuer[issuer] = true; emit IssuerRegistered(issuer, ""); }
    function revokeIssuer(address issuer) external onlyOwner { isIssuer[issuer] = false; }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    uint256[50] private __gap;
}
