// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/// @title COVENANTRouter V5 — Batched multicall for gas-efficient operations
/// @notice Pack multiple contract calls into a single transaction
contract COVENANTRouter is OwnableUpgradeable, ReentrancyGuardUpgradeable {

    struct Call {
        address target;
        bytes data;
        uint256 value;
    }

    uint256 public constant MAX_BATCH_SIZE = 10;

    error CallFailed();
    error WrongTotalValue();
    error BatchTooLarge();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize() public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
    }

    function multicall(Call[] calldata calls) external payable nonReentrant returns (bytes[] memory results) {
        if (calls.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        uint256 totalValue;
        for (uint256 i = 0; i < calls.length; i++) {
            totalValue += calls[i].value;
        }
        if (msg.value != totalValue) revert WrongTotalValue();

        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory result) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            if (!success) revert CallFailed();
            results[i] = result;
        }
    }

    function registerAndCreateTask(
        address agentRegistry,
        address taskEscrow,
        string calldata name,
        string[] calldata capabilities,
        address worker,
        uint256 payment,
        uint256 deadline,
        string calldata descriptionHash
    ) external payable nonReentrant returns (uint256 taskId) {
        // Register agent if not already registered
        bytes memory regData = abi.encodeWithSignature("register(string,string[])", name, capabilities);
        (bool regSuccess, ) = agentRegistry.call{value: 0.001 ether}(regData);
        // Ignore failure if already registered

        // Create task
        bytes memory taskData = abi.encodeWithSignature(
            "createTask(address,uint256,uint256,string)",
            worker, payment, deadline, descriptionHash
        );
        (bool taskSuccess, bytes memory taskResult) = taskEscrow.call{value: msg.value}(taskData);
        require(taskSuccess, "task creation failed");
        taskId = abi.decode(taskResult, (uint256));
    }
}
