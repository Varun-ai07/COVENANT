// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "./interfaces/ICovenantGovernance.sol";

/// @title CovenantGovernance V4 - Protocol governance: propose, vote (off-chain), execute with timelock
contract CovenantGovernance is
    ICovenantGovernance,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using ECDSAUpgradeable for bytes32;

    struct ProposalStorage {
        address proposer;
        bytes32 descriptionHash;
        bytes callData;
        address target;
        uint32 votingEnd;
        uint32 executionDelay;
        ICovenantGovernance.ProposalStatus status;
        uint256 forVotes;
        uint256 againstVotes;
    }

    mapping(uint256 => ProposalStorage) private _proposals;
    uint256 public override proposalCount;

    address public guardian;
    address public vetoer;
    uint256 public constant MIN_VOTING_PERIOD = 1 days;
    uint256 public constant MAX_VOTING_PERIOD = 30 days;
    uint256 public constant EXECUTION_THRESHOLD = 6700;
    uint256 public constant MIN_EXECUTION_DELAY = 1 days;
    uint256 private _quorum;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(address _guardian, address _vetoer, uint256 initialQuorum) public initializer {
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
    ) external override whenNotPaused returns (uint256 proposalId) {
        require(target != address(0), "invalid target");
        require(votingPeriod >= MIN_VOTING_PERIOD, "voting too short");
        require(votingPeriod <= MAX_VOTING_PERIOD, "voting too long");

        proposalId = ++proposalCount;

        _proposals[proposalId] = ProposalStorage({
            proposer: msg.sender,
            descriptionHash: descriptionHash,
            callData: callData,
            target: target,
            votingEnd: uint32(block.timestamp + votingPeriod),
            executionDelay: uint32(block.timestamp + votingPeriod + MIN_EXECUTION_DELAY),
            status: ICovenantGovernance.ProposalStatus.Active,
            forVotes: 0,
            againstVotes: 0
        });

        emit ProposalCreated(proposalId, msg.sender, target, descriptionHash);
    }

    function submitVotes(
        uint256 proposalId,
        uint256 forVotes,
        uint256 againstVotes,
        bytes calldata guardianSignature
    ) external override nonReentrant {
        ProposalStorage storage proposal = _proposals[proposalId];
        require(proposal.status == ICovenantGovernance.ProposalStatus.Active, "not active");
        require(block.timestamp <= proposal.votingEnd, "voting ended");

        bytes32 message = keccak256(
            abi.encodePacked(proposalId, forVotes, againstVotes, block.chainid)
        );
        bytes32 ethSignedHash = message.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(guardianSignature);
        require(signer == guardian, "invalid guardian signature");

        proposal.forVotes += forVotes;
        proposal.againstVotes += againstVotes;

        emit VotesSubmitted(proposalId, forVotes, againstVotes);
    }

    function executeProposal(uint256 proposalId) external override nonReentrant {
        ProposalStorage storage proposal = _proposals[proposalId];
        require(proposal.status == ICovenantGovernance.ProposalStatus.Active, "not active");
        require(block.timestamp > proposal.votingEnd, "voting not ended");
        require(block.timestamp >= proposal.executionDelay, "timelock active");

        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        require(totalVotes >= _quorum, "no quorum");

        uint256 approvalBps = (proposal.forVotes * 10000) / totalVotes;

        if (approvalBps < EXECUTION_THRESHOLD) {
            proposal.status = ICovenantGovernance.ProposalStatus.Defeated;
            emit ProposalDefeated(proposalId);
            return;
        }

        proposal.status = ICovenantGovernance.ProposalStatus.Executed;

        (bool success, ) = proposal.target.call(proposal.callData);
        require(success, "execution failed");

        emit ProposalExecuted(proposalId);
    }

    function vetoProposal(uint256 proposalId) external override nonReentrant {
        require(msg.sender == vetoer, "not vetoer");
        ProposalStorage storage proposal = _proposals[proposalId];
        require(proposal.status == ICovenantGovernance.ProposalStatus.Active, "not active");

        proposal.status = ICovenantGovernance.ProposalStatus.Vetoed;
        emit ProposalVetoed(proposalId);
    }

    function emergencyPause(address target, bool paused) external override {
        require(msg.sender == guardian, "not guardian");
        emit EmergencyPaused(target, paused);
    }

    function getProposal(uint256 proposalId) external view override returns (Proposal memory) {
        ProposalStorage storage p = _proposals[proposalId];
        return Proposal({
            proposer: p.proposer,
            descriptionHash: p.descriptionHash,
            callData: p.callData,
            target: p.target,
            votingEnd: p.votingEnd,
            executionDelay: p.executionDelay,
            status: uint8(p.status),
            forVotes: p.forVotes,
            againstVotes: p.againstVotes
        });
    }

    function quorum() external view override returns (uint256) {
        return _quorum;
    }

    function setGuardian(address _guardian) external onlyOwner {
        guardian = _guardian;
    }

    function setVetoer(address _vetoer) external onlyOwner {
        vetoer = _vetoer;
    }

    function setQuorum(uint256 newQuorum) external onlyOwner {
        _quorum = newQuorum;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
