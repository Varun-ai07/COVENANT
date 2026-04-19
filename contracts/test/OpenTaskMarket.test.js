import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("OpenTaskMarket", function () {
  let registry, market, owner, client, bidder1, bidder2, bidder3;
  const MIN_STAKE = ethers.parseEther("0.001");
  const DESCRIPTION_HASH = "QmOpenTaskDescription123";
  const PROPOSAL_HASH = "QmProposalHash456";

  async function deployFixture() {
    console.log("=== STARTING deployFixture ===");
    const [owner, client, bidder1, bidder2, bidder3] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("AgentRegistry");
    const registry = await Registry.deploy();

    // Give all bidders enough ETH to stake
    await owner.sendTransaction({ to: bidder1.address, value: ethers.parseEther("1") });
    await owner.sendTransaction({ to: bidder2.address, value: ethers.parseEther("1") });
    await owner.sendTransaction({ to: bidder3.address, value: ethers.parseEther("1") });
    // Give client ETH for registration stake
    await owner.sendTransaction({ to: client.address, value: ethers.parseEther("0.01") });

    // Wait for funding transactions to be confirmed
    await ethers.provider.send("evm_mine", []);

    // Register all agents
    await registry.connect(client).register("ClientAgent", ["hiring"], { value: MIN_STAKE });
    await registry.connect(bidder1).register("Bidder1", ["coding"], { value: MIN_STAKE });
    await registry.connect(bidder2).register("Bidder2", ["design"], { value: MIN_STAKE });
    await registry.connect(bidder3).register("Bidder3", ["analysis"], { value: MIN_STAKE });

    // Wait for registration transactions to be confirmed
    await ethers.provider.send("evm_mine", []);

    // Debug: Check if client is actually registered and active
    const clientAgent = await registry.getAgent(client.address);
    console.log("Client agent info:", {
      address: client.address,
      isActive: clientAgent.isActive,
      name: clientAgent.name,
      capabilities: clientAgent.capabilities,
      reputation: clientAgent.reputation.toString()
    });

    const Market = await ethers.getContractFactory("OpenTaskMarket");
    const market = await Market.deploy(await registry.getAddress());
    // Authorize market to call registry for reputation updates
    await registry.connect(owner).addAuthorizedContract(await market.getAddress());
    // Wait for authorization transaction to be confirmed
    await ethers.provider.send("evm_mine", []);

    // Debug: Check market's registry address and client agent status via market's registry
    const marketRegistryAddress = await market.agentRegistry();
    console.log("Market's registry address:", marketRegistryAddress);
    const marketRegistry = await ethers.getContractAt("AgentRegistry", marketRegistryAddress);
    const marketClientAgent = await marketRegistry.getAgent(client.address);
    console.log("Client agent as seen by market's registry:", {
      address: client.address,
      isActive: marketClientAgent.isActive,
      name: marketClientAgent.name
    });

    return { registry, market, owner, client, bidder1, bidder2, bidder3 };
  }

  describe("Posting Tasks", function () {
    it("should post an open task successfully", async function () {
      const { market, client, registry } = await loadFixture(deployFixture);
      const maxPayment = ethers.parseEther("0.5");
      const deadline = (await time.latest()) + 86400;

      // Debug: Check addresses
      console.log("Client address:", client.address);
      console.log("Registry address from fixture:", await registry.getAddress());
      console.log("Registry address in market:", await market.agentRegistry());
      console.log("Are they equal?", (await registry.getAddress()) === (await market.agentRegistry()));

      // Debug: Check client agent status again right before posting
      const clientAgentBeforePost = await registry.getAgent(client.address);
      console.log("Client agent info before post:", {
        address: client.address,
        isActive: clientAgentBeforePost.isActive,
        name: clientAgentBeforePost.name
      });

      // Debug: Check what the market contract sees
      const marketRegistryAddress = await market.agentRegistry();
      console.log("Market's registry address:", marketRegistryAddress);
      const marketRegistry = await ethers.getContractAt("AgentRegistry", marketRegistryAddress);
      const marketClientAgent = await marketRegistry.getAgent(client.address);
      console.log("Client agent as seen by market contract:", {
        address: client.address,
        isActive: marketClientAgent.isActive,
        name: marketClientAgent.name,
        reputation: marketClientAgent.reputation.toString()
      });

      // Debug: Check agent status through market contract (as client)
      const agentStatusViaMarket = await market.connect(client).debugCheckAgentStatus();
      console.log("Client agent status via market contract:", agentStatusViaMarket);

      // Let's also debug what happens inside the postTask call by adding a test that calls registry directly
      console.log("Testing direct registry call from test:");
      const directAgent = await registry.getAgent(client.address);
      console.log("Direct registry call result:", {
        address: client.address,
        isActive: directAgent.isActive,
        name: directAgent.name
      });

      // Debug: Check the actual sender
      console.log("About to call postTask with client.address:", client.address);
      console.log("Market contract address:", await market.getAddress());
      console.log("Caller address in test:", client.address);

      await expect(
        market.connect(client).postTask(maxPayment, deadline, DESCRIPTION_HASH)
      )
        .to.emit(market, "TaskPosted")
        .withArgs(1, client.address, maxPayment, deadline, DESCRIPTION_HASH);

      const task = await market.getTask(1);
      expect(task.client).to.equal(client.address);
      expect(task.maxPayment).to.equal(maxPayment);
      expect(task.deadline).to.equal(deadline);
      expect(task.status).to.equal(0); // Open
    });

    it("should reject zero payment", async function () {
      const { market, client } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;
      await expect(market.connect(client).postOpenTask(0, deadline, DESCRIPTION_HASH))
        .to.be.revertedWithCustomError(market, "ZeroPayment");
    });

    it("should reject past deadline", async function () {
      const { market, client } = await loadFixture(deployFixture);
      await expect(
        market.connect(client).postOpenTask(ethers.parseEther("0.1"), 100, DESCRIPTION_HASH)
      ).to.be.revertedWithCustomError(market, "DeadlinePast");
    });

    it("should reject empty description hash", async function () {
      const { market, client } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;
      await expect(market.connect(client).postOpenTask(ethers.parseEther("0.1"), deadline, ""))
        .to.be.revertedWithCustomError(market, "EmptyDescriptionHash");
    });

    it("should reject posting from unregistered agent", async function () {
      const { market, owner } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;
      await expect(
        market.connect(owner).postOpenTask(ethers.parseEther("0.1"), deadline, DESCRIPTION_HASH)
      ).to.be.revertedWithCustomError(market, "AgentNotActive");
    });
  });

  describe("Submitting Bids", function () {
    let taskId;
    let fixture;

    beforeEach(async function () {
      console.log("=== SUBMITTING BIDS BEFORE EACH ===");
      fixture = await loadFixture(deployFixture);
      console.log("Client address:", fixture.client.address);

      // Check client agent status
      const clientAgent = await fixture.registry.getAgent(fixture.client.address);
      console.log("Client agent status:", {
        address: fixture.client.address,
        isActive: clientAgent.isActive,
        name: clientAgent.name
      });

      // Debug: Check market's registry address
      const marketRegistryAddress = await fixture.market.agentRegistry();
      console.log("Market's registry address:", marketRegistryAddress);
      console.log("Registry address from fixture:", await fixture.registry.getAddress());
      console.log("Are they equal?", marketRegistryAddress === await fixture.registry.getAddress());

      // Debug: Check agent status through market contract (as client)
      const agentStatusViaMarket = await fixture.market.connect(fixture.client).debugCheckAgentStatus();
      console.log("Client agent status via market contract:", agentStatusViaMarket);

      // Debug: Check what the market contract sees for the client agent
      const marketRegistry = await ethers.getContractAt("AgentRegistry", marketRegistryAddress);
      const marketClientAgent = await marketRegistry.getAgent(fixture.client.address);
      console.log("Client agent as seen by market's registry:", {
        address: fixture.client.address,
        isActive: marketClientAgent.isActive,
        name: marketClientAgent.name
      });

      // Debug: Check agent status via registry when called as client
      const clientAgentViaRegistryAsClient = await fixture.registry.connect(fixture.client).getAgent(fixture.client.address);
      console.log("Client agent as seen by registry when called as client:", {
        address: fixture.client.address,
        isActive: clientAgentViaRegistryAsClient.isActive,
        name: clientAgentViaRegistryAsClient.name
      });

      // Additional debug: Check the actual addresses being used
      console.log("Fixture client address:", fixture.client.address);
      const marketAddress = await fixture.market.getAddress();
      console.log("Fixture market address:", marketAddress);

      const deadline = (await time.latest()) + 86400;
      console.log("About to post task with params:");
      console.log("  maxPayment:", ethers.parseEther("1").toString());
      console.log("  deadline:", deadline);
      console.log("  descriptionHash:", DESCRIPTION_HASH);
      console.log("  client address (will be msg.sender):", fixture.client.address);

      // Ensure all transactions are mined
      await ethers.provider.send("evm_mine", []);

      console.log("Calling postTask...");
      const tx = await fixture.market.connect(fixture.client).postTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      console.log("Transaction sent, waiting for receipt...");
      const receipt = await tx.wait();
      console.log("Task posted successfully! Task ID:", 1);
      taskId = 1;
    });

    it("should allow a bidder to submit a bid", async function () {
      const { market, bidder1 } = fixture;
      const bidPrice = ethers.parseEther("0.3");
      const timeEstimate = 3600;

      await expect(
        market.connect(bidder1).submitBid(taskId, bidPrice, timeEstimate, PROPOSAL_HASH)
      )
        .to.emit(market, "BidSubmitted")
        .withArgs(taskId, bidder1.address, bidPrice, timeEstimate, PROPOSAL_HASH);

      const task = await market.getTask(taskId);
      const [price, timeEstimate, proposal, bidAt, bidder, hasCounter, counterPrice, counterTimeEstimate, counterProposal] = await market.getBid(taskId, bidder1.address);
      expect(price).to.be.gt(0);
      expect(bidder).to.equal(bidder1.address);
    });

    it("should reject duplicate bids from same bidder", async function () {
      const { market, bidder1 } = fixture;
      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      await expect(
        market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.25"), 7200, PROPOSAL_HASH)
      ).to.be.revertedWithCustomError(market, "AlreadyBidded");
    });

    it("should reject zero-priced bid", async function () {
      const { market, bidder1 } = fixture;
      await expect(
        market.connect(bidder1).submitBid(taskId, 0, 3600, PROPOSAL_HASH)
      ).to.be.revertedWithCustomError(market, "BidBelowMin");
    });

    it("should reject bid from unregistered agent", async function () {
      const { market, owner } = fixture;
      await expect(
        market.connect(owner).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH)
      ).to.be.reverted; // AgentNotActive or not registered
    });

    it("should allow multiple bidders on the same task", async function () {
      const { market, bidder1, bidder2 } = fixture;
      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      await market.connect(bidder2).submitBid(taskId, ethers.parseEther("0.25"), 7200, PROPOSAL_HASH);

      const bid1 = await market.getBid(taskId, bidder1.address);
      const bid2 = await market.getBid(taskId, bidder2.address);
      expect(bid1.price).to.be.gt(0);
      expect(bid2.price).to.be.gt(0);
    });

    it("should return all bids for a task", async function () {
      const { market, bidder1, bidder2 } = fixture;
      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      await market.connect(bidder2).submitBid(taskId, ethers.parseEther("0.25"), 7200, PROPOSAL_HASH);

      const bid1 = await market.getBid(taskId, bidder1.address);
      const bid2 = await market.getBid(taskId, bidder2.address);
      expect(bid1.price).to.equal(ethers.parseEther("0.3"));
      expect(bid2.price).to.equal(ethers.parseEther("0.25"));
      expect(bid1.timeEstimate).to.equal(3600);
      expect(bid2.timeEstimate).to.equal(7200);
    });
  });

  describe("Selecting Workers", function () {
    let taskId;

    beforeEach(async function () {
      console.log("=== SELECTING WORKERS BEFORE EACH ===");
      const { market, client, registry } = await loadFixture(deployFixture);
      console.log("Client address:", client.address);

      // Check client agent status
      const clientAgent = await registry.getAgent(client.address);
      console.log("Client agent status:", {
        address: client.address,
        isActive: clientAgent.isActive,
        name: clientAgent.name
      });

      // Debug: Check agent status through market contract (as client)
      const agentStatusViaMarket = await market.connect(client).debugCheckAgentStatus();
      console.log("Client agent status via market contract:", agentStatusViaMarket);

      const deadline = (await time.latest()) + 86400;
      await market.connect(client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;
      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      await market.connect(bidder2).submitBid(taskId, ethers.parseEther("0.25"), 7200, PROPOSAL_HASH);
    });

    it("should allow client to select a worker", async function () {
      const { market, client, bidder1 } = fixture;
      await expect(market.connect(client).selectWorker(taskId, bidder1.address))
        .to.emit(market, "WorkerSelected")
        .withArgs(taskId, bidder1.address, ethers.parseEther("0.3"));

      const task = await market.getTask(taskId);
      expect(task.selectedWorker).to.equal(bidder1.address);
      expect(task.status).to.equal(1); // Selected
    });

    it("should reject selecting a non-bidder", async function () {
      const { market, client, bidder3 } = fixture;
      await expect(market.connect(client).selectWorker(taskId, bidder3.address))
        .to.be.revertedWithCustomError(market, "InvalidWorker");
    });

    it("should reject non-client selecting worker", async function () {
      const { market, bidder1 } = fixture;
      await expect(market.connect(bidder1).selectWorker(taskId, bidder1.address))
        .to.be.revertedWithCustomError(market, "NotTaskClient");
    });

    it("should reject selecting worker twice", async function () {
      const { market, client, bidder1, bidder2 } = fixture;
      await market.connect(client).selectWorker(taskId, bidder1.address);
      await expect(market.connect(client).selectWorker(taskId, bidder2.address))
        .to.be.revertedWithCustomError(market, "TaskAlreadySelected");
    });
  });

  describe("Withdrawing Bids", function () {
    let taskId;

    beforeEach(async function () {
      console.log("=== WITHDRAWING BIDS BEFORE EACH ===");
      const { market, client, registry } = await loadFixture(deployFixture);
      console.log("Client address:", client.address);

      // Check client agent status
      const clientAgent = await registry.getAgent(client.address);
      console.log("Client agent status:", {
        address: client.address,
        isActive: clientAgent.isActive,
        name: clientAgent.name
      });

      // Debug: Check agent status through market contract (as client)
      const agentStatusViaMarket = await market.connect(client).debugCheckAgentStatus();
      console.log("Client agent status via market contract:", agentStatusViaMarket);

      const deadline = (await time.latest()) + 86400;
      await market.connect(client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;
      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
    });

    it("should allow bidder to withdraw bid", async function () {
      const { market, bidder1 } = fixture;
      await expect(market.connect(bidder1).withdrawBid(taskId))
        .to.emit(market, "BidWithdrawn")
        .withArgs(taskId, bidder1.address);

      const task = await market.getTask(taskId);
      expect(task.bidders.length).to.equal(0);
    });

    it("should reject withdrawing from non-bidder", async function () {
      const { market, bidder2 } = fixture;
      await expect(market.connect(bidder2).withdrawBid(taskId))
        .to.be.revertedWithCustomError(market, "NotBidder");
    });

    it("should reject withdrawing after worker selection", async function () {
      const { market, client, bidder1 } = fixture;
      await market.connect(client).selectWorker(taskId, bidder1.address);
      await expect(market.connect(bidder1).withdrawBid(taskId))
        .to.be.revertedWithCustomError(market, "BiddingClosed");
    });
  });

  describe("Confirm and Pay", function () {
    let taskId;

    beforeEach(async function () {
      console.log("=== CONFIRM AND PAY BEFORE EACH ===");
      const { market, client, registry } = await loadFixture(deployFixture);
      console.log("Client address:", client.address);

      // Check client agent status
      const clientAgent = await registry.getAgent(client.address);
      console.log("Client agent status:", {
        address: client.address,
        isActive: clientAgent.isActive,
        name: clientAgent.name
      });

      // Debug: Check agent status through market contract (as client)
      const agentStatusViaMarket = await market.connect(client).debugCheckAgentStatus();
      console.log("Client agent status via market contract:", agentStatusViaMarket);

      const deadline = (await time.latest()) + 86400;
      await market.connect(client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;
      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      await market.connect(client).selectWorker(taskId, bidder1.address);
    });

    it("should pay worker on success", async function () {
      const { market, client, bidder1 } = fixture;
      const workerBalanceBefore = await ethers.provider.getBalance(bidder1.address);
      const clientBalanceBefore = await ethers.provider.getBalance(client.address);

      // Client needs to fund the payment (price = 0.3 ETH + 1% fee)
      const payment = ethers.parseEther("0.3");
      const fee = (payment * 100n) / 10000n;
      const totalNeeded = payment; // Worker receives payment - fee
      // Actually: market contract sends { value: payment } via confirmAndPay? Let me check.
      // The confirmAndPay reads payment from the task's bid price, it takes ETH from contract balance.
      // So the market contract must hold the ETH.
      // We need to send ETH to the market contract first.

      await client.sendTransaction({
        to: await market.getAddress(),
        value: totalNeeded,
      });

      await market.connect(client).confirmAndPay(taskId, true);

      const workerBalanceAfter = await ethers.provider.getBalance(bidder1.address);
      // Worker gets payment - fee (1% protocol fee = 0.3 * 0.01 = 0.003 ETH)
      const feeAmount = (payment * 100n) / 10000n;
      const workerPayment = payment - feeAmount;
      expect(workerBalanceAfter - workerBalanceBefore).to.be.closeTo(workerPayment, ethers.parseEther("0.0001"));

      const task = await market.getTask(taskId);
      expect(task.status).to.equal(2); // Completed
    });

    it("should penalize worker on failure", async function () {
      const { market, client, registry, bidder1 } = fixture;
      // Fund market
      await client.sendTransaction({
        to: await market.getAddress(),
        value: ethers.parseEther("0.3"),
      });

      const workerAgentBefore = await registry.getAgent(bidder1.address);

      await market.connect(client).confirmAndPay(taskId, false);

      // Worker should be penalized: reputation -50
      const workerAgentAfter = await registry.getAgent(bidder1.address);
      expect(workerAgentAfter.reputation).to.be.lt(workerAgentBefore.reputation);
    });

    it("should reject pay from non-client", async function () {
      const { market, bidder1 } = fixture;
      await expect(market.connect(bidder1).confirmAndPay(taskId, true))
        .to.be.revertedWithCustomError(market, "NotTaskClient");
    });
  });

  describe("Cancel Task", function () {
    let taskId;

    beforeEach(async function () {
      console.log("=== CANCEL TASK BEFORE EACH ===");
      const { market, client, registry } = await loadFixture(deployFixture);
      console.log("Client address:", client.address);

      // Check client agent status
      const clientAgent = await registry.getAgent(client.address);
      console.log("Client agent status:", {
        address: client.address,
        isActive: clientAgent.isActive,
        name: clientAgent.name
      });

      // Debug: Check agent status through market contract (as client)
      const agentStatusViaMarket = await market.connect(client).debugCheckAgentStatus();
      console.log("Client agent status via market contract:", agentStatusViaMarket);

      const deadline = (await time.latest()) + 86400;
      await market.connect(client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;
      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
    });

    it("should allow client to cancel task", async function () {
      const { market, client } = fixture;
      await market.connect(client).cancelTask(taskId);
      const task = await market.getTask(taskId);
      expect(task.status).to.equal(3); // Cancelled
    });

    it("should reject cancel after worker selection", async function () {
      const { market, client, bidder1 } = fixture;
      await market.connect(client).selectWorker(taskId, bidder1.address);
      await expect(market.connect(client).cancelTask(taskId))
        .to.be.revertedWithCustomError(market, "BiddingClosed");
    });

    it("should reject cancel from non-client", async function () {
      const { market, bidder1 } = fixture;
      await expect(market.connect(bidder1).cancelTask(taskId))
        .to.be.revertedWithCustomError(market, "NotTaskClient");
    });
  });

  describe("Get Bid", function () {
    let taskId;

    beforeEach(async function () {
      console.log("=== GET BID BEFORE EACH ===");
      const { market, client, registry } = await loadFixture(deployFixture);
      console.log("Client address:", client.address);

      // Check client agent status
      const clientAgent = await registry.getAgent(client.address);
      console.log("Client agent status:", {
        address: client.address,
        isActive: clientAgent.isActive,
        name: clientAgent.name
      });

      // Debug: Check agent status through market contract (as client)
      const agentStatusViaMarket = await market.connect(client).debugCheckAgentStatus();
      console.log("Client agent status via market contract:", agentStatusViaMarket);

      const deadline = (await time.latest()) + 86400;
      await market.connect(client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;
      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
    });

    it("should return specific bid details", async function () {
      const { market, bidder1 } = fixture;
      const [price, timeEstimate, proposal, bidAt] = await market.getBid(taskId, bidder1.address);
      expect(price).to.equal(ethers.parseEther("0.3"));
      expect(timeEstimate).to.equal(3600);
      expect(bidAt).to.be.gt(0);
    });
  });
});
