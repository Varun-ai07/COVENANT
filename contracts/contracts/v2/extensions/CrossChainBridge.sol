// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CrossChainBridge
 * @notice Enables COVENANT agents to bridge tasks and reputation across chains
 */
contract CrossChainBridge is Ownable, ReentrancyGuard {

    struct CrossChainTask {
        uint256 sourceTaskId;
        uint256 sourceChainId;
        address sourceClient;
        address sourceWorker;
        uint256 payment;
        bytes32 descriptionHash;
        uint8 status; // 0=Pending, 1=Bridged, 2=Completed
        uint256 timestamp;
    }

    struct AgentReputation {
        uint256 chainId;
        address agentAddress;
        uint16 reputation;
        uint32 tasksCompleted;
        uint32 tasksFailed;
        bytes32 proofHash;
        uint256 verifiedAt;
    }

    mapping(uint256 => bool) public supportedChains;
    mapping(uint256 => address) public chainEndpoints;
    mapping(bytes32 => CrossChainTask) public crossChainTasks;
    mapping(bytes32 => AgentReputation) public syncedReputations;
    mapping(bytes32 => bool) public processedMessages;

    uint256 public bridgeFee;
    uint256 public messageCounter;

    event TaskBridged(bytes32 indexed bridgeId, uint256 sourceChainId, address indexed client);
    event TaskCompleted(bytes32 indexed bridgeId, bool success);
    event ReputationSynced(bytes32 indexed syncId, uint256 chainId, address indexed agent);
    event MessageProcessed(bytes32 indexed messageId);

    constructor() Ownable(msg.sender) {
        supportedChains[84532] = true;
        supportedChains[8453] = true;
        supportedChains[137] = true;
        supportedChains[42161] = true;
        bridgeFee = 0.0001 ether;
    }

    function setEndpoint(uint256 chainId, address endpoint) external onlyOwner {
        chainEndpoints[chainId] = endpoint;
    }

    function setBridgeFee(uint256 _fee) external onlyOwner {
        bridgeFee = _fee;
    }

    function addChain(uint256 chainId) external onlyOwner {
        supportedChains[chainId] = true;
    }

    function removeChain(uint256 chainId) external onlyOwner {
        supportedChains[chainId] = false;
    }

    function bridgeTask(
        uint256 destinationChainId,
        address worker,
        uint256 payment,
        bytes32 descriptionHash
    ) external payable nonReentrant returns (bytes32 bridgeId) {
        require(supportedChains[destinationChainId], "Unsupported chain");
        require(msg.value >= bridgeFee, "Insufficient fee");

        bridgeId = keccak256(abi.encodePacked(block.chainid, messageCounter++, msg.sender));

        crossChainTasks[bridgeId] = CrossChainTask({
            sourceTaskId: 0,
            sourceChainId: block.chainid,
            sourceClient: msg.sender,
            sourceWorker: worker,
            payment: payment,
            descriptionHash: descriptionHash,
            status: 1,
            timestamp: block.timestamp
        });

        emit TaskBridged(bridgeId, block.chainid, msg.sender);
    }

    function completeBridging(bytes32 bridgeId, bool success) external onlyOwner {
        require(!processedMessages[bridgeId], "Already processed");

        CrossChainTask storage task = crossChainTasks[bridgeId];
        task.status = success ? 2 : 0;
        processedMessages[bridgeId] = true;

        emit TaskCompleted(bridgeId, success);
        emit MessageProcessed(bridgeId);
    }

    function syncReputation(
        uint256 chainId,
        address agentAddress,
        uint16 reputation,
        uint32 tasksCompleted,
        uint32 tasksFailed,
        bytes32 proofHash
    ) external nonReentrant {
        bytes32 syncId = keccak256(abi.encodePacked(chainId, agentAddress));

        syncedReputations[syncId] = AgentReputation({
            chainId: chainId,
            agentAddress: agentAddress,
            reputation: reputation,
            tasksCompleted: tasksCompleted,
            tasksFailed: tasksFailed,
            proofHash: proofHash,
            verifiedAt: block.timestamp
        });

        emit ReputationSynced(syncId, chainId, agentAddress);
    }

    function getSupportedChains() external view returns (uint256[] memory) {
        uint256[] memory chains = new uint256[](4);
        chains[0] = 84532;
        chains[1] = 8453;
        chains[2] = 137;
        chains[3] = 42161;
        return chains;
    }

    function getCrossChainTask(bytes32 bridgeId) external view returns (CrossChainTask memory) {
        return crossChainTasks[bridgeId];
    }

    function getReputationSync(bytes32 syncId) external view returns (AgentReputation memory) {
        return syncedReputations[syncId];
    }

    receive() external payable {}
}
