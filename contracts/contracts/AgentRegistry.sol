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
        bytes32 did;                    // Decentralized Identifier
        string name;                    // Human-readable name
        string[] capabilities;          // What the agent can do
        uint256 reputation;             // Score 0-1000, starts at 500
        uint256 stakedAmount;           // ETH locked as collateral
        uint256 tasksCompleted;         // Lifetime successful tasks
        uint256 tasksFailed;            // Lifetime failed tasks
        uint256 totalValueTransferred;  // Total ETH transacted
        bool isActive;                  // Can this agent accept tasks?
        uint256 registeredAt;           // Registration timestamp
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
        require(!agents[msg.sender].isActive, "Already registered");
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
            reputation: INITIAL_REPUTATION,
            stakedAmount: msg.value,
            tasksCompleted: 0,
            tasksFailed: 0,
            totalValueTransferred: 0,
            isActive: true,
            registeredAt: block.timestamp
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
        require(agents[msg.sender].isActive, "Not registered");
        require(msg.value > 0, "Must send ETH");

        agents[msg.sender].stakedAmount += msg.value;
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
            if (agents[allAgents[i]].isActive) {
                activeCount++;
            }
        }

        address[] memory activeAgents = new address[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < allAgents.length; i++) {
            if (agents[allAgents[i]].isActive) {
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
        require(agents[agent].isActive, "Agent not active");

        Agent storage agentData = agents[agent];

        if (delta > 0) {
            uint256 increase = uint256(delta);
            if (agentData.reputation + increase > MAX_REPUTATION) {
                agentData.reputation = MAX_REPUTATION;
            } else {
                agentData.reputation += increase;
            }
        } else if (delta < 0) {
            uint256 decrease = uint256(-delta);
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
        require(agents[agent].isActive, "Agent not active");

        if (success) {
            agents[agent].tasksCompleted++;
        } else {
            agents[agent].tasksFailed++;
        }

        agents[agent].totalValueTransferred += valueTransferred;
    }

    /**
     * @notice Deactivate an agent (returns stake minus any pending obligations)
     */
    function deactivate() external {
        require(agents[msg.sender].isActive, "Not active");

        agents[msg.sender].isActive = false;

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
        require(agents[agent].isActive, "Agent not active");
        require(slashAmount <= agents[agent].stakedAmount, "Slash exceeds stake");

        agents[agent].stakedAmount -= slashAmount;

        // Slashed funds go to the contract owner (protocol treasury)
        if (slashAmount > 0) {
            (bool sent, ) = owner().call{value: slashAmount}("");
            require(sent, "Failed to send slashed funds");
        }
    }
}
