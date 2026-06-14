// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

interface ICovenantGovernance {
    enum ProposalStatus { Pending, Active, Executed, Defeated, Vetoed }

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, address target, bytes32 descriptionHash);
    event VotesSubmitted(uint256 indexed proposalId, uint256 forVotes, uint256 againstVotes);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalDefeated(uint256 indexed proposalId);
    event ProposalVetoed(uint256 indexed proposalId);
    event EmergencyPaused(address indexed target, bool paused);

    function propose(
        address target,
        bytes calldata callData,
        bytes32 descriptionHash,
        uint32 votingPeriod
    ) external returns (uint256 proposalId);

    function submitVotes(
        uint256 proposalId,
        uint256 forVotes,
        uint256 againstVotes,
        bytes calldata aggregatedSignature
    ) external;

    function executeProposal(uint256 proposalId) external;
    function vetoProposal(uint256 proposalId) external;
    function emergencyPause(address target, bool paused) external;
    function getProposal(uint256 proposalId) external view returns (Proposal memory);
    function proposalCount() external view returns (uint256);
    function quorum() external view returns (uint256);

    struct Proposal {
        address proposer;
        bytes32 descriptionHash;
        bytes callData;
        address target;
        uint32 votingEnd;
        uint32 executionDelay;
        uint8 status;
        uint256 forVotes;
        uint256 againstVotes;
    }
}
