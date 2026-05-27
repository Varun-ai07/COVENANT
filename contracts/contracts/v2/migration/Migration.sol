// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../AgentRegistry.sol";
import "../../TaskEscrow.sol";
import "../../ReceiptVerifier.sol";

/// @dev Interface the v2 AgentRegistry must implement for migration support.
///      The function must be callable only by an authorized migration contract.
interface IAgentRegistryMigratable {
    function migrateAgent(
        address wallet,
        bytes32 did,
        string calldata name,
        string[] calldata capabilities,
        uint16 reputation,
        uint96 stakedAmount,
        uint32 tasksCompleted,
        uint16 tasksFailed,
        uint96 totalValueTransacted,
        uint48 registeredAt,
        uint48 lastTaskAt
    ) external payable;
}

/// @dev Interface the v2 TaskEscrow must implement for migration support.
///      Status passed as uint8: 1=Funded, 2=InProgress.
interface ITaskEscrowMigratable {
    function migrateTask(
        address client,
        address worker,
        uint256 payment,
        uint256 deadline,
        string calldata descriptionHash,
        string calldata deliverableHash,
        uint8 status,
        uint256 createdAt,
        uint8 priority,
        bool usesMilestones,
        uint256 parentTaskId
    ) external payable returns (uint256);
}

/**
 * @title Migration
 * @notice Reads state from v1 contracts and replays it into v2 contracts.
 *
 * Prerequisites:
 *  - v2 AgentRegistry must implement IAgentRegistryMigratable and authorize this contract.
 *  - v2 TaskEscrow must implement ITaskEscrowMigratable and authorize this contract.
 *  - v2 ReceiptVerifier must authorize this contract as an issuer.
 *  - This contract must be pre-funded with ETH to cover agent stakes and active task escrows.
 *  - Old contract owners must drain balances to this contract before migration.
 */
contract Migration {
    // V1 (source) contracts
    AgentRegistry public oldRegistry;
    TaskEscrow public oldEscrow;
    ReceiptVerifier public oldVerifier;

    // V2 (destination) contracts
    AgentRegistry public newRegistry;
    TaskEscrow public newEscrow;
    ReceiptVerifier public newVerifier;

    address public owner;
    uint256 public migratedAgents;
    uint256 public migratedTasks;
    uint256 public migratedReceipts;
    bool public migrationComplete;

    uint256 public constant MAX_BATCH = 50;

    event AgentMigrated(address indexed agent, uint16 reputation, uint96 stake);
    event TaskMigrated(uint256 indexed oldTaskId, uint256 indexed newTaskId);
    event ReceiptMigrated(bytes32 indexed receiptId);
    event MigrationComplete(uint256 agents, uint256 tasks, uint256 receipts);

    constructor(
        address _oldRegistry,
        address _oldEscrow,
        address _oldVerifier,
        address _newRegistry,
        address _newEscrow,
        address _newVerifier
    ) {
        require(_oldRegistry != address(0) && _newRegistry != address(0), "!registry");
        require(_oldEscrow != address(0) && _newEscrow != address(0), "!escrow");
        require(_oldVerifier != address(0) && _newVerifier != address(0), "!verifier");

        oldRegistry = AgentRegistry(_oldRegistry);
        oldEscrow = TaskEscrow(_oldEscrow);
        oldVerifier = ReceiptVerifier(_oldVerifier);
        newRegistry = AgentRegistry(_newRegistry);
        newEscrow = TaskEscrow(_newEscrow);
        newVerifier = ReceiptVerifier(_newVerifier);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "!owner");
        _;
    }

    modifier notComplete() {
        require(!migrationComplete, "Migration complete");
        _;
    }

    /**
     * @notice Migrate agents from v1 to v2 registry (max 50 per call).
     * @dev Requires this contract to hold enough ETH to cover each agent's stake.
     *      Old registry owner must authorize this contract or agents must re-stake.
     */
    function migrateAgents(address[] calldata agentAddresses) external onlyOwner notComplete {
        require(agentAddresses.length > 0 && agentAddresses.length <= MAX_BATCH, "!batch");

        for (uint256 i = 0; i < agentAddresses.length; i++) {
            AgentRegistry.Agent memory agent = oldRegistry.getAgent(agentAddresses[i]);
            require(agent.isActive == 1, "Agent not active");

            IAgentRegistryMigratable(address(newRegistry)).migrateAgent{value: 0}(
                agent.wallet,
                agent.did,
                agent.name,
                agent.capabilities,
                agent.reputation,
                agent.stakedAmount,
                agent.tasksCompleted,
                agent.tasksFailed,
                agent.totalValueTransacted,
                agent.registeredAt,
                agent.lastTaskAt
            );

            migratedAgents++;
            emit AgentMigrated(agentAddresses[i], agent.reputation, agent.stakedAmount);
        }
    }

    /**
     * @notice Migrate active tasks (Funded or InProgress) from v1 to v2 escrow.
     * @dev Requires this contract to hold ETH equal to the sum of task payments.
     *      Old escrow owner must drain task funds to this contract beforehand.
     */
    function migrateTasks(uint256[] calldata taskIds) external onlyOwner notComplete {
        require(taskIds.length > 0 && taskIds.length <= MAX_BATCH, "!batch");

        for (uint256 i = 0; i < taskIds.length; i++) {
            TaskEscrow.Task memory task = oldEscrow.getTask(taskIds[i]);

            uint8 status = uint8(task.status);
            // Only migrate Funded (1) or InProgress (2)
            require(status == 1 || status == 2, "Task not active");

            uint256 newId = ITaskEscrowMigratable(address(newEscrow))
                .migrateTask{value: task.payment}(
                    task.client,
                    task.worker,
                    task.payment,
                    task.deadline,
                    task.descriptionHash,
                    task.deliverableHash,
                    status,
                    task.createdAt,
                    uint8(task.priority),
                    task.usesMilestones,
                    task.parentTaskId
                );

            migratedTasks++;
            emit TaskMigrated(taskIds[i], newId);
        }
    }

    /**
     * @notice Migrate valid receipts from v1 to v2 verifier.
     * @dev New receipt IDs will differ from originals (timestamp-dependent).
     *      v2 ReceiptVerifier must authorize this contract as an issuer.
     */
    function migrateReceipts(bytes32[] calldata receiptIds) external onlyOwner notComplete {
        require(receiptIds.length > 0 && receiptIds.length <= MAX_BATCH, "!batch");

        for (uint256 i = 0; i < receiptIds.length; i++) {
            ReceiptVerifier.Receipt memory receipt = oldVerifier.getReceipt(receiptIds[i]);
            require(receipt.timestamp > 0, "Receipt not found");
            require(receipt.isValid, "Receipt invalid");

            newVerifier.createReceipt(
                receipt.issuer,
                receipt.counterparty,
                receipt.interactionType,
                receipt.dataHash
            );

            migratedReceipts++;
            emit ReceiptMigrated(receiptIds[i]);
        }
    }

    /**
     * @notice Finalize migration. Emits totals and locks the contract.
     */
    function complete() external onlyOwner {
        require(!migrationComplete, "Already complete");
        migrationComplete = true;
        emit MigrationComplete(migratedAgents, migratedTasks, migratedReceipts);
    }

    /**
     * @notice Recover remaining ETH after migration is finalized.
     */
    function withdraw() external onlyOwner {
        require(migrationComplete, "Not finalized");
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool sent, ) = owner.call{value: balance}("");
        require(sent, "!withdraw");
    }

    receive() external payable {}
}
