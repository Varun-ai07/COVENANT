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
    error SenderNotPreserved();

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
     * @notice Disabled convenience function.
     * @dev A normal external call from this router cannot preserve the original EOA
     *      as msg.sender in AgentRegistry or TaskEscrow. Leaving this enabled would
     *      register the router and create router-owned tasks, not user-owned tasks.
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
        name;
        capabilities;
        worker;
        payment;
        deadline;
        descriptionHash;
        taskId;
        revert SenderNotPreserved();
    }
}
