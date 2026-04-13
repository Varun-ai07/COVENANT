// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./TaskEscrow.sol";
import "./AgentRegistry.sol";

/**
 * @title AgentCollective
 * @notice Enables many-to-one task pooling where multiple clients fund a task none could afford alone.
 * @notice Implements 2D enhancement: Many-to-One (Agent Collective - Pooling Resources)
 */
contract AgentCollective is Ownable {
    // ============ Custom Errors ============
    error InvalidContribution();
    error NotEnoughFunds();
    error TaskAlreadyLaunched();
    error NotCollectiveMember(address member);
    error InvalidWorker(address worker);
    error DeliveryNotReady();
    error AlreadyClaimed();
    error AgentNotRegistered(address agent);
    error AgentNotActive(address agent);
    error WorkerHasNoReputation();
    error InvalidTaskId(uint256 taskId);

    // =======================================

    // Events
    event CollectiveCreated(
        uint256 indexed collectiveId,
        address indexed creator,
        uint256 minContribution,
        uint256 maxMembers
    );

    event MemberJoined(
        uint256 indexed collectiveId,
        address indexed member,
        uint256 contribution
    );

    event TaskLaunched(
        uint256 indexed collectiveId,
        address indexed worker,
        uint256 indexed taskId,
        uint256 totalFund
    );

    event DeliverableEncrypted(
        uint256 indexed collectiveId,
        address indexed member,
        bytes32 encryptedHash
    );

    event DeliverableClaimed(
        uint256 indexed collectiveId,
        address indexed member
    );

    // Collective structure
    struct Collective {
        address creator;              // Who created the collective
        address[] members;            // List of members who joined
        mapping(address => uint256) contributions; // Member => their contribution
        uint256 totalFund;            // Total ETH collected
        address selectedWorker;       // Chosen worker for the task
        uint256 taskId;               // Associated TaskEscrow task ID
        bytes32 deliverableHash;      // IPFS hash of the final deliverable (kept for compatibility)
        mapping(address => bytes32) encryptedDeliverableMap; // Member => their encrypted deliverable hash
        mapping(address => bool) decryptedFlags; // Member => whether they've accessed their copy
        bool distributed;             // Whether deliverable has been claimed by members
        uint256 maxMembers;           // Maximum number of members allowed
    }

    // Storage
    mapping(uint256 => Collective) public collectives;
    uint256 public collectiveCounter;

    // References to other contracts
    TaskEscrow public immutable taskEscrow;
    AgentRegistry public immutable agentRegistry;

    constructor(address _taskEscrow, address _agentRegistry) Ownable(msg.sender) {
        taskEscrow = TaskEscrow(_taskEscrow);
        agentRegistry = AgentRegistry(_agentRegistry);
    }

    modifier collectiveExists(uint256 collectiveId) {
        if (collectiveId == 0 || collectiveId > collectiveCounter) revert InvalidTaskId(collectiveId);
        _;
    }

    modifier isMember(uint256 collectiveId, address member) {
        Collective storage collective = collectives[collectiveId];
        bool isMem = false;
        for (uint256 i = 0; i < collective.members.length; i++) {
            if (collective.members[i] == member) {
                isMem = true;
                break;
            }
        }
        if (!isMem) revert NotCollectiveMember(member);
        _;
    }

    modifier notLaunched(uint256 collectiveId) {
        Collective storage collective = collectives[collectiveId];
        if (collective.taskId != 0) revert TaskAlreadyLaunched();
        _;
    }

    modifier hasDeliverable(uint256 collectiveId) {
        Collective storage collective = collectives[collectiveId];
        bool hasDeliv = false;
        for (uint256 i = 0; i < collective.members.length; i++) {
            if (collective.encryptedDeliverableMap[collective.members[i]] != bytes32(0)) {
                hasDeliv = true;
                break;
            }
        }
        if (!hasDeliv) revert DeliveryNotReady();
        _;
    }

    modifier notDistributed(uint256 collectiveId) {
        Collective storage collective = collectives[collectiveId];
        if (collective.distributed) revert AlreadyClaimed();
        _;
    }

    /**
     * @notice Create a new collective for pooling funds
     * @param minContribution Minimum contribution required per member (wei)
     * @param maxMembers Maximum number of members allowed
     * @return collectiveId The ID of the created collective
     */
    function createCollective(
        uint256 minContribution,
        uint256 maxMembers
    ) external payable returns (uint256) {
        if (minContribution == 0) revert InvalidContribution();
        if (maxMembers == 0) revert InvalidContribution();
        if (msg.value < minContribution) revert InvalidContribution();

        // Verify creator is a registered and active agent
        AgentRegistry.Agent memory creatorAgent = agentRegistry.getAgent(msg.sender);
        if (!creatorAgent.isActive) revert AgentNotActive(msg.sender);

        collectiveCounter++;

        // Initialize collective storage
        Collective storage collective = collectives[collectiveCounter];
        collective.creator = msg.sender;
        // members array is already initialized as empty by default
        collective.totalFund = msg.value;
        collective.selectedWorker = address(0);
        collective.taskId = 0;
        collective.deliverableHash = bytes32(0);
        collective.distributed = false;
        collective.maxMembers = maxMembers;

        // Add creator as first member
        collective.members.push(msg.sender);
        collective.contributions[msg.sender] = msg.value;

        emit CollectiveCreated(collectiveCounter, msg.sender, minContribution, maxMembers);

        return collectiveCounter;
    }

    /**
     * @notice Join an existing collective by contributing funds
     * @param collectiveId The ID of the collective to join
     */
    function joinCollective(uint256 collectiveId) external payable collectiveExists(collectiveId) notLaunched(collectiveId) {
        Collective storage collective = collectives[collectiveId];

        // Verify member is a registered and active agent
        AgentRegistry.Agent memory memberAgent = agentRegistry.getAgent(msg.sender);
        if (!memberAgent.isActive) revert AgentNotActive(msg.sender);

        // Check if already a member
        for (uint256 i = 0; i < collective.members.length; i++) {
            if (collective.members[i] == msg.sender) {
                // Already a member - just add contribution (allow increasing stake)
                collective.contributions[msg.sender] += msg.value;
                collective.totalFund += msg.value;
                return;
            }
        }

        // Check if at max capacity
        if (collective.members.length >= collective.maxMembers) {
            revert NotEnoughFunds(); // Reusing error for capacity
        }

        // Add new member
        collective.members.push(msg.sender);
        collective.contributions[msg.sender] = msg.value;
        collective.totalFund += msg.value;

        emit MemberJoined(collectiveId, msg.sender, msg.value);
    }

    /**
     * @notice Launch a task using the pooled funds
     * @param collectiveId The ID of the collective
     * @param workerAddress The address of the selected worker
     * @param payment Amount to pay for the task (wei)
     * @param deadline Task deadline as unix timestamp
     * @param descriptionHash IPFS CID as bytes32 (multihash digest)
     * @return taskId The ID of the posted task
     */
    function launchTask(
        uint256 collectiveId,
        address workerAddress,
        uint256 payment,
        uint256 deadline,
        bytes32 descriptionHash
    ) external collectiveExists(collectiveId) notLaunched(collectiveId) returns (uint256) {
        Collective storage collective = collectives[collectiveId];

        // Verify caller is a member
        bool isMem = false;
        for (uint256 i = 0; i < collective.members.length; i++) {
            if (collective.members[i] == msg.sender) {
                isMem = true;
                break;
            }
        }
        if (!isMem) revert NotCollectiveMember(msg.sender);

        // Verify worker is a registered and active agent with reputation
        AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(workerAddress);
        if (!workerAgent.isActive) revert AgentNotActive(workerAddress);
        if (workerAgent.reputation == 0) revert WorkerHasNoReputation();

        // Include Medium priority fee (100 bps) in the value sent to TaskEscrow
        uint256 priorityFee = (payment * 100) / 10000;
        uint256 totalRequired = payment + priorityFee;
        if (address(this).balance < totalRequired) revert NotEnoughFunds();

        // Create and fund the task using collective's balance (client = collective itself)
        uint256 taskId = taskEscrow.createAndFundTaskForCollectiveWithPriority{value: totalRequired}(
            address(this),
            workerAddress,
            payment,
            deadline,
            string(abi.encodePacked(descriptionHash)),
            TaskEscrow.Priority.Medium
        );

        // Update collective
        collective.selectedWorker = workerAddress;
        collective.taskId = taskId;

        emit TaskLaunched(collectiveId, workerAddress, taskId, payment);

        return taskId;
    }

    /**
     * @notice Submit the encrypted deliverable hashes for the completed task
     * @param collectiveId The ID of the collective
     * @param taskId The ID of the task
     * @param encryptedDeliveryHashes Array of encrypted deliverable hashes, one for each member in the same order as members array
     */
    function submitDeliverable(
        uint256 collectiveId,
        uint256 taskId,
        bytes32[] calldata encryptedDeliveryHashes
    ) external collectiveExists(collectiveId) {
        Collective storage collective = collectives[collectiveId];

        // Verify caller is the selected worker
        if (msg.sender != collective.selectedWorker) revert InvalidWorker(msg.sender);

        // Verify task matches
        if (collective.taskId != taskId) revert InvalidTaskId(taskId);

        // Verify array length matches members count
        if (encryptedDeliveryHashes.length != collective.members.length) revert InvalidContribution();

        // Store the encrypted deliverable for each member
        // In a real implementation, these would be encrypted using each member's public key
        // via ECDH key exchange and AES-GCM encryption (handled off-chain)
        for (uint256 i = 0; i < collective.members.length; i++) {
            address member = collective.members[i];
            collective.encryptedDeliverableMap[member] = encryptedDeliveryHashes[i];
            collective.decryptedFlags[member] = false;

            emit DeliverableEncrypted(collectiveId, member, encryptedDeliveryHashes[i]);
        }

        // Keep the original hash for backward compatibility (but mark as not directly usable)
        // In a real implementation, this might be set to bytes32(0) to indicate it's not directly accessible
        collective.deliverableHash = encryptedDeliveryHashes[0]; // Just store first one for compatibility
    }

    /**
     * @notice Claim the deliverable (only after task is completed)
     * @param collectiveId The ID of the collective
     */
    function claimDeliverable(uint256 collectiveId) external collectiveExists(collectiveId) notDistributed(collectiveId) isMember(collectiveId, msg.sender) {
        Collective storage collective = collectives[collectiveId];

        // Verify member hasn't already claimed their copy
        if (collective.decryptedFlags[msg.sender]) {
            revert AlreadyClaimed();
        }

        // Get the encrypted deliverable for this member
        bytes32 encryptedDeliverable = collective.encryptedDeliverableMap[msg.sender];
        if (encryptedDeliverable == bytes32(0)) {
            revert DeliveryNotReady();
        }

        // Decrypt the deliverable hash for this member
        // Note: In a full implementation, we would:
        // 1. Get the member's private key (would need to be provided or derived)
        // 2. Use ECDH to derive a shared secret between the worker and member
        // 3. Decrypt the encryptedDeliverable with AES-GCM using the shared secret
        // For this implementation, we'll simulate decryption by reversing our "encryption"
        // In a real implementation, the decryption happens off-chain and the decrypted value
        // is never stored or transmitted on-chain for security reasons

        // Mark as claimed for this member
        collective.decryptedFlags[msg.sender] = true;

        // Emit event with the decrypted deliverable (in reality, this would be handled off-chain)
        emit DeliverableClaimed(collectiveId, msg.sender);
        // Note: The actual decrypted deliverable would be used off-chain by the member
        // In a full implementation, we might emit the decrypted hash or store it temporarily
        // For security, we don't store or transmit the decrypted value on-chain
    }

    /**
     * @notice Get the contribution of a member in a collective
     * @param collectiveId The ID of the collective
     * @param member The address of the member
     * @return contribution The contribution amount of the member (wei)
     */
    function contributions(uint256 collectiveId, address member)
        external
        view
        collectiveExists(collectiveId)
        returns (uint256)
    {
        return collectives[collectiveId].contributions[member];
    }

    /**
     * @notice Get the encrypted deliverable hash for a member in a collective
     * @param collectiveId The ID of the collective
     * @param member The address of the member
     * @return encryptedDeliverable The encrypted deliverable hash for the member
     */
    function encryptedDeliverableMap(uint256 collectiveId, address member)
        external
        view
        collectiveExists(collectiveId)
        returns (bytes32)
    {
        return collectives[collectiveId].encryptedDeliverableMap[member];
    }

    /**
     * @notice Get the decrypted flag for a member in a collective
     * @param collectiveId The ID of the collective
     * @param member The address of the member
     * @return decryptedFlag Whether the member has accessed their deliverable copy
     */
    function decryptedFlags(uint256 collectiveId, address member)
        external
        view
        collectiveExists(collectiveId)
        returns (bool)
    {
        return collectives[collectiveId].decryptedFlags[member];
    }

    /**
     * @notice Get collective details
     * @param collectiveId The ID of the collective
     * @return creator Who created the collective
     * @return members List of members who joined
     * @return totalFund Total ETH collected
     * @return selectedWorker Chosen worker for the task
     * @return taskId Associated TaskEscrow task ID
     * @return deliverableHash IPFS hash of the final deliverable
     * @return distributed Whether deliverable has been claimed by members
     */
    function getCollective(uint256 collectiveId)
        external
        view
        collectiveExists(collectiveId)
        returns (
            address creator,
            address[] memory members,
            uint256 totalFund,
            address selectedWorker,
            uint256 taskId,
            bytes32 deliverableHash,
            bool distributed,
            uint256 maxMembers
        )
    {
        Collective storage collective = collectives[collectiveId];
        return (
            collective.creator,
            collective.members,
            collective.totalFund,
            collective.selectedWorker,
            collective.taskId,
            collective.deliverableHash,
            collective.distributed,
            collective.maxMembers
        );
    }
}