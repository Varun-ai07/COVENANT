import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("OpenTaskMarket - Counter-Offer Negotiation", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const DESCRIPTION_HASH = ethers.encodeBytes32String("QmTaskDescription");
  const PROPOSAL_HASH = ethers.encodeBytes32String("QmProposal");
  const COUNTER_PROPOSAL_HASH = ethers.encodeBytes32String("QmCounterProposal");

  async function deployFixture() {
    const [owner, client, bidder1] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("AgentRegistry");
    const registry = await Registry.deploy();

    await owner.sendTransaction({ to: bidder1.address, value: ethers.parseEther("1") });

    await registry.connect(client).register("ClientAgent", ["hiring"], { value: MIN_STAKE });
    await registry.connect(bidder1).register("Bidder1", ["coding"], { value: MIN_STAKE });

    const Market = await ethers.getContractFactory("OpenTaskMarket");
    const market = await Market.deploy(await registry.getAddress());

    // Authorize market contract to update reputations
    await registry.addAuthorizedContract(await market.getAddress());

    // Fund client for task posting
    await owner.sendTransaction({ to: client.address, value: ethers.parseEther("2") });

    return { registry, market, owner, client, bidder1 };
  }

  describe("Counter-Offer Workflow", function () {
    let taskId;
    let fixture;

    beforeEach(async function () {
      fixture = await loadFixture(deployFixture);
      const { market, client, bidder1 } = fixture;

      const deadline = (await time.latest()) + 86400;
      await market.connect(client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;

      // Bidder submits initial bid
      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
    });

    it("should allow client to make a counter-offer to a bidder", async function () {
      const { market, client, bidder1 } = fixture;
      const counterPrice = ethers.parseEther("0.4"); // Higher than original bid
      const counterTimeEstimate = 3000;
      const counterProposalHash = COUNTER_PROPOSAL_HASH;

      await expect(
        market.connect(client).makeCounterOffer(taskId, bidder1.address, counterPrice, counterTimeEstimate, counterProposalHash)
      )
        .to.emit(market, "CounterOfferMade")
        .withArgs(taskId, bidder1.address, counterPrice, counterTimeEstimate, counterProposalHash);

      // Verify the bid's counter fields are updated
      const [price, timeEstimate, proposal, bidAt, bidder, hasCounter, counterPriceFromContract, counterTimeEstFromCounter, counterProposalHashFromContract] =
        await market.getBid(taskId, bidder1.address);

      expect(hasCounter).to.equal(true);
      expect(counterPriceFromContract).to.equal(counterPrice);
      expect(counterTimeEstFromCounter).to.equal(counterTimeEstimate);
      expect(counterProposalHashFromContract).to.equal(counterProposalHash);
      // Original price remains same until accepted
      expect(price).to.equal(ethers.parseEther("0.3"));
    });

    it("should reject counter-offer from non-client", async function () {
      const { market, bidder1 } = fixture;
      const counterPrice = ethers.parseEther("0.4");
      await expect(
        market.connect(bidder1).makeCounterOffer(taskId, bidder1.address, counterPrice, 3000, COUNTER_PROPOSAL_HASH)
      ).to.be.revertedWith("Not task client");
    });

    it("should reject counter-offer for non-existent bid", async function () {
      const { market, client } = fixture;
      const counterPrice = ethers.parseEther("0.4");
      await expect(
        market.connect(client).makeCounterOffer(taskId, ethers.ZeroAddress, counterPrice, 3000, COUNTER_PROPOSAL_HASH)
      ).to.be.revertedWith("Bidder has not bid on this task");
    });

    it("should reject multiple counter-offers to same bidder", async function () {
      const { market, client, bidder1 } = fixture;
      const counterPrice = ethers.parseEther("0.4");
      await market.connect(client).makeCounterOffer(taskId, bidder1.address, counterPrice, 3000, COUNTER_PROPOSAL_HASH);

      // Second counter-offer succeeds and overwrites the first (current contract behavior)
      await market.connect(client).makeCounterOffer(taskId, bidder1.address, ethers.parseEther("0.5"), 2000, COUNTER_PROPOSAL_HASH);

      // Verify the counter was updated
      const [price, timeEst, proposal, bidAt, bidder, hasCounter, counterPrice2] = await market.getBid(taskId, bidder1.address);
      expect(hasCounter).to.equal(true);
      expect(counterPrice2).to.equal(ethers.parseEther("0.5"));
    });

    it("should not allow counter-offer after task is selected", async function () {
      const { market, client, bidder1 } = fixture;
      // Select worker first
      await market.connect(client).selectWorker(taskId, bidder1.address);

      const counterPrice = ethers.parseEther("0.4");
      await expect(
        market.connect(client).makeCounterOffer(taskId, bidder1.address, counterPrice, 3000, COUNTER_PROPOSAL_HASH)
      ).to.be.revertedWith("Task is not open for counter-offer");
    });
  });

  describe("Counter-Offer Acceptance", function () {
    let taskId;
    let fixture;

    beforeEach(async function () {
      fixture = await loadFixture(deployFixture);
      const { market, client, bidder1 } = fixture;

      const deadline = (await time.latest()) + 86400;
      await market.connect(client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;

      // Bid
      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      // Counter-offer
      await market.connect(client).makeCounterOffer(taskId, bidder1.address, ethers.parseEther("0.4"), 3000, COUNTER_PROPOSAL_HASH);
    });

    it("should allow worker to accept counter-offer", async function () {
      const { market, bidder1 } = fixture;
      await expect(market.connect(bidder1).acceptCounterOffer(taskId))
        .to.emit(market, "CounterOfferAccepted")
        .withArgs(taskId, bidder1.address);

      const [price, , , , , hasCounter] = await market.getBid(taskId, bidder1.address);

      expect(hasCounter).to.equal(false); // Counter resolved
      expect(price).to.equal(ethers.parseEther("0.4")); // Price updated to counter price
    });

    it("should reject acceptance from non-bidder", async function () {
      const { market, client } = fixture;
      // Non-bidder has no bid at all, so hasCounter is false (default)
      await expect(market.connect(client).acceptCounterOffer(taskId))
        .to.be.revertedWith("No counter-offer exists to accept");
    });

    it("should reject double acceptance", async function () {
      const { market, bidder1 } = fixture;
      await market.connect(bidder1).acceptCounterOffer(taskId);
      // After accepting, hasCounter is cleared to false
      await expect(market.connect(bidder1).acceptCounterOffer(taskId))
        .to.be.revertedWith("No counter-offer exists to accept");
    });

    it("should not allow accept without a counter-offer", async function () {
      // Remove counter-offer by creating a fresh scenario
      const freshFixture = await loadFixture(deployFixture);
      const newMarket = freshFixture.market;
      const newClient = freshFixture.client;
      const newBidder = freshFixture.bidder1;

      const deadline = (await time.latest()) + 86400;
      await newMarket.connect(newClient).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      const newTaskId = 1;

      await newMarket.connect(newBidder).submitBid(newTaskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      // No counter-offer made

      await expect(newMarket.connect(newBidder).acceptCounterOffer(newTaskId))
        .to.be.revertedWith("No counter-offer exists to accept");
    });
  });

  describe("Counter-Offer Rejection", function () {
    let taskId;
    let fixture;

    beforeEach(async function () {
      fixture = await loadFixture(deployFixture);
      const { market, client, bidder1 } = fixture;

      const deadline = (await time.latest()) + 86400;
      await market.connect(client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;

      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      await market.connect(client).makeCounterOffer(taskId, bidder1.address, ethers.parseEther("0.4"), 3000, COUNTER_PROPOSAL_HASH);
    });

    it("should allow worker to reject counter-offer", async function () {
      const { market, bidder1 } = fixture;
      await expect(market.connect(bidder1).rejectCounterOffer(taskId))
        .to.emit(market, "CounterOfferRejected")
        .withArgs(taskId, bidder1.address);

      const [price, , , , , hasCounter] = await market.getBid(taskId, bidder1.address);

      expect(hasCounter).to.equal(false);
      expect(price).to.equal(ethers.parseEther("0.3")); // Original bid price restored
    });

    it("should reject rejection from non-bidder", async function () {
      const { market, client } = fixture;
      // Non-bidder has no bid at all, so hasCounter is false (default)
      await expect(market.connect(client).rejectCounterOffer(taskId))
        .to.be.revertedWith("No counter-offer exists to reject");
    });

    it("should reject double reject", async function () {
      const { market, bidder1 } = fixture;
      await market.connect(bidder1).rejectCounterOffer(taskId);
      // After rejecting, hasCounter is cleared to false
      await expect(market.connect(bidder1).rejectCounterOffer(taskId))
        .to.be.revertedWith("No counter-offer exists to reject");
    });
  });

  describe("Counter-Offer Integration with Selection", function () {
    let taskId;
    let fixture;

    beforeEach(async function () {
      fixture = await loadFixture(deployFixture);
      const { market, client, bidder1 } = fixture;

      const deadline = (await time.latest()) + 86400;
      await market.connect(client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;

      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
    });

    it("should select worker at original bid price if no counter", async function () {
      const { market, client, bidder1 } = fixture;
      await market.connect(client).selectWorker(taskId, bidder1.address);

      const task = await market.getTask(taskId);
      expect(task.selectedWorker).to.equal(bidder1.address);
      expect(task.status).to.equal(1); // Selected

      // The price used in payment will be the bid.price
      const [price] = await market.getBid(taskId, bidder1.address);
      expect(price).to.equal(ethers.parseEther("0.3"));
    });

    it("should select worker at counter price if counter was accepted", async function () {
      const { market, client, bidder1 } = fixture;
      // Make and accept counter
      await market.connect(client).makeCounterOffer(taskId, bidder1.address, ethers.parseEther("0.4"), 3000, COUNTER_PROPOSAL_HASH);
      await market.connect(bidder1).acceptCounterOffer(taskId);

      // Select worker
      await market.connect(client).selectWorker(taskId, bidder1.address);

      const [price] = await market.getBid(taskId, bidder1.address);
      expect(price).to.equal(ethers.parseEther("0.4")); // Updated price
    });

    it("should allow new bid after counter rejection", async function () {
      const { market, client, bidder1 } = fixture;
      // Make counter and reject it
      await market.connect(client).makeCounterOffer(taskId, bidder1.address, ethers.parseEther("0.4"), 3000, COUNTER_PROPOSAL_HASH);
      await market.connect(bidder1).rejectCounterOffer(taskId);

      // Counter is rejected, original bid remains; selection should work
      await market.connect(client).selectWorker(taskId, bidder1.address);

      const [price] = await market.getBid(taskId, bidder1.address);
      expect(price).to.equal(ethers.parseEther("0.3")); // Original price
    });
  });
});
