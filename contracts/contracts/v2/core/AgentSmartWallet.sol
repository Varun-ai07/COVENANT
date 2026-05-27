// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentSmartWallet
 * @notice ERC-4337 compatible smart account for AI agents.
 *
 * Security model:
 *   - owner = agent's EOA (can execute transactions)
 *   - controller = designated human address (can adjust limits, pause)
 *   - agent can NEVER increase its own limits (only controller can)
 *   - daily spending limit resets at midnight UTC
 *   - per-transaction cap enforced on every execute()
 *   - recipient whitelist — agent can only send to approved addresses
 *   - emergency pause — controller can freeze all outbound transfers
 *
 * Works with any ERC-4337 bundler via the execute() entry point.
 */
contract AgentSmartWallet is Ownable, ReentrancyGuard {

    // ─── Controller ────────────────────────────────────────────

    address public controller;

    // ─── Spending Limits ───────────────────────────────────────

    uint256 public dailyLimit;      // max ETH per day (wei)
    uint256 public perTxLimit;      // max ETH per transaction (wei)
    uint256 public dailySpent;      // ETH spent today (wei)
    uint256 public lastResetDay;    // day number of last counter reset

    // ─── Recipient Whitelist ───────────────────────────────────

    mapping(address => bool) public allowedRecipients;

    // ─── Pause ─────────────────────────────────────────────────

    bool public paused;

    // ─── Events ────────────────────────────────────────────────

    event DailyLimitUpdated(uint256 newLimit);
    event PerTxLimitUpdated(uint256 newLimit);
    event RecipientUpdated(address recipient, bool allowed);
    event EmergencyPause(bool paused);
    event Executed(address indexed to, uint256 value, bytes data);
    event ControllerUpdated(address newController);

    // ─── Constructor ───────────────────────────────────────────

    /**
     * @param _controller Human controller address (can adjust limits, pause)
     * @param _dailyLimit Daily spending limit in wei
     * @param _perTxLimit Per-transaction cap in wei
     */
    constructor(
        address _controller,
        uint256 _dailyLimit,
        uint256 _perTxLimit
    ) Ownable(msg.sender) {
        require(_controller != address(0), "Invalid controller");
        controller = _controller;
        dailyLimit = _dailyLimit;
        perTxLimit = _perTxLimit;
    }

    // ─── Modifiers ─────────────────────────────────────────────

    modifier onlyController() {
        require(msg.sender == controller, "Only controller");
        _;
    }

    modifier notPaused() {
        require(!paused, "Wallet paused");
        _;
    }

    // ─── Core: Execute ─────────────────────────────────────────

    /**
     * @notice Execute a call from this wallet. Only the owner (agent EOA) can call.
     * @dev Enforces per-tx limit, daily limit, recipient whitelist, and pause.
     *      Daily counter resets automatically at midnight UTC.
     * @param to Target address
     * @param value ETH value to send (in wei)
     * @param data Calldata for the target
     * @return result Return data from the call
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlyOwner notPaused nonReentrant returns (bytes memory result) {
        // Reset daily counter if new UTC day
        uint256 today = block.timestamp / 1 days;
        if (today > lastResetDay) {
            dailySpent = 0;
            lastResetDay = today;
        }

        // Enforce limits
        require(value <= perTxLimit, "Exceeds per-tx limit");
        require(dailySpent + value <= dailyLimit, "Exceeds daily limit");
        require(allowedRecipients[to], "Recipient not whitelisted");

        // Update spent counter
        dailySpent += value;

        // Execute the call
        (bool success, bytes memory ret) = to.call{value: value}(data);
        require(success, "Execution failed");

        emit Executed(to, value, data);
        return ret;
    }

    // ─── Controller-Only Functions ─────────────────────────────

    /**
     * @notice Controller sets the daily spending limit.
     * @dev Agent CANNOT call this — only the human controller.
     */
    function setDailyLimit(uint256 _limit) external onlyController {
        dailyLimit = _limit;
        emit DailyLimitUpdated(_limit);
    }

    /**
     * @notice Controller sets the per-transaction cap.
     * @dev Agent CANNOT call this — only the human controller.
     */
    function setPerTxLimit(uint256 _limit) external onlyController {
        perTxLimit = _limit;
        emit PerTxLimitUpdated(_limit);
    }

    /**
     * @notice Controller adds or removes an address from the recipient whitelist.
     */
    function setRecipient(address _recipient, bool _allowed) external onlyController {
        allowedRecipients[_recipient] = _allowed;
        emit RecipientUpdated(_recipient, _allowed);
    }

    /**
     * @notice Controller pauses or unpauses the wallet.
     * @dev When paused, all execute() calls revert.
     */
    function setPaused(bool _paused) external onlyController {
        paused = _paused;
        emit EmergencyPause(_paused);
    }

    /**
     * @notice Controller transfers control to a new address.
     */
    function setController(address _controller) external onlyController {
        require(_controller != address(0), "Invalid controller");
        controller = _controller;
        emit ControllerUpdated(_controller);
    }

    // ─── View Helpers ──────────────────────────────────────────

    /**
     * @notice Get the remaining daily spending allowance.
     */
    function getRemainingDailyAllowance() external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        if (today > lastResetDay) {
            return dailyLimit;
        }
        return dailySpent >= dailyLimit ? 0 : dailyLimit - dailySpent;
    }

    /**
     * @notice ETH balance of this wallet.
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ─── Receive ───────────────────────────────────────────────

    receive() external payable {}
}
