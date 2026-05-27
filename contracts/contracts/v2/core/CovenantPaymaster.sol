// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IPaymaster (ERC-4337)
 * @notice Interface for ERC-4337 paymaster contracts.
 */
interface IPaymaster {
    enum PostOpMode {
        opSucceeded,
        opReverted,
        postOpReverted
    }

    /**
     * @notice Validates whether the paymaster is willing to pay for a UserOperation.
     * @param userOp The UserOperation to validate.
     * @param userOpHash Hash of the UserOperation (signature not yet validated).
     * @param maxCost Maximum gas cost the paymaster would need to pay.
     * @return context Opaque data passed to postOp (e.g. sender address).
     * @return validationData 0 for success, or packed (authorizer, validUntil, validAfter) for failure/revert.
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    /**
     * @notice Called after the UserOperation execution.
     * @param mode Whether the op succeeded, reverted, or postOp itself reverted.
     * @param context The context returned by validatePaymasterUserOp.
     * @param actualGasCost The actual gas cost incurred by the bundler.
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external;
}

/**
 * @title UserOperation (ERC-4337)
 * @notice Minimal UserOperation struct for ERC-4337.
 */
struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

/**
 * @title CovenantPaymaster
 * @notice ERC-4337 paymaster that sponsors gas for new COVENANT users.
 *
 * Sponsors:
 *   - First agent registration per address
 *   - First task creation per address
 *   - Insurance pool join
 *
 * Each user has a lifetime gas budget of 0.01 ETH. The owner can deposit/withdraw
 * ETH, set per-operation gas limits, and configure allowed call targets.
 *
 * Works with any ERC-4337 bundler (Stackup, Pimlico, Alchemy, etc.).
 * Bundler integration is offchain; this contract is the onchain validation layer.
 */
contract CovenantPaymaster is IPaymaster, AccessControl, ReentrancyGuard {
    // ─── Roles ─────────────────────────────────────────────────

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ─── Constants ─────────────────────────────────────────────

    uint256 public constant DEFAULT_MAX_GAS_PER_OP = 500_000;
    uint256 public constant DEFAULT_USER_BUDGET = 0.01 ether;

    // ─── Sponsorship Targets ───────────────────────────────────

    /// @notice Function selectors eligible for gas sponsorship.
    /// register(string,string[]) => 0x97a0286c
    /// createAndFundTask(address,uint256,uint256,bytes32) => varies; we match by target
    /// joinPool() => 0x0934b672
    bytes4 public constant REGISTER_SELECTOR = bytes4(keccak256("register(string,string[])"));
    bytes4 public constant JOIN_POOL_SELECTOR = bytes4(keccak256("joinPool()"));

    // ─── Storage ───────────────────────────────────────────────

    /// @notice Per-user lifetime gas spent (in wei).
    mapping(address => uint256) public userGasSpent;

    /// @notice Per-user lifetime budget cap (in wei).
    mapping(address => uint256) public userBudget;

    /// @notice Default lifetime budget for new users.
    uint256 public defaultUserBudget;

    /// @notice Maximum gas (in wei) the paymaster will cover per operation.
    uint256 public maxGasPerOp;

    /// @notice Set of contract addresses the paymaster will sponsor calls to.
    mapping(address => bool) public allowedTargets;

    /// @notice Whether the paymaster is globally active.
    bool public isActive;

    /// @notice Total ETH deposited for sponsorship.
    uint256 public totalDeposited;

    // ─── Events ────────────────────────────────────────────────

    event GasSponsored(
        address indexed user,
        address indexed target,
        bytes4 selector,
        uint256 gasCost
    );
    event UserBudgetExhausted(address indexed user, uint256 totalSpent);
    event PaymasterFunded(address indexed funder, uint256 amount);
    event PaymasterWithdrawn(address indexed to, uint256 amount);
    event AllowedTargetSet(address indexed target, bool allowed);
    event MaxGasPerOpSet(uint256 oldMax, uint256 newMax);
    event DefaultUserBudgetSet(uint256 oldBudget, uint256 newBudget);
    event UserBudgetSet(address indexed user, uint256 budget);
    event PaymasterActivated(bool active);

    // ─── Constructor ───────────────────────────────────────────

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        defaultUserBudget = DEFAULT_USER_BUDGET;
        maxGasPerOp = DEFAULT_MAX_GAS_PER_OP;
        isActive = true;
    }

