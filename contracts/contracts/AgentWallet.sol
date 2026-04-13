// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentWallet (Simplified ERC-4337 Alternative)
 * @notice Programmable smart account for agents with safety rails.
 * @dev This is a simplified version that provides spending controls
 *      without full ERC-4337 complexity. For the MVP, transactions
 *      are executed directly by the agent's EOA through this contract.
 */
contract AgentWallet is Ownable {

    // ============ Custom Errors ============
    error InvalidSigner();
    error WalletPausedError();
    error ExceedsPerTransactionLimit();
    error ExceedsDailyLimit();
    error RecipientNotWhitelisted();
    error ExecutionFailed();
    error OnlyHumanController();
    error InvalidAddress();
    // ======================================

    // Events
    event SpendingLimitsUpdated(uint256 dailyLimit, uint256 perTxLimit);
    event AllowedRecipientAdded(address recipient);
    event AllowedRecipientRemoved(address recipient);
    event WalletPaused();
    event WalletUnpaused();

    // Storage
    address public humanController;              // Human who can override
    uint256 public dailySpendLimit;              // Max ETH per day
    uint256 public maxPerTransaction;            // Max ETH per transaction
    address[] public allowedRecipients;          // Whitelist of destinations (array)
    mapping(address => bool) public recipientAllowed; // Quick lookup for whitelist
    bool public paused;                          // Emergency stop
    mapping(uint256 => uint256) public dailySpent; // Track daily spending (key = block.timestamp / 1 days)

    constructor(address _owner, address _humanController) Ownable(_owner) {
        humanController = _humanController;
        // Initialize with zero limits - must be set by human controller
        dailySpendLimit = 0;
        maxPerTransaction = 0;
        paused = false;
    }

    receive() external payable {}

    /**
     * @dev Execute a transaction on behalf of the agent
     * @param to Target address
     * @param value Amount of ETH to send
     * @param data Call data
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bool success) {
        // Only owner or humanController can execute
        if (msg.sender != owner() && msg.sender != humanController) {
            revert InvalidSigner();
        }

        // Check if wallet is paused
        if (paused) revert WalletPausedError();

        // Check per-transaction limit
        if (maxPerTransaction > 0 && value > maxPerTransaction) {
            revert ExceedsPerTransactionLimit();
        }

        // Check daily limit
        uint256 dayId = block.timestamp / 1 days;
        uint256 spentToday = dailySpent[dayId];
        if (dailySpendLimit > 0 && spentToday + value > dailySpendLimit) {
            revert ExceedsDailyLimit();
        }

        // Check recipient whitelist (if not empty)
        if (allowedRecipients.length > 0) {
            if (!recipientAllowed[to]) {
                revert RecipientNotWhitelisted();
            }
        }

        // Execute the call
        (success, ) = to.call{value: value}(data);
        if (!success) revert ExecutionFailed();

        // Update daily spending
        dailySpent[dayId] = spentToday + value;

        return true;
    }

    /**
     * @dev Set spending limits
     * Only callable by humanController or owner
     */
    function setLimits(uint256 dailyLimit, uint256 perTxLimit) external {
        if (msg.sender != humanController && msg.sender != owner()) {
            revert OnlyHumanController();
        }

        dailySpendLimit = dailyLimit;
        maxPerTransaction = perTxLimit;
        emit SpendingLimitsUpdated(dailyLimit, perTxLimit);
    }

    /**
     * @dev Add address to allowed recipients whitelist
     * Only callable by humanController or owner
     */
    function addAllowedRecipient(address recipient) external {
        if (msg.sender != humanController && msg.sender != owner()) {
            revert OnlyHumanController();
        }
        if (recipient == address(0)) revert InvalidAddress();

        // Add to array and mapping (avoid duplicates)
        if (!recipientAllowed[recipient]) {
            allowedRecipients.push(recipient);
            recipientAllowed[recipient] = true;
        }
        emit AllowedRecipientAdded(recipient);
    }

    /**
     * @dev Remove address from allowed recipients whitelist
     * Only callable by humanController or owner
     */
    function removeAllowedRecipient(address recipient) external {
        if (msg.sender != humanController && msg.sender != owner()) {
            revert OnlyHumanController();
        }

        // Remove from mapping. Note: array not compacted for gas efficiency.
        recipientAllowed[recipient] = false;
        emit AllowedRecipientRemoved(recipient);
    }

    /**
     * @dev Emergency pause - instantly freezes all transactions
     * Only callable by humanController or owner
     */
    function emergencyPause() external {
        if (msg.sender != humanController && msg.sender != owner()) {
            revert OnlyHumanController();
        }
        paused = true;
        emit WalletPaused();
    }

    /**
     * @dev Unpause wallet
     * Only callable by humanController or owner
     */
    function emergencyUnpause() external {
        if (msg.sender != humanController && msg.sender != owner()) {
            revert OnlyHumanController();
        }
        paused = false;
        emit WalletUnpaused();
    }

    /**
     * @dev Get current daily spending
     */
    function getDailySpent() public view returns (uint256) {
        uint256 dayId = block.timestamp / 1 days;
        return dailySpent[dayId];
    }

    /**
     * @dev Get remaining daily spending limit
     */
    function getRemainingDailyLimit() external view returns (uint256) {
        if (dailySpendLimit == 0) return type(uint256).max;
        uint256 spentToday = getDailySpent();
        return spentToday >= dailySpendLimit ? 0 : dailySpendLimit - spentToday;
    }
}
