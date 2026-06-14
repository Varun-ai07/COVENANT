// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../interfaces/ICovenantIdentity.sol";

/// @title CovenantCollective V3 - Pooled treasury for multi-agent coordination
contract CovenantCollective is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    struct Collective {
        string name;
        address creator;
        uint256 treasury;
        uint32 createdAt;
        bool active;
    }

    mapping(uint256 => Collective) public collectives;
    mapping(uint256 => mapping(address => bool)) public members;
    mapping(uint256 => uint256) public memberCount;
    uint256 public collectiveCount;

    address public identity;

    event CollectiveCreated(uint256 indexed collectiveId, string name, address creator);
    event MemberJoined(uint256 indexed collectiveId, address member);
    event MemberLeft(uint256 indexed collectiveId, address member);
    event TreasuryDeposited(uint256 indexed collectiveId, uint256 amount);
    event TreasuryWithdrawn(uint256 indexed collectiveId, address to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(address _identity) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        identity = _identity;
    }

    function createCollective(string calldata name) external returns (uint256 collectiveId) {
        require(bytes(name).length > 0, "name required");

        collectiveId = ++collectiveCount;
        collectives[collectiveId] = Collective({
            name: name,
            creator: msg.sender,
            treasury: 0,
            createdAt: uint32(block.timestamp),
            active: true
        });

        members[collectiveId][msg.sender] = true;
        memberCount[collectiveId] = 1;

        emit CollectiveCreated(collectiveId, name, msg.sender);
        emit MemberJoined(collectiveId, msg.sender);
    }

    function joinCollective(uint256 collectiveId) external nonReentrant {
        require(collectives[collectiveId].active, "not active");
        require(!members[collectiveId][msg.sender], "already member");

        require(
            ICovenantIdentity(identity).isRegistered(msg.sender),
            "not registered"
        );

        members[collectiveId][msg.sender] = true;
        memberCount[collectiveId]++;

        emit MemberJoined(collectiveId, msg.sender);
    }

    function leaveCollective(uint256 collectiveId) external nonReentrant {
        require(members[collectiveId][msg.sender], "not member");
        require(memberCount[collectiveId] > 1, "last member");

        members[collectiveId][msg.sender] = false;
        memberCount[collectiveId]--;

        emit MemberLeft(collectiveId, msg.sender);
    }

    function deposit(uint256 collectiveId) external payable nonReentrant {
        require(members[collectiveId][msg.sender], "not member");
        require(msg.value > 0, "must send ETH");

        collectives[collectiveId].treasury += msg.value;
        emit TreasuryDeposited(collectiveId, msg.value);
    }

    function withdrawFromTreasury(
        uint256 collectiveId,
        address to,
        uint256 amount
    ) external nonReentrant {
        require(members[collectiveId][msg.sender], "not member");
        require(collectives[collectiveId].treasury >= amount, "insufficient treasury");
        require(to != address(0), "invalid recipient");

        collectives[collectiveId].treasury -= amount;

        (bool success, ) = to.call{value: amount}("");
        require(success, "transfer failed");

        emit TreasuryWithdrawn(collectiveId, to, amount);
    }

    function deactivateCollective(uint256 collectiveId) external {
        require(collectives[collectiveId].creator == msg.sender, "not creator");
        collectives[collectiveId].active = false;
    }

    function isMember(uint256 collectiveId, address agent) external view returns (bool) {
        return members[collectiveId][agent];
    }

    function getCollective(uint256 collectiveId) external view returns (
        string memory name,
        address creator,
        uint256 treasury,
        uint32 createdAt,
        bool active
    ) {
        Collective storage c = collectives[collectiveId];
        return (c.name, c.creator, c.treasury, c.createdAt, c.active);
    }
}
