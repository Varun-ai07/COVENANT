// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MultiTokenEscrow V5 — ERC-20 token payment escrow
/// @notice Supports USDC, DAI, USDT and any ERC-20 token
contract MultiTokenEscrow is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using SafeERC20 for IERC20;

    struct TokenTask {
        address client;
        address worker;
        uint256 amount;
        uint256 deadline;
        uint8 status; // 0=None, 1=Created, 2=Funded, 3=Submitted, 4=Completed, 5=Failed
        address token;
    }

    mapping(uint256 => TokenTask) private _tasks;
    mapping(address => bool) public acceptedTokens;
    mapping(address => uint256) public tokenFees;
    uint256 public taskCount;
    uint256 public constant PROTOCOL_FEE_BPS = 100; // 1%
    address public feeRecipient;

    event TaskCreated(uint256 indexed taskId, address indexed client, address token);
    event TaskCompleted(uint256 indexed taskId, uint256 amount);
    event TokenAccepted(address token, bool accepted);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    error TokenNotAccepted();
    error InsufficientAllowance();
    error NotClient();
    error NotWorker();
    error TaskNotSubmitted();
    error InvalidTask();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(address _feeRecipient) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        feeRecipient = _feeRecipient;
    }

    function createTaskERC20(
        address worker,
        address token,
        uint256 amount,
        uint256 deadline
    ) external nonReentrant whenNotPaused returns (uint256) {
        if (!acceptedTokens[token]) revert TokenNotAccepted();

        taskCount++;
        _tasks[taskCount] = TokenTask({
            client: msg.sender,
            worker: worker,
            amount: amount,
            deadline: deadline,
            status: 2, // Funded
            token: token
        });

        // Transfer tokens from client
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit TaskCreated(taskCount, msg.sender, token);
        return taskCount;
    }

    function verifyTask(uint256 taskId, bool success) external nonReentrant {
        TokenTask storage task = _tasks[taskId];
        if (task.status != 3) revert TaskNotSubmitted();

        if (success) {
            task.status = 4; // Completed
            uint256 fee = (task.amount * PROTOCOL_FEE_BPS) / 10000;
            uint256 workerPayment = task.amount - fee;

            IERC20(task.token).safeTransfer(task.worker, workerPayment);
            if (fee > 0) IERC20(task.token).safeTransfer(feeRecipient, fee);

            emit TaskCompleted(taskId, workerPayment);
        } else {
            task.status = 5; // Failed
            IERC20(task.token).safeTransfer(task.client, task.amount);
        }
    }

    function setAcceptedToken(address token, bool accepted) external onlyOwner {
        acceptedTokens[token] = accepted;
        emit TokenAccepted(token, accepted);
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
        emit EmergencyWithdraw(owner(), amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
