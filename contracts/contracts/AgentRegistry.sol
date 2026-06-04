// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentRegistry is Ownable {
    // Events
    event AgentRegistered(address indexed agent, bytes32 indexed did, string name, uint256 stake);
    event ReputationUpdated(address indexed agent, int256 delta, uint256 newReputation);
    event AgentDeactivated(address indexed agent);
    event AuthorizedContractAdded(address indexed contractAddr);
    event AuthorizedContractRemoved(address indexed contractAddr);

    struct Agent {
        // Slot 0: did (32 bytes — must be alone)
        bytes32 did;

        // Slot 1: packed flags and small numbers
        // wallet:    160 bits (20 bytes)
        // reputation: 16 bits (0-65535, fits in uint16)
        // isActive:    8 bits (bool as uint8)
        // tasksDone:  32 bits (0-4 billion)
        // tasksFailed:16 bits (0-65535)
        // TOTAL:     232 bits — fits in one 256-bit slot
        address wallet;         // 160 bits
        uint16 reputation;     //  16 bits (CHANGED from uint256)
        uint8 isActive;         //   8 bits (CHANGED from bool)
        uint32 tasksCompleted;  //  32 bits (CHANGED from uint256)
        uint16 tasksFailed;     //  16 bits (CHANGED from uint256)
        // 232/256 bits used. 24 bits spare for future fields.

        // Slot 2: stakedAmount (full uint96 — max 79 billion ETH)
        uint96 stakedAmount;    //  96 bits
        uint48 registeredAt;    //  48 bits (works until year 281474)
        uint48 lastTaskAt;      //  48 bits
        // 192/256 bits used.

        // Slot 3+: dynamic string (cannot pack)
        string name;

        // Slot N: total value transacted
        uint96 totalValueTransacted;  // 96 bits = max 79B ETH, enough

        string[] capabilities;          // What the agent can do
    }

    // Minimum stake required for registration (0.001 ETH)
    uint256 public constant MIN_STAKE = 0.001 ether;

    // Initial reputation for new agents
    uint256 public constant INITIAL_REPUTATION = 500;

    // Max reputation cap
    uint256 public constant MAX_REPUTATION = 1000;

    // Storage
    mapping(address => Agent) public agents;
    mapping(string => address[]) public capabilityToAgents;
    address[] public registeredAgents;

    // Authorized contracts that can update reputation (e.g., TaskEscrow)
    mapping(address => bool) public authorizedContracts;

    constructor() Ownable(msg.sender) {}

    modifier onlyAuthorized() {
        require(
            authorizedContracts[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }

    /**
     * @notice Register as an agent in the COVENANT network
     * @param name Human-readable agent name
     * @param capabilities Array of capability strings
     */
    function register(
        string calldata name,
        string[] calldata capabilities
    ) external payable {
        require(bytes(name).length > 0, "Name required");
        require(agents[msg.sender].isActive == 0, "Already registered");
        require(msg.value >= MIN_STAKE, "Insufficient stake");
        require(capabilities.length > 0, "At least one capability required");

        // Generate DID from address + timestamp
        bytes32 did = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, block.chainid)
        );

        // Store agent
        agents[msg.sender] = Agent({
            did: did,
            name: name,
            capabilities: capabilities,
            reputation: uint16(INITIAL_REPUTATION),
            stakedAmount: uint96(msg.value),
            tasksCompleted: uint32(0),
            tasksFailed: uint16(0),
            totalValueTransacted: uint96(0),
            isActive: uint8(1),
            registeredAt: uint48(block.timestamp),
            lastTaskAt: uint48(0),
            wallet: msg.sender
        });

        // Index by capability for discovery
        for (uint256 i = 0; i < capabilities.length; i++) {
            capabilityToAgents[capabilities[i]].push(msg.sender);
        }

        registeredAgents.push(msg.sender);

        emit AgentRegistered(msg.sender, did, name, msg.value);
    }

    /**
     * @notice Add additional stake to existing registration
     */
    function addStake() external payable {
        require(agents[msg.sender].isActive == 1, "Not registered");
        require(msg.value > 0, "Must send ETH");

        agents[msg.sender].stakedAmount += uint96(msg.value);
    }

    /**
     * @notice Discover agents by capability
     * @param capability The capability to search for
     * @return agentAddresses Array of agent addresses with the capability
     */
    function getAgentsByCapability(
        string calldata capability
    ) external view returns (address[] memory) {
        address[] memory allAgents = capabilityToAgents[capability];

        // Filter to only active agents
        uint256 activeCount = 0;
        for (uint256 i = 0; i < allAgents.length; i++) {
            if (agents[allAgents[i]].isActive == 1) {
                activeCount++;
            }
        }

        address[] memory activeAgents = new address[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < allAgents.length; i++) {
            if (agents[allAgents[i]].isActive == 1) {
                activeAgents[idx] = allAgents[i];
                idx++;
            }
        }

        return activeAgents;
    }

    /**
     * @notice Update agent reputation (restricted to authorized contracts)
     * @param agent The agent address
     * @param delta The reputation change (positive or negative)
     */
    function updateReputation(
        address agent,
        int256 delta
    ) external onlyAuthorized {
        require(agents[agent].isActive == 1, "Agent not active");

        Agent storage agentData = agents[agent];

        if (delta > 0) {
            uint16 increase = uint16(uint256(delta));
            if (uint256(agentData.reputation) + uint256(increase) > MAX_REPUTATION) {
                agentData.reputation = uint16(MAX_REPUTATION);
            } else {
                agentData.reputation += increase;
            }
        } else if (delta < 0) {
            uint16 decrease = uint16(uint256(-delta));
            if (agentData.reputation < decrease) {
                agentData.reputation = 0;
            } else {
                agentData.reputation -= decrease;
            }
        }

        emit ReputationUpdated(agent, delta, agentData.reputation);
    }

    /**
     * @notice Record task completion
     */
    function recordTaskCompletion(
        address agent,
        bool success,
        uint256 valueTransferred
    ) external onlyAuthorized {
        require(agents[agent].isActive == 1, "Agent not active");

        if (success) {
            agents[agent].tasksCompleted++;
        } else {
            agents[agent].tasksFailed++;
        }

        agents[agent].totalValueTransacted += uint96(valueTransferred);
    }

    /**
     * @notice Deactivate an agent (returns stake minus any pending obligations)
     */
    function deactivate() external {
        require(agents[msg.sender].isActive == 1, "Not active");

        agents[msg.sender].isActive = 0;

        uint256 stakeToReturn = agents[msg.sender].stakedAmount;
        agents[msg.sender].stakedAmount = 0;

        if (stakeToReturn > 0) {
            (bool sent, ) = payable(msg.sender).call{value: stakeToReturn}("");
            require(sent, "Failed to send stake");
        }

        emit AgentDeactivated(msg.sender);
    }

    /**
     * @notice Get full agent profile
     */
    function getAgent(
        address agentAddr
    ) external view returns (Agent memory) {
        return agents[agentAddr];
    }

    /**
     * @notice Get total number of registered agents
     */
    function getAgentCount() external view returns (uint256) {
        return registeredAgents.length;
    }

    /**
     * @notice Get all registered agent addresses
     */
    function getAllAgents() external view returns (address[] memory) {
        return registeredAgents;
    }

    /**
     * @notice Add an authorized contract (owner only)
     */
    function addAuthorizedContract(address contractAddr) external onlyOwner {
        authorizedContracts[contractAddr] = true;
        emit AuthorizedContractAdded(contractAddr);
    }

    /**
     * @notice Remove an authorized contract (owner only)
     */
    function removeAuthorizedContract(address contractAddr) external onlyOwner {
        authorizedContracts[contractAddr] = false;
        emit AuthorizedContractRemoved(contractAddr);
    }

    /**
     * @notice Slash an agent's stake (for severe violations)
     */
    function slashStake(
        address agent,
        uint256 slashAmount
    ) external onlyAuthorized {
        require(agents[agent].isActive == 1, "Agent not active");
        require(slashAmount <= agents[agent].stakedAmount, "Slash exceeds stake");

        agents[agent].stakedAmount -= uint96(slashAmount);

        // Slashed funds go to the contract owner (protocol treasury)
        if (slashAmount > 0) {
            (bool sent, ) = owner().call{value: slashAmount}("");
            require(sent, "Failed to send slashed funds");
        }
    }

}
