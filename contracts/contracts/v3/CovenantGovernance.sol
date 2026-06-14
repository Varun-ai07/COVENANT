// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "./interfaces/ICovenantGovernance.sol";

/// @title CovenantGovernance V3 - Protocol governance: propose, vote (off-chain), execute
contract CovenantGovernance is
    ICovenantGovernance,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable
{
    using ECDSAUpgradeable for bytes32;

    struct ProposalStorage {
        address proposer;
        bytes32 descriptionHash;
        bytes callData;
        address target;
        uint32 votingEnd;
        ICovenantGovernance.ProposalStatus status;
        uint256 forVotes;
        uint256 againstVotes;
    }

    mapping(uint256 => ProposalStorage) private _proposals;
    uint256 public override proposalCount;

    address public guardian;
    uint256 public constant MIN_VOTING_PERIOD = 1 days;
    uint256 public constant MAX_VOTING_PERIOD = 30 days;
    uint256 public constant EXECUTION_THRESHOLD = 6700;
    uint256 private _quorum;

    bytes32 private constant PROPOSAL_TYPEHASH =
        keccak256("Proposal(address target,bytes callData,bytes32 descriptionHash,uint32 votingEnd)");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(address _guardian, uint256 initialQuorum) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __EIP712_init("CovenantGovernance", "1");
        guardian = _guardian;
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
        bytes calldata aggregatedSignature
    ) external override nonReentrant {
        ProposalStorage storage proposal = _proposals[proposalId];
        require(proposal.status == ICovenantGovernance.ProposalStatus.Active, "not active");
        require(block.timestamp <= proposal.votingEnd, "voting ended");

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    PROPOSAL_TYPEHASH,
                    proposal.target,
                    keccak256(proposal.callData),
                    proposal.descriptionHash,
                    proposal.votingEnd
                )
            )
        );

        bytes32 ethSignedHash = digest.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(aggregatedSignature);
        require(signer == guardian, "invalid guardian signature");

        proposal.forVotes += forVotes;
        proposal.againstVotes += againstVotes;

        emit VotesSubmitted(proposalId, forVotes, againstVotes);
    }

    function executeProposal(uint256 proposalId) external override nonReentrant {
        ProposalStorage storage proposal = _proposals[proposalId];
        require(proposal.status == ICovenantGovernance.ProposalStatus.Active, "not active");
        require(block.timestamp > proposal.votingEnd, "voting not ended");

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
