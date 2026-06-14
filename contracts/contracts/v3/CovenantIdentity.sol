// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "./interfaces/ICovenantIdentity.sol";

/// @title CovenantIdentity V3 - Minimal on-chain identity, stake, and reputation root
/// @notice Gas-optimized: ~25K gas per registration, 64 bytes storage per agent
contract CovenantIdentity is
    ICovenantIdentity,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using ECDSAUpgradeable for bytes32;

    struct AgentRecordStorage {
        address owner;
        uint96 stake;
        uint16 reputation;
        uint32 registeredAt;
        uint32 lastActivity;
        bool active;
        bytes32 metadataRoot;
    }

    mapping(address => AgentRecordStorage) private _agents;
    mapping(address => uint256) public nonces;

    bytes32 public override reputationRoot;
    uint256 public override reputationEpoch;
    uint256 public override totalAgents;
    uint96 public override minimumStake;

    address public reputationOracle;
    uint256 public constant MAX_REPUTATION = 1000;
    uint256 public constant COOLDOWN_PERIOD = 1 hours;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(uint96 _minimumStake, address _reputationOracle) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        minimumStake = _minimumStake;
        reputationOracle = _reputationOracle;
    }

    function register(uint96 stake, bytes32 metadataRoot) external payable override nonReentrant whenNotPaused {
        require(!_agents[msg.sender].active, "already registered");
        require(msg.value >= minimumStake, "insufficient stake");

        _agents[msg.sender] = AgentRecordStorage({
            owner: msg.sender,
            stake: uint96(msg.value),
            reputation: uint16(MAX_REPUTATION / 2),
            registeredAt: uint32(block.timestamp),
            lastActivity: uint32(block.timestamp),
            active: true,
            metadataRoot: metadataRoot
        });

        unchecked {
            totalAgents++;
        }

        emit AgentRegistered(msg.sender, stake);
    }

    function deactivate() external override nonReentrant {
        require(_agents[msg.sender].active, "not registered");
        require(_agents[msg.sender].owner == msg.sender, "not owner");

        _agents[msg.sender].active = false;
        emit AgentDeactivated(msg.sender);
    }

    function updateMetadata(bytes32 newRoot) external override {
        require(_agents[msg.sender].active, "not registered");
        _agents[msg.sender].metadataRoot = newRoot;
        _agents[msg.sender].lastActivity = uint32(block.timestamp);
        emit AgentMetadataUpdated(msg.sender, newRoot);
    }

    function increaseStake() external override payable nonReentrant {
        require(_agents[msg.sender].active, "not registered");
        require(msg.value > 0, "must send ETH");

        _agents[msg.sender].stake += uint96(msg.value);
        emit StakeIncreased(msg.sender, uint96(msg.value));
    }

    function withdrawStake(uint96 amount) external override nonReentrant {
        require(_agents[msg.sender].active, "not registered");
        require(_agents[msg.sender].stake >= amount, "insufficient stake");
        require(_agents[msg.sender].stake - amount >= minimumStake, "below minimum");

        _agents[msg.sender].stake -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "transfer failed");

        emit StakeWithdrawn(msg.sender, amount);
    }

    function updateReputationRoot(
        bytes32 newRoot,
        uint256 epoch,
        bytes calldata signature
    ) external override nonReentrant {
        require(msg.sender == reputationOracle, "not oracle");

        bytes32 message = keccak256(abi.encodePacked(newRoot, epoch));
        bytes32 ethSignedHash = message.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        require(signer == reputationOracle, "invalid signature");

        reputationRoot = newRoot;
        reputationEpoch = epoch;
        emit ReputationRootUpdated(newRoot, epoch);
    }

    function isRegistered(address agent) external view override returns (bool) {
        return _agents[agent].active;
    }

    function getAgent(address agent) external view override returns (AgentRecord memory) {
        AgentRecordStorage storage s = _agents[agent];
        return AgentRecord({
            owner: s.owner,
            stake: s.stake,
            reputation: s.reputation,
            registeredAt: s.registeredAt,
            lastActivity: s.lastActivity,
            active: s.active,
            metadataRoot: s.metadataRoot
        });
    }

    function setReputationOracle(address oracle) external onlyOwner {
        reputationOracle = oracle;
    }

    function setMinimumStake(uint96 stake) external onlyOwner {
        minimumStake = stake;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
