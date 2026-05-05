// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AgentRegistry.sol";

/**
 * @title OpenTaskMarket
 * @notice Implements the One-to-Many enhancement: clients can broadcast tasks to multiple workers
 *         who can then bid on them. Uses encrypted communication for privacy.
 */
contract OpenTaskMarket is Ownable {
    // ============ EVENTS ============
    event TaskPosted(
        uint256 indexed taskId,
        address indexed client,
        uint256 maxPayment,
        uint256 deadline,
        string descriptionHash
    );

    event BidSubmitted(
        uint256 indexed taskId,
        address indexed bidder,
        uint256 price,
        uint256 timeEstimate,
        string proposalHash
    );

    event BidWithdrawn(
        uint256 indexed taskId,
        address indexed bidder
    );

    event WorkerSelected(
        uint256 indexed taskId,
        address indexed worker,
        uint256 price,
        uint256 timeEstimate,
        string proposalHash
    );

    event CounterOfferMade(
        uint256 indexed taskId,
        address indexed bidder,
        uint256 counterPrice,
        uint256 counterTimeEstimate,
        string counterProposalHash
    );

    event CounterOfferAccepted(
        uint256 indexed taskId,
        address indexed bidder
    );

    event CounterOfferRejected(
        uint256 indexed taskId,
        address indexed bidder
    );

    event TaskCompleted(
        uint256 indexed taskId,
        address indexed worker,
        uint256 payment
    );

    // Debug event for AgentNotActive troubleshooting
    event DebugAgentNotActive(
        address msgSender,
        address registryAddress,
        bool isActive,
        string name
    );

    // Debug event for general agent info
    event DebugAgentInfo(
        address msgSender,
        address registryAddress,
        bool isActive,
        string name
    );

    // ============ STRUCTURES ============
    enum TaskStatus {
        Open,
        InProgress,
        Completed,
        Cancelled
    }

    // ============ CUSTOM ERRORS ============
    error ZeroPayment();
    error DeadlinePast();
    error EmptyDescriptionHash();
    error AgentNotActive();
    error AlreadyBidded();
    error BidBelowMin();
    error ProposalHashRequired();

    struct Task {
        address client;
        uint256 maxPayment;
        uint256 deadline;
        string descriptionHash; // IPFS hash of encrypted task description
        TaskStatus status;
        uint256 postedAt;
        address selectedWorker; // 0x0 if not selected yet
        uint256 selectedPrice;
        uint256 selectedTimeEstimate;
        string selectedProposalHash;
    }

    struct Bid {
        uint256 price;
        uint256 timeEstimate;
        string proposalHash;
        uint256 bidAt;
        address bidder;
        bool hasCounter;
        uint256 counterPrice;
        uint256 counterTimeEstimate;
        string counterProposalHash;
    }

    // ============ STORAGE ============
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => mapping(address => Bid)) public bids; // taskId => bidder => bid
    uint256 public taskCounter;

    // Reference to AgentRegistry for validation
    AgentRegistry public agentRegistry;

    // ============ MODIFIERS ============
    modifier onlyClient(uint256 taskId) {
        require(tasks[taskId].client == msg.sender, "Not task client");
        _;
    }

    modifier onlyBidder(uint256 taskId) {
        require(bids[taskId][msg.sender].price > 0, "Not a bidder on this task");
        _;
    }

    // ============ CONSTRUCTOR ============
    constructor(address _agentRegistry) Ownable(msg.sender) {
        agentRegistry = AgentRegistry(_agentRegistry);
    }

    // ============ CORE FUNCTIONS ============
    /**
     * @notice Post a new open task for bidding
     * @param maxPayment Maximum payment the client is willing to pay (in wei)
     * @param deadline Unix timestamp for task completion deadline
     * @param descriptionHash IPFS hash of the encrypted task description
     */
    function postTask(
        uint256 maxPayment,
        uint256 deadline,
        string calldata descriptionHash
    ) external payable returns (uint256) {
        // Validate inputs first (before any state changes)
        if (maxPayment == 0) revert ZeroPayment();
        if (deadline <= block.timestamp) revert DeadlinePast();
        if (bytes(descriptionHash).length == 0) revert EmptyDescriptionHash();

        // Debug: Let's see if we even get here
        emit DebugAgentInfo(msg.sender, address(agentRegistry), true, "debug");

        // Verify client is a registered agent
        AgentRegistry.Agent memory clientAgent = agentRegistry.getAgent(msg.sender);
        // Debug: Log agent info (would need events or revert with data for debugging)
        emit DebugAgentInfo(msg.sender, address(agentRegistry), clientAgent.isActive == 1, clientAgent.name);
        if (clientAgent.isActive != 1) {
            // Temporary debug: let's see what we're working with
            // Let's add more info to help debug
            emit DebugAgentNotActive(msg.sender, address(agentRegistry), clientAgent.isActive == 1, clientAgent.name);
            revert AgentNotActive();
        }

        taskCounter++;

        Task storage task = tasks[taskCounter];
        task.client = msg.sender;
        task.maxPayment = maxPayment;
        task.deadline = deadline;
        task.descriptionHash = descriptionHash;
        task.status = TaskStatus.Open;
        task.postedAt = block.timestamp;
        task.selectedWorker = address(0);
        task.selectedPrice = 0;
        task.selectedTimeEstimate = 0;
        task.selectedProposalHash = "";

        emit TaskPosted(taskCounter, msg.sender, maxPayment, deadline, descriptionHash);

        return taskCounter;
    }

    function postOpenTask(
        uint256 maxPayment,
        uint256 deadline,
        string calldata descriptionHash
    ) external payable returns (uint256) {
        uint256 taskId = this.postTask(maxPayment, deadline, descriptionHash);
        emit TaskPosted(taskId, msg.sender, maxPayment, deadline, descriptionHash);
        return taskId;
    }

    function makeCounterOffer(
        uint256 taskId,
        address bidder,
        uint256 counterPrice,
        uint256 counterTimeEstimate,
        string calldata counterProposalHash
    ) external onlyClient(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Open, "Task is not open for counter-offer");
        require(bids[taskId][bidder].price > 0, "Bidder has not bid on this task");
        require(counterPrice > 0, "Counter price must be positive");
        require(counterTimeEstimate > 0, "Counter time estimate must be positive");
        require(bytes(counterProposalHash).length > 0, "Counter proposal hash required");

        Bid storage bid = bids[taskId][bidder];
        bid.hasCounter = true;
        bid.counterPrice = counterPrice;
        bid.counterTimeEstimate = counterTimeEstimate;
        bid.counterProposalHash = counterProposalHash;

        emit CounterOfferMade(
            taskId,
            bidder,
            counterPrice,
            counterTimeEstimate,
            counterProposalHash
        );
    }


    /**
     * @notice Submit a bid on an open task
     * @param taskId The ID of the task to bid on
     * @param price Bid price in wei
     * @param timeEstimate Estimated completion time in seconds
     * @param proposalHash IPFS hash of the bid proposal (encrypted)
     */
    function submitBid(
        uint256 taskId,
        uint256 price,
        uint256 timeEstimate,
        string calldata proposalHash
    ) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Open, "Task is not open for bidding");
        require(block.timestamp <= task.deadline, "Task deadline has passed");
        require(price > 0, "Bid price must be positive");
        require(timeEstimate > 0, "Time estimate must be positive");
        require(bytes(proposalHash).length > 0, "Proposal hash required");

        // Verify bidder is a registered agent
        AgentRegistry.Agent memory bidderAgent = agentRegistry.getAgent(msg.sender);
        require(bidderAgent.isActive == 1, "Bidder not registered");

        // Store or update bid
        Bid storage bid = bids[taskId][msg.sender];
        bid.price = price;
        bid.timeEstimate = timeEstimate;
        bid.proposalHash = proposalHash;
        bid.bidAt = block.timestamp;
        bid.bidder = msg.sender;
        bid.hasCounter = false; // Reset counter flag on new bid

        emit BidSubmitted(taskId, msg.sender, price, timeEstimate, proposalHash);
    }

    /**
     * @notice Withdraw a bid from a task
     * @param taskId The ID of the task to withdraw from
     */
    function withdrawBid(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Open, "Task is not open for bidding");
        require(bids[taskId][msg.sender].price > 0, "You have not bid on this task");

        Bid storage bid = bids[taskId][msg.sender];
        delete bids[taskId][msg.sender];

        emit BidWithdrawn(taskId, msg.sender);
    }

    /**
     * @notice Select a worker for the task (client only)
     * @param taskId The ID of the task
     * @param worker The address of the selected worker
     */
    function selectWorker(
        uint256 taskId,
        address worker
    ) external onlyClient(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Open, "Task is not open for selection");
        require(worker != address(0), "Invalid worker address");

        // Verify worker is a registered agent
        AgentRegistry.Agent memory workerAgent = agentRegistry.getAgent(worker);
        require(workerAgent.isActive == 1, "Worker not registered");

        // Find the bid from this worker
        Bid storage bid = bids[taskId][worker];
        require(bid.price > 0, "Selected worker has not bid on this task");

        // Select the worker
        task.selectedWorker = worker;
        task.selectedPrice = bid.price;
        task.selectedTimeEstimate = bid.timeEstimate;
        task.selectedProposalHash = bid.proposalHash;
        task.status = TaskStatus.InProgress;

        emit WorkerSelected(
            taskId,
            worker,
            bid.price,
            bid.timeEstimate,
            bid.proposalHash
        );
    }

    /**
     * @notice Submit a counter-offer to a bid (client only)
     * @param taskId The ID of the task
     * @param bidder The address of the bidder to counter-offer
     * @param counterPrice The counter-offer price in wei
     * @param counterTimeEstimate The counter-offer time estimate in seconds
     * @param counterProposalHash IPFS hash of the counter-proposal (encrypted)
     */
    function submitCounterOffer(
        uint256 taskId,
        address bidder,
        uint256 counterPrice,
        uint256 counterTimeEstimate,
        string calldata counterProposalHash
    ) external onlyClient(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Open, "Task is not open for counter-offer");
        require(bids[taskId][bidder].price > 0, "Bidder has not bid on this task");
        require(counterPrice > 0, "Counter price must be positive");
        require(counterTimeEstimate > 0, "Counter time estimate must be positive");
        require(bytes(counterProposalHash).length > 0, "Counter proposal hash required");

        Bid storage bid = bids[taskId][bidder];
        bid.hasCounter = true;
        bid.counterPrice = counterPrice;
        bid.counterTimeEstimate = counterTimeEstimate;
        bid.counterProposalHash = counterProposalHash;

        emit CounterOfferMade(
            taskId,
            bidder,
            counterPrice,
            counterTimeEstimate,
            counterProposalHash
        );
    }

    /**
     * @notice Accept a counter-offer (bidder only)
     * @param taskId The ID of the task
     */
    function acceptCounterOffer(uint256 taskId) external {
        Bid storage bid = bids[taskId][msg.sender];
        require(bid.hasCounter, "No counter-offer exists to accept");
        require(bid.price > 0, "You have not bid on this task");

        // Update bid with counter-offer values
        bid.price = bid.counterPrice;
        bid.timeEstimate = bid.counterTimeEstimate;
        bid.proposalHash = bid.counterProposalHash;
        bid.hasCounter = false; // Clear counter flag

        emit CounterOfferAccepted(taskId, msg.sender);
    }

    /**
     * @notice Reject a counter-offer (bidder only)
     * @param taskId The ID of the task
     */
    function rejectCounterOffer(uint256 taskId) external {
        Bid storage bid = bids[taskId][msg.sender];
        require(bid.hasCounter, "No counter-offer exists to reject");
        require(bid.price > 0, "You have not bid on this task");

        // Clear counter-offer values
        bid.hasCounter = false;
        bid.counterPrice = 0;
        bid.counterTimeEstimate = 0;
        bid.counterProposalHash = "";

        emit CounterOfferRejected(taskId, msg.sender);
    }

    /**
     * @notice Mark task as completed (worker only)
     * @param taskId The ID of the task
     */
    function completeTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(msg.sender == task.selectedWorker, "Only selected worker can complete task");
        require(task.status == TaskStatus.InProgress, "Task is not in progress");
        require(block.timestamp <= task.deadline, "Task deadline has passed");

        task.status = TaskStatus.Completed;

        emit TaskCompleted(taskId, msg.sender, task.selectedPrice);
    }

    /**
     * @notice Cancel a task (client only)
     * @param taskId The ID of the task
     */
    function cancelTask(uint256 taskId) external onlyClient(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Open, "Only open tasks can be cancelled");

        task.status = TaskStatus.Cancelled;

        // Refund any deposits if needed (implementation depends on payment mechanism)
    }

    // ============ VIEW FUNCTIONS ============
    /**
     * @notice Get task details
     */
    function getTask(uint256 taskId)
        external
        view
        returns (
            address client,
            uint256 maxPayment,
            uint256 deadline,
            string memory descriptionHash,
            TaskStatus status,
            uint256 postedAt,
            address selectedWorker,
            uint256 selectedPrice,
            uint256 selectedTimeEstimate,
            string memory selectedProposalHash
        )
    {
        Task storage task = tasks[taskId];
        return (
            task.client,
            task.maxPayment,
            task.deadline,
            task.descriptionHash,
            task.status,
            task.postedAt,
            task.selectedWorker,
            task.selectedPrice,
            task.selectedTimeEstimate,
            task.selectedProposalHash
        );
    }

    /**
     * @notice Debug function to check agent status (for testing)
     * @dev Returns whether the msg.sender is an active agent
     */
    function debugCheckAgentStatus() external view returns (bool) {
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(msg.sender);
        return agent.isActive == 1;
    }

    /**
     * @notice Get bid details
     */
    function getBid(uint256 taskId, address bidder)
        external
        view
        returns (
            uint256 price,
            uint256 timeEstimate,
            string memory proposalHash,
            uint256 bidAt,
            address bidderAddr,
            bool hasCounter,
            uint256 counterPrice,
            uint256 counterTimeEstimate,
            string memory counterProposalHash
        )
    {
        Bid storage bid = bids[taskId][bidder];
        return (
            bid.price,
            bid.timeEstimate,
            bid.proposalHash,
            bid.bidAt,
            bid.bidder,
            bid.hasCounter,
            bid.counterPrice,
            bid.counterTimeEstimate,
            bid.counterProposalHash
        );
    }

    /**
     * @notice Get task count
     */
    function taskCount() external view returns (uint256) {
        return taskCounter;
    }

    /**
     * @notice Get all task IDs
     */
    function getAllTasks() external view returns (uint256[] memory) {
        uint256[] memory taskIds = new uint256[](taskCounter);
        for (uint256 i = 1; i <= taskCounter; i++) {
            taskIds[i - 1] = i;
        }
        return taskIds;
    }
}