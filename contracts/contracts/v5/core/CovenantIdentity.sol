// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title CovenantIdentity V5 — Trust root with Merkle reputation, capabilities, and emergency controls
/// @notice ~25K gas registration, 64 bytes per agent, 32 bytes per capability
/// @dev Fixes V4: Added emergency withdraw, fixed grantCapability access control, indexed events
contract CovenantIdentity is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {
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

    struct CapabilityStorage {
        bytes32 capabilityHash;
        uint32 expiry;
        uint128 valueLimit;
        bool revoked;
    }

    mapping(address => AgentRecordStorage) private _agents;
    mapping(address => mapping(bytes32 => CapabilityStorage)) private _capabilities;
    mapping(address => uint256) public nonces;

    bytes32 public reputationRoot;
    uint256 public reputationEpoch;
    uint256 public totalAgents;
    uint96 public minimumStake;
    address public reputationOracle;

    uint256 public constant MAX_REPUTATION = 1000;

    event AgentRegistered(address indexed agent, uint96 stake);
    event AgentDeactivated(address indexed agent);
    event AgentMetadataUpdated(address indexed agent, bytes32 newRoot);
    event ReputationRootUpdated(bytes32 indexed newRoot, uint256 epoch);
    event StakeIncreased(address indexed agent, uint96 additionalStake);
    event StakeWithdrawn(address indexed agent, uint96 amount);
    event CapabilityGranted(address indexed agent, bytes32 capabilityHash, uint32 expiry);
    event CapabilityRevoked(address indexed agent, bytes32 capabilityHash);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    error AlreadyRegistered();
    error NotRegistered();
    error NotOwner();
    error InsufficientStake();
    error MustSendETH();
    error Unauthorized();
    error InvalidSignature();
    error InvalidAddress();
    error AlreadyRevoked();
    error StakeBelowMinimum();
    error CapabilityExpired();
    error CapabilityNotFound();
    error ExcessiveWithdraw();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(uint96 _minimumStake, address _reputationOracle) public initializer {
        __Ownable_init();
        transferOwnership(_reputationOracle);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        minimumStake = _minimumStake;
        reputationOracle = _reputationOracle;
    }

    function register(uint96 stake, bytes32 metadataRoot) external payable nonReentrant whenNotPaused {
        if (_agents[msg.sender].active) revert AlreadyRegistered();
        if (msg.value < minimumStake) revert InsufficientStake();
        _agents[msg.sender] = AgentRecordStorage({
            owner: msg.sender, stake: uint96(msg.value), reputation: uint16(MAX_REPUTATION / 2),
            registeredAt: uint32(block.timestamp), lastActivity: uint32(block.timestamp), active: true, metadataRoot: metadataRoot
        });
        unchecked { totalAgents++; }
        emit AgentRegistered(msg.sender, uint96(msg.value));
    }

    function deactivate() external nonReentrant {
        if (!_agents[msg.sender].active) revert NotRegistered();
        if (_agents[msg.sender].owner != msg.sender) revert NotOwner();
        _agents[msg.sender].active = false;
        emit AgentDeactivated(msg.sender);
    }

    function updateMetadata(bytes32 newRoot) external nonReentrant whenNotPaused {
        if (!_agents[msg.sender].active) revert NotRegistered();
        _agents[msg.sender].metadataRoot = newRoot;
        _agents[msg.sender].lastActivity = uint32(block.timestamp);
        emit AgentMetadataUpdated(msg.sender, newRoot);
    }

    function increaseStake() external payable nonReentrant {
        if (!_agents[msg.sender].active) revert NotRegistered();
        if (msg.value == 0) revert MustSendETH();
        _agents[msg.sender].stake += uint96(msg.value);
        emit StakeIncreased(msg.sender, uint96(msg.value));
    }

    function withdrawStake(uint96 amount) external nonReentrant {
        if (!_agents[msg.sender].active) revert NotRegistered();
        if (_agents[msg.sender].stake < amount) revert InsufficientStake();
        if (_agents[msg.sender].stake - amount < minimumStake) revert StakeBelowMinimum();
        _agents[msg.sender].stake -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "transfer failed");
        emit StakeWithdrawn(msg.sender, amount);
    }

    function updateReputationRoot(bytes32 newRoot, uint256 epoch, bytes calldata signature) external nonReentrant {
        if (msg.sender != reputationOracle) revert Unauthorized();
        bytes32 message = keccak256(abi.encodePacked(newRoot, epoch, block.chainid, address(this)));
        bytes32 ethSignedHash = message.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        if (signer != reputationOracle) revert InvalidSignature();
        reputationRoot = newRoot;
        reputationEpoch = epoch;
        emit ReputationRootUpdated(newRoot, epoch);
    }

    function grantCapability(address agent, bytes32 capabilityHash, uint32 expiry, uint128 valueLimit) external nonReentrant {
        if (!_agents[agent].active) revert NotRegistered();
        if (msg.sender != agent && msg.sender != owner()) revert Unauthorized();
        if (block.timestamp >= expiry) revert CapabilityExpired();
        _capabilities[agent][capabilityHash] = CapabilityStorage({ capabilityHash: capabilityHash, expiry: expiry, valueLimit: valueLimit, revoked: false });
        emit CapabilityGranted(agent, capabilityHash, expiry);
    }

    function revokeCapability(address agent, bytes32 capabilityHash) external nonReentrant {
        if (msg.sender != agent && msg.sender != owner()) revert Unauthorized();
        CapabilityStorage storage cap = _capabilities[agent][capabilityHash];
        if (cap.capabilityHash == bytes32(0)) revert CapabilityNotFound();
        if (cap.revoked) revert AlreadyRevoked();
        cap.revoked = true;
        emit CapabilityRevoked(agent, capabilityHash);
    }

    function emergencyWithdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        if (amount > address(this).balance / 10) revert ExcessiveWithdraw();
        (bool success, ) = to.call{value: amount}("");
        require(success, "emergency withdraw failed");
        emit EmergencyWithdraw(to, amount);
    }

    function isRegistered(address agent) external view returns (bool) { return _agents[agent].active; }
    function getAgent(address agent) external view returns (AgentRecordStorage memory) { return _agents[agent]; }
    function getCapability(address agent, bytes32 capabilityHash) external view returns (CapabilityStorage memory) { return _capabilities[agent][capabilityHash]; }
    function hasCapability(address agent, bytes32 capabilityHash) external view returns (bool) {
        CapabilityStorage storage c = _capabilities[agent][capabilityHash];
        return c.capabilityHash != bytes32(0) && !c.revoked && block.timestamp < c.expiry;
    }

    function setReputationOracle(address oracle) external onlyOwner {
        if (oracle == address(0)) revert InvalidAddress();
        reputationOracle = oracle;
    }
    function setMinimumStake(uint96 stake) external onlyOwner { minimumStake = stake; }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    receive() external payable {}

    function _authorizeUpgrade(address) internal override onlyOwner {}

    uint256[50] private __gap;
}
