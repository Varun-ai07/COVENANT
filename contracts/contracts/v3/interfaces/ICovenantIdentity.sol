// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

interface ICovenantIdentity {
    struct AgentRecord {
        address owner;
        uint96 stake;
        uint16 reputation;
        uint32 registeredAt;
        uint32 lastActivity;
        bool active;
        bytes32 metadataRoot;
    }

    event AgentRegistered(address indexed agent, uint96 stake);
    event AgentDeactivated(address indexed agent);
    event AgentMetadataUpdated(address indexed agent, bytes32 newRoot);
    event ReputationRootUpdated(bytes32 newRoot, uint256 epoch);
    event StakeIncreased(address indexed agent, uint96 additionalStake);
    event StakeWithdrawn(address indexed agent, uint96 amount);

    function register(uint96 stake, bytes32 metadataRoot) external payable;
    function deactivate() external;
    function updateMetadata(bytes32 newRoot) external;
    function increaseStake() external payable;
    function withdrawStake(uint96 amount) external;
    function updateReputationRoot(bytes32 newRoot, uint256 epoch, bytes calldata signature) external;
    function isRegistered(address agent) external view returns (bool);
    function getAgent(address agent) external view returns (AgentRecord memory);
    function reputationRoot() external view returns (bytes32);
    function reputationEpoch() external view returns (uint256);
    function totalAgents() external view returns (uint256);
    function minimumStake() external view returns (uint96);
}
