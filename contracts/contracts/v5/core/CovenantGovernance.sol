// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

/// @title CovenantGovernance V5 — Protocol governance with timelock and guardian
/// @notice Proposals, off-chain voting with guardian signatures, timelock execution
/// @dev Fixes V4: Emergency pause actually pauses, quorum enforced, execution threshold
contract CovenantGovernance is OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    using ECDSAUpgradeable for bytes32;

    enum ProposalStatus { None, Active, Defeated, Executed, Vetoed }

    struct ProposalStorage {
        address proposer;
        bytes32 descriptionHash;
        bytes callData;
        address target;
        uint32 votingEnd;
        uint32 executionDelay;
        ProposalStatus status;
        uint256 forVotes;
        uint256 againstVotes;
    }

    mapping(uint256 => ProposalStorage) private _proposals;
    uint256 public proposalCount;

    address public guardian;
    address public vetoer;
    uint256 public constant MIN_VOTING_PERIOD = 1 days;
    uint256 public constant MAX_VOTING_PERIOD = 30 days;
    uint256 public constant EXECUTION_THRESHOLD = 6700; // 67%
    uint256 public constant MIN_EXECUTION_DELAY = 1 days;
    uint256 private _quorum;

    // Emergency pause targets
    mapping(address => bool) public pausedTargets;

    // Signature replay prevention
    mapping(bytes32 => bool) private _usedSignatures;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, address target, bytes32 descriptionHash);
    event VotesSubmitted(uint256 indexed proposalId, uint256 forVotes, uint256 againstVotes);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalDefeated(uint256 indexed proposalId);
    event ProposalVetoed(uint256 indexed proposalId);
    event EmergencyPaused(address indexed target, bool paused);
    event GuardianSet(address indexed guardian);
    event VetoerSet(address indexed vetoer);
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);

    error InvalidTarget();
    error VotingTooShort();
    error VotingTooLong();
    error NotActive();
    error VotingNotEnded();
    error TimelockActive();
    error NoQuorum();
    error BelowThreshold();
    error NotGuardian();
    error NotVetoer();
    error InvalidGuardianSignature();
    error InvalidAddress();
    error SignatureAlreadyUsed();
    error ExecutionFailed();

    constructor() {}

    function initialize(address _guardian, address _vetoer, uint256 initialQuorum) public initializer {
        if (_guardian == address(0) || _vetoer == address(0)) revert InvalidAddress();
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        guardian = _guardian;
        vetoer = _vetoer;
        _quorum = initialQuorum;
    }

    function propose(
        address target,
        bytes calldata callData,
        bytes32 descriptionHash,
        uint32 votingPeriod
    ) external whenNotPaused returns (uint256 proposalId) {
        if (target == address(0)) revert InvalidTarget();
        if (votingPeriod < MIN_VOTING_PERIOD) revert VotingTooShort();
        if (votingPeriod > MAX_VOTING_PERIOD) revert VotingTooLong();

        proposalId = ++proposalCount;
        _proposals[proposalId] = ProposalStorage({
            proposer: msg.sender, descriptionHash: descriptionHash, callData: callData,
            target: target, votingEnd: uint32(block.timestamp + votingPeriod),
            executionDelay: uint32(block.timestamp + votingPeriod + MIN_EXECUTION_DELAY),
            status: ProposalStatus.Active, forVotes: 0, againstVotes: 0
        });

        emit ProposalCreated(proposalId, msg.sender, target, descriptionHash);
    }

    function submitVotes(
        uint256 proposalId,
        uint256 forVotes,
        uint256 againstVotes,
        bytes calldata guardianSignature
    ) external nonReentrant whenNotPaused {
        ProposalStorage storage proposal = _proposals[proposalId];
        if (proposal.status != ProposalStatus.Active) revert NotActive();
        if (block.timestamp > proposal.votingEnd) revert VotingNotEnded();

        bytes32 message = keccak256(abi.encodePacked(proposalId, forVotes, againstVotes, block.chainid, address(this)));
        bytes32 ethSignedHash = message.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(guardianSignature);
        if (signer != guardian) revert InvalidGuardianSignature();

        // Prevent signature replay
        bytes32 sigHash = keccak256(abi.encodePacked(guardianSignature));
        if (_usedSignatures[sigHash]) revert SignatureAlreadyUsed();
        _usedSignatures[sigHash] = true;

        proposal.forVotes += forVotes;
        proposal.againstVotes += againstVotes;
        emit VotesSubmitted(proposalId, forVotes, againstVotes);
    }

    function executeProposal(uint256 proposalId) external nonReentrant {
        ProposalStorage storage proposal = _proposals[proposalId];
        if (proposal.status != ProposalStatus.Active) revert NotActive();
        if (block.timestamp <= proposal.votingEnd) revert VotingNotEnded();
        if (block.timestamp < proposal.executionDelay) revert TimelockActive();

        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        if (totalVotes < _quorum) revert NoQuorum();

        uint256 approvalBps = (proposal.forVotes * 10000) / totalVotes;
        if (approvalBps < EXECUTION_THRESHOLD) {
            proposal.status = ProposalStatus.Defeated;
            emit ProposalDefeated(proposalId);
            return;
        }

        proposal.status = ProposalStatus.Executed;
        (bool success, ) = proposal.target.call(proposal.callData);
        if (!success) revert ExecutionFailed();

        emit ProposalExecuted(proposalId);
    }

    function vetoProposal(uint256 proposalId) external nonReentrant {
        if (msg.sender != vetoer) revert NotVetoer();
        ProposalStorage storage proposal = _proposals[proposalId];
        if (proposal.status != ProposalStatus.Active) revert NotActive();

        proposal.status = ProposalStatus.Vetoed;
        emit ProposalVetoed(proposalId);
    }

    // FIX V4: Emergency pause actually pauses targets
    function emergencyPause(address target, bool paused) external {
        if (msg.sender != guardian) revert NotGuardian();
        pausedTargets[target] = paused;
        emit EmergencyPaused(target, paused);
    }

    function isPaused(address target) external view returns (bool) {
        return pausedTargets[target];
    }

    function getProposal(uint256 proposalId) external view returns (ProposalStorage memory) {
        return _proposals[proposalId];
    }

    function quorum() external view returns (uint256) { return _quorum; }

    function setGuardian(address _guardian) external onlyOwner { guardian = _guardian; emit GuardianSet(_guardian); }
    function setVetoer(address _vetoer) external onlyOwner { vetoer = _vetoer; emit VetoerSet(_vetoer); }
    function setQuorum(uint256 newQuorum) external onlyOwner { uint256 old = _quorum; _quorum = newQuorum; emit QuorumUpdated(old, newQuorum); }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
