import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("OpenTaskMarket", function () {
  let registry, market, owner, client, bidder1, bidder2, bidder3;
  const MIN_STAKE = ethers.parseEther("0.001");
  const DESCRIPTION_HASH = ethers.encodeBytes32String("QmOpenTaskDescription123");
  const PROPOSAL_HASH = ethers.encodeBytes32String("QmProposalHash456");

  async function deployFixture() {
    const [owner, client, bidder1, bidder2, bidder3] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("AgentRegistry");
    registry = await Registry.deploy();

    // Give all bidders enough ETH to stake
    await owner.sendTransaction({ to: bidder1.address, value: ethers.parseEther("1") });
    await owner.sendTransaction({ to: bidder2.address, value: ethers.parseEther("1") });
    await owner.sendTransaction({ to: bidder3.address, value: ethers.parseEther("1") });

    // Register all agents
    await registry.connect(client).register("ClientAgent", ["hiring"], { value: MIN_STAKE });
    await registry.connect(bidder1).register("Bidder1", ["coding"], { value: MIN_STAKE });
    await registry.connect(bidder2).register("Bidder2", ["design"], { value: MIN_STAKE });
    await registry.connect(bidder3).register("Bidder3", ["analysis"], { value: MIN_STAKE });

    const Market = await ethers.getContractFactory("OpenTaskMarket");
    market = await Market.deploy(await registry.getAddress());
    // Authorize market to call registry for reputation updates
    await registry.addAuthorizedContract(await market.getAddress());

    return { registry, market, owner, client, bidder1, bidder2, bidder3 };
  }

  describe("Posting Tasks", function () {
    it("should post an open task successfully", async function () {
      const { market, client } = await loadFixture(deployFixture);
      const maxPayment = ethers.parseEther("0.5");
      const deadline = (await time.latest()) + 86400;

      await expect(
        market.connect(client).postOpenTask(maxPayment, deadline, DESCRIPTION_HASH)
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
      await expect(market.connect(client).postOpenTask(ethers.parseEther("0.1"), deadline, ethers.ZeroHash))
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
      fixture = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;
      const tx = await fixture.market.connect(fixture.client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      const receipt = await tx.wait();
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
        .withArgs(taskId, bidder1.address, bidPrice, timeEstimate);

      const task = await market.getTask(taskId);
      expect(task.bidders.length).to.equal(1);
      expect(task.bidders[0]).to.equal(bidder1.address);
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

      const task = await market.getTask(taskId);
      expect(task.bidders.length).to.equal(2);
    });

    it("should return all bids for a task", async function () {
      const { market, bidder1, bidder2 } = fixture;
      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      await market.connect(bidder2).submitBid(taskId, ethers.parseEther("0.25"), 7200, PROPOSAL_HASH);

      const [bidders, prices, timeEstimates, proposals, bidAts] = await market.getAllBids(taskId);
      expect(bidders.length).to.equal(2);
      expect(prices[0]).to.equal(ethers.parseEther("0.3"));
      expect(prices[1]).to.equal(ethers.parseEther("0.25"));
      expect(timeEstimates[0]).to.equal(3600);
      expect(timeEstimates[1]).to.equal(7200);
    });
  });

  describe("Selecting Workers", function () {
    let taskId;
    let fixture;

    beforeEach(async function () {
      fixture = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;
      await fixture.market.connect(fixture.client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;
      await fixture.market.connect(fixture.bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      await fixture.market.connect(fixture.bidder2).submitBid(taskId, ethers.parseEther("0.25"), 7200, PROPOSAL_HASH);
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
    let fixture;

    beforeEach(async function () {
      fixture = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;
      await fixture.market.connect(fixture.client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;
      await fixture.market.connect(fixture.bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
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
    let fixture;

    beforeEach(async function () {
      fixture = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;
      await fixture.market.connect(fixture.client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;
      await fixture.market.connect(fixture.bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      await fixture.market.connect(fixture.client).selectWorker(taskId, fixture.bidder1.address);
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
    let fixture;

    beforeEach(async function () {
      fixture = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;
      await fixture.market.connect(fixture.client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;
      await fixture.market.connect(fixture.bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
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
    let fixture;

    beforeEach(async function () {
      fixture = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;
      await fixture.market.connect(fixture.client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;
      await fixture.market.connect(fixture.bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
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