    // ─── Paymaster Interface ───────────────────────────────────

    /**
     * @notice Validates whether this paymaster will sponsor the UserOperation.
     *
     * Checks:
     *   1. Paymaster is active and has sufficient balance.
     *   2. Target contract is in the allowed set.
     *   3. Call data starts with a sponsored function selector.
     *   4. User has remaining budget.
     *   5. Gas cost is within per-op limit.
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 maxCost
    ) external override nonReentrant returns (bytes memory context, uint256 validationData) {
        if (!isActive) {
            return ("", _validationFailed());
        }

        address sender = userOp.sender;
        address target = _extractTarget(userOp.callData);
        bytes4 selector = _extractSelector(userOp.callData);

        // Must be an allowed target with a sponsored selector
        if (!allowedTargets[target]) {
            return ("", _validationFailed());
        }
        if (!_isSponsoredSelector(selector)) {
            return ("", _validationFailed());
        }

        // Check per-op gas limit
        if (maxCost > maxGasPerOp) {
            return ("", _validationFailed());
        }

        // Check user lifetime budget
        uint256 budget = userBudget[sender] != 0 ? userBudget[sender] : defaultUserBudget;
        uint256 spent = userGasSpent[sender];
        if (spent >= budget) {
            emit UserBudgetExhausted(sender, spent);
            return ("", _validationFailed());
        }

        // Ensure paymaster can cover the cost
        uint256 remainingBudget = budget - spent;
        uint256 sponsorAmount = maxCost > remainingBudget ? remainingBudget : maxCost;
        if (address(this).balance < sponsorAmount) {
            return ("", _validationFailed());
        }

        // Pack context: 32 bytes sender + 32 bytes maxCost
        context = abi.encode(sender, sponsorAmount);
        validationData = 0; // success
    }

    /**
     * @notice Called after the UserOperation executes. Records actual gas cost
     * against the user's lifetime budget.
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external override nonReentrant {
        // Only the EntryPoint contract should call this
        // In production, store and verify the EntryPoint address
        if (mode == PostOpMode.postOpReverted) {
            return; // cannot do anything meaningful
        }

        (address sender, uint256 sponsorAmount) = abi.decode(context, (address, uint256));

        // Cap at the amount we agreed to sponsor
        uint256 cost = actualGasCost > sponsorAmount ? sponsorAmount : actualGasCost;

        userGasSpent[sender] += cost;

        // Extract selector for event (best-effort)
        emit GasSponsored(sender, address(0), bytes4(0), cost);
    }

    // ─── Admin: Funding ────────────────────────────────────────

    /**
     * @notice Deposit ETH to fund the paymaster. Callable by anyone.
     */
    function deposit() external payable nonReentrant {
        require(msg.value > 0, "Must deposit > 0");
        totalDeposited += msg.value;
        emit PaymasterFunded(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw ETH from the paymaster. Admin only.
     * @param to Recipient address.
     * @param amount Amount in wei to withdraw.
     */
    function withdraw(address payable to, uint256 amount) external nonReentrant onlyRole(ADMIN_ROLE) {
        require(to != address(0), "Invalid recipient");
        require(address(this).balance >= amount, "Insufficient balance");

        totalDeposited -= amount;
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");

        emit PaymasterWithdrawn(to, amount);
    }

    // ─── Admin: Configuration ──────────────────────────────────

    /**
     * @notice Set an allowed target contract address.
     * @param target Contract address.
     * @param allowed Whether to allow or disallow.
     */
    function setAllowedTarget(address target, bool allowed) external onlyRole(ADMIN_ROLE) {
        require(target != address(0), "Invalid target");
        allowedTargets[target] = allowed;
        emit AllowedTargetSet(target, allowed);
    }

    /**
     * @notice Set the maximum gas cost (in wei) the paymaster will cover per operation.
     */
    function setMaxGasPerOp(uint256 newMax) external onlyRole(ADMIN_ROLE) {
        require(newMax > 0, "Must be > 0");
        uint256 oldMax = maxGasPerOp;
        maxGasPerOp = newMax;
        emit MaxGasPerOpSet(oldMax, newMax);
    }

    /**
     * @notice Set the default lifetime budget for new users.
     */
    function setDefaultUserBudget(uint256 newBudget) external onlyRole(ADMIN_ROLE) {
        uint256 oldBudget = defaultUserBudget;
        defaultUserBudget = newBudget;
        emit DefaultUserBudgetSet(oldBudget, newBudget);
    }

    /**
     * @notice Set a custom lifetime budget for a specific user.
     * Useful for granting extra sponsorship to early adopters.
     */
    function setUserBudget(address user, uint256 budget) external onlyRole(ADMIN_ROLE) {
        require(user != address(0), "Invalid user");
        userBudget[user] = budget;
        emit UserBudgetSet(user, budget);
    }

    /**
     * @notice Activate or deactivate the paymaster globally.
     */
    function setActive(bool active) external onlyRole(ADMIN_ROLE) {
        isActive = active;
        emit PaymasterActivated(active);
    }

    // ─── View Functions ────────────────────────────────────────

    /**
     * @notice Get remaining sponsorship budget for a user.
     */
    function getRemainingBudget(address user) external view returns (uint256) {
        uint256 budget = userBudget[user] != 0 ? userBudget[user] : defaultUserBudget;
        uint256 spent = userGasSpent[user];
        return spent >= budget ? 0 : budget - spent;
    }

    /**
     * @notice Check whether the paymaster would sponsor a given call.
     */
    function wouldSponsor(address target, bytes4 selector) external view returns (bool) {
        return isActive && allowedTargets[target] && _isSponsoredSelector(selector);
    }

    /**
     * @notice Paymaster ETH balance.
     */
    function getPaymasterBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ─── Internal Helpers ──────────────────────────────────────

    /**
     * @dev Extract the target address from callData (first 4 bytes are selector,
     *      for delegatecall/call patterns the target is encoded in the callData).
     *      For ERC-4337, the target is the `sender` field for the first call,
     *      but for inner calls we parse from the callData if it's a call to another contract.
     *
     *      Since UserOp.callData for COVENANT operations is a direct call to the target,
     *      we extract the target from the callData if it starts with a call-type opcode
     *      pattern, otherwise return the sender.
     *
     *      For simplicity: if callData length > 4, the first 32 bytes after the selector
     *      are the first argument (which for register/task operations is the target or
     *      is unused). We use the sender as the target for self-calls.
     */
    function _extractTarget(bytes calldata callData) internal pure returns (address) {
        // For most ERC-4337 patterns, the UserOp.sender is the smart account
        // executing the call. The callData itself encodes the target contract call.
        // We check if callData has enough data to extract a target address
        // (standard pattern: selector + address param at offset 16..35)
        if (callData.length >= 36) {
            address potential = address(bytes20(callData[16:36]));
            if (potential != address(0)) {
                return potential;
            }
        }
        // Fallback: this shouldn't happen in valid UserOps
        return address(0);
    }

    /**
     * @dev Extract the 4-byte function selector from callData.
     */
    function _extractSelector(bytes calldata callData) internal pure returns (bytes4) {
        if (callData.length < 4) return bytes4(0);
        return bytes4(callData[0:4]);
    }

    /**
     * @dev Check if the selector is one of the sponsored operations.
     */
    function _isSponsoredSelector(bytes4 selector) internal pure returns (bool) {
        return selector == REGISTER_SELECTOR
            || selector == JOIN_POOL_SELECTOR
            || selector == _CREATE_TASK_SELECTOR()
            || selector == _CREATE_AND_FUND_SELECTOR();
    }

    function _CREATE_TASK_SELECTOR() private pure returns (bytes4) {
        return bytes4(keccak256("createAndFundTask(address,uint256,uint256,bytes32)"));
    }

    function _CREATE_AND_FUND_SELECTOR() private pure returns (bytes4) {
        return bytes4(keccak256("createTask(address,uint256,uint256,bytes32)"));
    }

    /**
     * @dev Return validation failure code. In ERC-4337, a non-zero return means failure.
     *      The packed format is: (uint48 validAfter, uint48 validUntil, address authorizer).
     *      address(1) = signature failure, address(0) = success.
     *      We return 1 (authorizer = address(1)) to signal rejection.
     */
    function _validationFailed() internal pure returns (uint256) {
        return 1;
    }

    // ─── Receive ───────────────────────────────────────────────

    receive() external payable {
        totalDeposited += msg.value;
    }
}
