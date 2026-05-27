// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentRegistry v2
 * @notice Minimal agent identity + staking. Capabilities stored as bytes32 hashes.
 * Discovery, reputation computation, and profiles are offchain.
 */
contract AgentRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant AUTHORIZED_ROLE = keccak256("AUTHORIZED_ROLE");

    uint256 public constant MIN_STAKE = 0.001 ether;
    uint256 public constant REPUTATION_COOLDOWN = 1 hours;

    struct Agent {
        bytes32 did;
        address wallet;
        uint16 reputation;           // 0-1000
        uint8 isActive;
        uint32 tasksCompleted;
        uint16 tasksFailed;
        uint96 stakedAmount;
        uint48 registeredAt;
        uint48 lastTaskAt;
        uint128 totalValueTransacted;
    }

    mapping(address => Agent) public agents;
    mapping(address => mapping(bytes32 => bool)) private _hasCapability;
    uint256 public agentCount;
    mapping(address => uint256) public lastReputationUpdate;

    // ZK verifier references
    address public groth16Verifier;
    address public capabilityVerifier;
    mapping(bytes32 => bool) public usedNullifiers;

    event AgentRegistered(address indexed agent, bytes32 indexed did, uint256 timestamp);
    event ReputationUpdated(address indexed agent, int256 delta, uint16 newReputation);
    event AgentDeactivated(address indexed agent, uint256 timestamp);
    event StakeAdded(address indexed agent, uint256 amount);
    event StakeSlashed(address indexed agent, uint256 amount, string reason);
    event TaskRecorded(address indexed agent, uint256 value, bool success);

    constructor(address _groth16Verifier, address _capabilityVerifier) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AUTHORIZED_ROLE, msg.sender);
        groth16Verifier = _groth16Verifier;
        capabilityVerifier = _capabilityVerifier;
    }

    // ─── Registration ──────────────────────────────────────────

    function register(string calldata name, string[] calldata capabilities) external payable nonReentrant {
        require(agents[msg.sender].isActive == 0, "Already registered");
        require(msg.value >= MIN_STAKE, "Insufficient stake");

        bytes32 did = keccak256(abi.encodePacked(msg.sender, block.chainid));

        for (uint256 i = 0; i < capabilities.length; i++) {
            bytes32 capHash = keccak256(bytes(capabilities[i]));
            _hasCapability[msg.sender][capHash] = true;
        }

        agents[msg.sender] = Agent({
            did: did,
            wallet: msg.sender,
            reputation: 500,
            isActive: 1,
            tasksCompleted: 0,
            tasksFailed: 0,
            stakedAmount: uint96(msg.value),
            registeredAt: uint48(block.timestamp),
            lastTaskAt: 0,
            totalValueTransacted: 0
        });

        agentCount++;
        emit AgentRegistered(msg.sender, did, block.timestamp);
    }

    function addStake() external payable nonReentrant {
        require(agents[msg.sender].isActive == 1, "Not registered");
        agents[msg.sender].stakedAmount += uint96(msg.value);
        emit StakeAdded(msg.sender, msg.value);
    }

    function deactivate() external nonReentrant {
        Agent storage agent = agents[msg.sender];
        require(agent.isActive == 1, "Not active");

        agent.isActive = 0;
        uint256 stake = agent.stakedAmount;
        agent.stakedAmount = 0;

        emit AgentDeactivated(msg.sender, block.timestamp);

        if (stake > 0) {
            (bool sent, ) = payable(msg.sender).call{value: stake}("");
            require(sent, "Stake refund failed");
        }
    }

    // ─── Authorized Operations ─────────────────────────────────

    function updateReputation(address agent, int256 delta) external onlyRole(AUTHORIZED_ROLE) {
        require(agents[agent].isActive == 1, "Agent not active");
        require(block.timestamp >= lastReputationUpdate[agent] + REPUTATION_COOLDOWN, "Cooldown");

        lastReputationUpdate[agent] = block.timestamp;

        int256 newRep = int256(uint256(agents[agent].reputation)) + delta;
        if (newRep < 0) newRep = 0;
        if (newRep > 1000) newRep = 1000;

        agents[agent].reputation = uint16(uint256(newRep));
        emit ReputationUpdated(agent, delta, uint16(uint256(newRep)));
    }

    function recordTaskCompletion(address agent, bool success, uint256 value) external onlyRole(AUTHORIZED_ROLE) {
        require(agents[agent].isActive == 1, "Agent not active");

        if (success) {
            agents[agent].tasksCompleted++;
        } else {
            agents[agent].tasksFailed++;
        }
        agents[agent].totalValueTransacted = agents[agent].totalValueTransacted + uint128(value);
        agents[agent].lastTaskAt = uint48(block.timestamp);

        emit TaskRecorded(agent, value, success);
    }

    function slashStake(address agent, uint256 amount, string calldata reason) external onlyRole(AUTHORIZED_ROLE) {
        require(agents[agent].stakedAmount >= amount, "Insufficient stake");
        agents[agent].stakedAmount -= uint96(amount);
        emit StakeSlashed(agent, amount, reason);
    }

    // ─── View Functions ────────────────────────────────────────

    function getAgent(address agent) external view returns (
        bytes32 did, address wallet, uint16 reputation, uint8 isActive,
        uint32 tasksCompleted, uint16 tasksFailed, uint96 stakedAmount,
        uint48 registeredAt, uint128 totalValueTransacted
    ) {
        Agent storage a = agents[agent];
        return (a.did, a.wallet, a.reputation, a.isActive, a.tasksCompleted,
                a.tasksFailed, a.stakedAmount, a.registeredAt, a.totalValueTransacted);
    }

    function hasCapability(address agent, bytes32 capabilityHash) external view returns (bool) {
        return _hasCapability[agent][capabilityHash];
    }

    function getAgentsPaginated(uint256 offset, uint256 limit) external view returns (address[] memory) {
        // Returns agents from event-indexed data
        // In production, use The Graph for this query
        // This is a fallback that iterates (limited to small sets)
        require(limit <= 100, "Limit too high");
        return new address[](0); // Placeholder - use The Graph indexer
    }

    function isActive(address agent) external view returns (bool) {
        return agents[agent].isActive == 1;
    }

    function getReputation(address agent) external view returns (uint16) {
        return agents[agent].reputation;
    }

    // ─── Admin ─────────────────────────────────────────────────

    function setGroth16Verifier(address _verifier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        groth16Verifier = _verifier;
    }

    function setCapabilityVerifier(address _verifier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        capabilityVerifier = _verifier;
    }

    function addAuthorizedContract(address contractAddr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(AUTHORIZED_ROLE, contractAddr);
    }

    function removeAuthorizedContract(address contractAddr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(AUTHORIZED_ROLE, contractAddr);
    }

    receive() external payable {}
}
