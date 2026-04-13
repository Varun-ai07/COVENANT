import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("OpenTaskMarket - Counter-Offer Negotiation", function () {
  let registry, market, owner, client, bidder1;
  const MIN_STAKE = ethers.parseEther("0.001");
  const DESCRIPTION_HASH = ethers.encodeBytes32String("QmTaskDescription");
  const PROPOSAL_HASH = ethers.encodeBytes32String("QmProposal");
  const COUNTER_PROPOSAL_HASH = ethers.encodeBytes32String("QmCounterProposal");

  async function deployFixture() {
    const [owner, client, bidder1] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("AgentRegistry");
    registry = await Registry.deploy();

    await owner.sendTransaction({ to: bidder1.address, value: ethers.parseEther("1") });

    await registry.connect(client).register("ClientAgent", ["hiring"], { value: MIN_STAKE });
    await registry.connect(bidder1).register("Bidder1", ["coding"], { value: MIN_STAKE });

    const Market = await ethers.getContractFactory("OpenTaskMarket");
    market = await Market.deploy(await registry.getAddress());
    await registry.addAuthorizedContract(await market.getAddress());

    return { registry, market, owner, client, bidder1 };
  }

  describe("Counter-Offer Workflow", function () {
    let taskId;

    beforeEach(async function () {
      const fixture = await deployFixture();
      registry = fixture.registry;
      market = fixture.market;
      client = fixture.client;
      bidder1 = fixture.bidder1;

      const deadline = (await time.latest()) + 86400;
      await market.connect(client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;

      // Bidder submits initial bid
      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
    });

    it("should allow client to make a counter-offer to a bidder", async function () {
      const counterPrice = ethers.parseEther("0.4"); // Higher than original bid
      const counterTimeEstimate = 3000;
      const counterProposalHash = COUNTER_PROPOSAL_HASH;

      await expect(
        market.connect(client).makeCounterOffer(taskId, bidder1.address, counterPrice, counterTimeEstimate, counterProposalHash)
      )
        .to.emit(market, "CounterOfferMade")
        .withArgs(taskId, bidder1.address, counterPrice, counterTimeEstimate, counterProposalHash);

      // Verify the bid's counter fields are updated
      const [price, timeEstimate, proposal, bidAt, bidder, hasCounter, counterPriceFromContract, counterTimeEstFromCounter, counterProposalHashFromContract, counterAccepted] =
        await market.getBid(taskId, bidder1.address);

      expect(hasCounter).to.equal(true);
      expect(counterPriceFromContract).to.equal(counterPrice);
      expect(counterTimeEstFromCounter).to.equal(counterTimeEstimate);
      expect(counterProposalHashFromContract).to.equal(counterProposalHash);
      expect(counterAccepted).to.equal(false);
      // Original price remains same until accepted
      expect(price).to.equal(ethers.parseEther("0.3"));
    });

    it("should reject counter-offer from non-client", async function () {
      const counterPrice = ethers.parseEther("0.4");
      await expect(
        market.connect(bidder1).makeCounterOffer(taskId, bidder1.address, counterPrice, 3000, COUNTER_PROPOSAL_HASH)
      ).to.be.revertedWithCustomError(market, "NotTaskClient");
    });

    it("should reject counter-offer for non-existent bid", async function () {
      const counterPrice = ethers.parseEther("0.4");
      await expect(
        market.connect(client).makeCounterOffer(taskId, ethers.ZeroAddress, counterPrice, 3000, COUNTER_PROPOSAL_HASH)
      ).to.be.revertedWith("Bid does not exist");
    });

    it("should reject multiple counter-offers to same bidder", async function () {
      const counterPrice = ethers.parseEther("0.4");
      await market.connect(client).makeCounterOffer(taskId, bidder1.address, counterPrice, 3000, COUNTER_PROPOSAL_HASH);

      // Second counter-offer should fail
      await expect(
        market.connect(client).makeCounterOffer(taskId, bidder1.address, ethers.parseEther("0.5"), 2000, COUNTER_PROPOSAL_HASH)
      ).to.be.revertedWith("Counter already made to this bidder");
    });

    it("should not allow counter-offer after task is selected", async function () {
      // Select worker first
      await market.connect(client).selectWorker(taskId, bidder1.address);

      const counterPrice = ethers.parseEther("0.4");
      await expect(
        market.connect(client).makeCounterOffer(taskId, bidder1.address, counterPrice, 3000, COUNTER_PROPOSAL_HASH)
      ).to.be.revertedWithCustomError(market, "BiddingClosed");
    });
  });

  describe("Counter-Offer Acceptance", function () {
    let taskId;

    beforeEach(async function () {
      const fixture = await deployFixture();
      registry = fixture.registry;
      market = fixture.market;
      client = fixture.client;
      bidder1 = fixture.bidder1;

      const deadline = (await time.latest()) + 86400;
      await market.connect(client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;

      // Bid
      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      // Counter-offer
      await market.connect(client).makeCounterOffer(taskId, bidder1.address, ethers.parseEther("0.4"), 3000, COUNTER_PROPOSAL_HASH);
    });

    it("should allow worker to accept counter-offer", async function () {
      await expect(market.connect(bidder1).acceptCounterOffer(taskId))
        .to.emit(market, "CounterOfferAccepted")
        .withArgs(taskId, bidder1.address, ethers.parseEther("0.4"));

      const [price, , , , , hasCounter, counterPriceFromContract, , , counterAccepted] =
        await market.getBid(taskId, bidder1.address);

      expect(hasCounter).to.equal(false); // Counter resolved
      expect(price).to.equal(ethers.parseEther("0.4")); // Price updated to counter price
      expect(counterAccepted).to.equal(true);
    });

    it("should reject acceptance from non-bidder", async function () {
      await expect(market.connect(client).acceptCounterOffer(taskId))
        .to.be.revertedWithCustomError(market, "NotBidder");
    });

    it("should reject double acceptance", async function () {
      await market.connect(bidder1).acceptCounterOffer(taskId);
      await expect(market.connect(bidder1).acceptCounterOffer(taskId))
        .to.be.revertedWith("Counter already resolved");
    });

    it("should not allow accept without a counter-offer", async function () {
      // Remove counter-offer by creating a fresh scenario
      const fixture = await deployFixture();
      const newMarket = fixture.market;
      const newClient = fixture.client;
      const newBidder = fixture.bidder1;

      const deadline = (await time.latest()) + 86400;
      await newMarket.connect(newClient).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      const newTaskId = 1;

      await newMarket.connect(newBidder).submitBid(newTaskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      // No counter-offer made

      await expect(newMarket.connect(newBidder).acceptCounterOffer(newTaskId))
        .to.be.revertedWith("No counter-offer to accept");
    });
  });

  describe("Counter-Offer Rejection", function () {
    let taskId;

    beforeEach(async function () {
      const fixture = await deployFixture();
      registry = fixture.registry;
      market = fixture.market;
      client = fixture.client;
      bidder1 = fixture.bidder1;

      const deadline = (await time.latest()) + 86400;
      await market.connect(client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;

      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
      await market.connect(client).makeCounterOffer(taskId, bidder1.address, ethers.parseEther("0.4"), 3000, COUNTER_PROPOSAL_HASH);
    });

    it("should allow worker to reject counter-offer", async function () {
      await expect(market.connect(bidder1).rejectCounterOffer(taskId))
        .to.emit(market, "CounterOfferRejected")
        .withArgs(taskId, bidder1.address);

      const [price, , , , , hasCounter] = await market.getBid(taskId, bidder1.address);

      expect(hasCounter).to.equal(false);
      expect(price).to.equal(ethers.parseEther("0.3")); // Original bid price restored
    });

    it("should reject rejection from non-bidder", async function () {
      await expect(market.connect(client).rejectCounterOffer(taskId))
        .to.be.revertedWithCustomError(market, "NotBidder");
    });

    it("should reject double reject", async function () {
      await market.connect(bidder1).rejectCounterOffer(taskId);
      await expect(market.connect(bidder1).rejectCounterOffer(taskId))
        .to.be.revertedWith("Counter already resolved");
    });
  });

  describe("Counter-Offer Integration with Selection", function () {
    let taskId;

    beforeEach(async function () {
      const fixture = await deployFixture();
      registry = fixture.registry;
      market = fixture.market;
      client = fixture.client;
      bidder1 = fixture.bidder1;

      const deadline = (await time.latest()) + 86400;
      await market.connect(client).postOpenTask(ethers.parseEther("1"), deadline, DESCRIPTION_HASH);
      taskId = 1;

      await market.connect(bidder1).submitBid(taskId, ethers.parseEther("0.3"), 3600, PROPOSAL_HASH);
    });

    it("should select worker at original bid price if no counter", async function () {
      await market.connect(client).selectWorker(taskId, bidder1.address);

      const task = await market.getTask(taskId);
      expect(task.selectedWorker).to.equal(bidder1.address);
      expect(task.status).to.equal(1); // Selected

      // The price used in payment will be the bid.price
      const [price] = await market.getBid(taskId, bidder1.address);
      expect(price).to.equal(ethers.parseEther("0.3"));
    });

    it("should select worker at counter price if counter was accepted", async function () {
      // Make and accept counter
      await market.connect(client).makeCounterOffer(taskId, bidder1.address, ethers.parseEther("0.4"), 3000, COUNTER_PROPOSAL_HASH);
      await market.connect(bidder1).acceptCounterOffer(taskId);

      // Select worker
      await market.connect(client).selectWorker(taskId, bidder1.address);

      const [price] = await market.getBid(taskId, bidder1.address);
      expect(price).to.equal(ethers.parseEther("0.4")); // Updated price
    });

    it("should allow new bid after counter rejection", async function () {
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
