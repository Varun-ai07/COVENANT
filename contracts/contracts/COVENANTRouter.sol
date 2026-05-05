// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AgentRegistry.sol";
import "./TaskEscrow.sol";
import "./ReceiptVerifier.sol";

/**
 * @title COVENANTRouter
 * @notice Multicall router for gas-efficient batch operations
 * @dev Allows packing multiple contract calls into a single transaction
 */
contract COVENANTRouter {
    // Custom errors
    error CallFailed();
    error WrongTotalValue();
    error ZeroAddress();
    error InsufficientStake(uint256 provided, uint256 required);

    // Contract references (immutable for gas)
    AgentRegistry public immutable agentRegistry;
    TaskEscrow public immutable escrow;
    ReceiptVerifier public immutable receiptVerifier;

    constructor(
        address _agentRegistry,
        address _escrow,
        address _receiptVerifier
    ) {
        if (_agentRegistry == address(0) || _escrow == address(0) || _receiptVerifier == address(0)) {
            revert ZeroAddress();
        }
        agentRegistry = AgentRegistry(_agentRegistry);
        escrow = TaskEscrow(_escrow);
        receiptVerifier = ReceiptVerifier(_receiptVerifier);
    }

    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    /**
     * @notice Execute multiple calls in a single transaction
     * @param calls Array of calls to execute
     * @return results Array of return data from each call
     *
     * All calls are executed in order. If any call fails, the entire
     * multicall reverts.
     * Total ETH value sent must equal sum of all call values.
     */
    function multicall(Call[] calldata calls) external payable returns (bytes[] memory results) {
        uint256 len = calls.length;
        results = new bytes[](len);

        // Verify total value matches
        uint256 totalValue = 0;
        unchecked {
            for (uint256 i = 0; i < len; ++i) {
                totalValue += calls[i].value;
            }
        }
        if (msg.value != totalValue) revert WrongTotalValue();

        // Execute each call via call
        for (uint256 i = 0; i < len; ++i) {
            (bool success, bytes memory result) = calls[i].target.call{value: calls[i].value}(
                calls[i].data
            );
            if (!success) {
                revert CallFailed();
            }
            results[i] = result;
        }
    }

    /**
     * @notice Convenience function: register agent and create first task in one tx
     * @param name Agent name (will be keccak256 hashed for storage efficiency)
     * @param capabilities Array of capabilities
     * @param worker Worker address
     * @param payment Payment amount (uint256)
     * @param deadline Deadline timestamp (uint256)
     * @param descriptionHash Task description IPFS CID (string)
     *
     * This saves 1-2 round trips and ~21000 gas.
     */
    function registerAndCreateTask(
        string calldata name,
        string[] calldata capabilities,
        address worker,
        uint256 payment,
        uint256 deadline,
        string calldata descriptionHash
    ) external payable returns (uint256 taskId) {
        // Minimum stake is 0.001 ETH
        uint256 stake = 0.001 ether;
        uint256 taskPayment = msg.value - stake;
        if (taskPayment <= 0) revert InsufficientStake(msg.value, stake + taskPayment);

        // Register if not already registered
        // Note: agentRegistry.agents(msg.sender).isActive check
        // We'll call register anyway; it will revert if already registered.
        // For a combined operation, we can check and conditionally register.
        // Simpler: attempt register, catch if already registered? Can't catch.
        // So we do: if not active, register.
        // But reading isActive requires SLOAD, but it's fine.

        // Check if already registered
        // AgentRegistry.Agent memory existing = agentRegistry.getAgent(msg.sender);
        // if (!existing.isActive) {
        //     _register internally...
        // }
        // But register is external; we could call internal _register if we expose.
        // For now, just call register. It will revert if already registered.
        // To avoid revert, we could skip. But likely this is used for first-time setup.
        // Let's implement: require not already registered, else revert.

        // For simplicity in this version, just call the external register function directly
        // This will fail if already registered, but the caller should handle that.
        // In a production router, we'd have an internal _register function.
        // We'll leave it as is for now.
        // Actually: we cannot call external function with value from within contract? We can.
        // But register expects msg.value to be the stake. We already separated stake.
        // So we call:
        // agentRegistry.register{value: stake}(name, capabilities);
        // However, register is external on AgentRegistry. We can call it.
        if (agentRegistry.getAgent(msg.sender).isActive != 1) {
            // Not registered, do registration
            // Encode calldata for register
            bytes memory registerData = abi.encodeWithSignature(
                "register(string,string[])",
                name,
                capabilities
            );
            (bool regSuccess, ) = address(agentRegistry).call{value: stake}(registerData);
            if (!regSuccess) revert CallFailed();
        }

        // Now create task via escrow
        // Encode createAndFundTask data
        bytes memory taskData = abi.encodeWithSignature(
            "createAndFundTask(address,uint256,uint256,string)",
            worker,
            payment,
            deadline,
            descriptionHash
        );
        (bool taskSuccess, bytes memory taskResult) = address(escrow).call{value: taskPayment}(taskData);
        if (!taskSuccess) revert CallFailed();

        // Decode taskId from result
        // abi.decode(taskResult, (uint256))
        // Need to check if taskResult has data. Use assembly or decode.
        // For simplicity, assume success and taskId is returned. We'll decode.
        // Solidity 0.8.4+ has abi.decode.
        // We'll use:
        // taskId = abi.decode(taskResult, (uint256));
        // However, taskResult includes the returndata. So:
        (taskId) = abi.decode(taskResult, (uint256));

        return taskId;
    }
}