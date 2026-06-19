// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

/// @title AgentCollective V5 — Pool resources for expensive tasks
/// @notice Multiple agents contribute ETH to fund tasks none could afford alone
contract AgentCollective is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {

    struct Collective {
        address creator;
        uint256 minContribution;
        uint256 maxMembers;
        address[] members;
        mapping(address => uint256) contributions;
        uint256 totalFund;
        address selectedWorker;
        uint256 taskId;
        bool launched;
    }

    mapping(uint256 => Collective) private _collectives;
    uint256 public collectiveCounter;

    address public taskEscrow;
    address public agentRegistry;

    event CollectiveCreated(uint256 indexed collectiveId, address indexed creator, uint256 minContribution, uint256 maxMembers);
    event MemberJoined(uint256 indexed collectiveId, address indexed member, uint256 contribution);
    event TaskLaunched(uint256 indexed collectiveId, address indexed worker, uint256 taskId, uint256 payment);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    error InvalidContribution();
    error NotEnoughFunds();
    error TaskAlreadyLaunched();
    error NotCollectiveMember(address member);
    error AgentNotActive(address agent);
    error WorkerHasNoReputation();
    error InvalidTaskId(uint256 taskId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(address _taskEscrow, address _agentRegistry) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        taskEscrow = _taskEscrow;
        agentRegistry = _agentRegistry;
    }

    function createCollective(uint256 minContribution, uint256 maxMembers) external returns (uint256) {
        collectiveCounter++;

        Collective storage c = _collectives[collectiveCounter];
        c.creator = msg.sender;
        c.minContribution = minContribution;
        c.maxMembers = maxMembers;
        c.launched = false;
        emit CollectiveCreated(collectiveCounter, msg.sender, minContribution, maxMembers);
        return collectiveCounter;
    }

    function joinCollective(uint256 collectiveId) external payable nonReentrant {
        Collective storage c = _collectives[collectiveId];
        if (msg.value < c.minContribution) revert InvalidContribution();

        // Add member
        c.members.push(msg.sender);
        c.contributions[msg.sender] += msg.value;
        c.totalFund += msg.value;

        emit MemberJoined(collectiveId, msg.sender, msg.value);
    }

    function launchCollectiveTask(
        uint256 collectiveId,
        address worker,
        uint256 payment,
        uint256 deadline,
        bytes32 descriptionHash
    ) external nonReentrant {
        Collective storage c = _collectives[collectiveId];
        if (c.launched) revert TaskAlreadyLaunched();

        // Verify caller is member
        bool isMember = false;
        for (uint256 i = 0; i < c.members.length; i++) {
            if (c.members[i] == msg.sender) { isMember = true; break; }
        }
        if (!isMember) revert NotCollectiveMember(msg.sender);

        // Verify worker is active
        bytes memory data = abi.encodeWithSignature("getAgent(address)", worker);
        (bool success, bytes memory result) = agentRegistry.staticcall(data);
        require(success, "failed to read agent");
        (, , , , , uint8 isActive, ) = abi.decode(result, (address, uint96, uint16, uint32, uint32, uint8, bytes32));
        if (isActive != 1) revert AgentNotActive(worker);

        if (c.totalFund < payment) revert NotEnoughFunds();

        // CEI: State update before external call
        c.launched = true;
        c.selectedWorker = worker;

        // Create task via escrow
        bytes memory taskData = abi.encodeWithSignature(
            "createTask(address,uint128,uint32,bytes32)",
            worker, uint128(payment), uint32(deadline), descriptionHash
        );
        (bool taskSuccess, ) = taskEscrow.call{value: payment}(taskData);
        require(taskSuccess, "failed to create task");

        emit TaskLaunched(collectiveId, worker, 0, payment);
    }

    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        (bool success, ) = to.call{value: amount}("");
        require(success, "withdraw failed");
        emit EmergencyWithdraw(to, amount);
    }

    function getCollective(uint256 collectiveId) external view returns (uint256 memberCount, uint256 totalFund, bool launched) {
        Collective storage c = _collectives[collectiveId];
        return (c.members.length, c.totalFund, c.launched);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
