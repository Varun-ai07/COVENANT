// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TestReceiver
 * @notice Simple test target contract for AgentWallet tests
 */
contract TestReceiver {
    uint256 public value;

    function setValue(uint256 _v) external {
        value = _v;
    }

    receive() external payable {}
}
