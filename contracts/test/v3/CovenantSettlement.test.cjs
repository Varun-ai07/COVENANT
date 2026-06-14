const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CovenantSettlement V3", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const RATE_PER_SECOND = ethers.parseEther("0.000001");
  const DURATION = 3600;

  async function deploySettlementFixture() {
    const [owner, payer, payee, other] = await ethers.getSigners();

    const Identity = await ethers.getContractFactory("contracts/v3/CovenantIdentity.sol:CovenantIdentity");
    const identity = await Identity.deploy();
    await identity.initialize(MIN_STAKE, owner.address);

    const Settlement = await ethers.getContractFactory("contracts/v3/CovenantSettlement.sol:CovenantSettlement");
    const settlement = await Settlement.deploy();
    await settlement.initialize(identity.target);

    return { settlement, identity, owner, payer, payee, other };
  }

  async function createStream(settlement, payer, payee) {
    const totalCost = RATE_PER_SECOND * BigInt(DURATION);
    await settlement.connect(payer).createStream(
      payee.address,
      RATE_PER_SECOND,
      DURATION,
      ethers.ZeroAddress,
      { value: totalCost }
    );
    return totalCost;
  }

  describe("Stream Creation", function () {
    it("should create a payment stream", async function () {
      const { settlement, payer, payee } = await loadFixture(deploySettlementFixture);

      await createStream(settlement, payer, payee);

      const stream = await settlement.getStream(1);
      expect(stream.payer).to.equal(payer.address);
      expect(stream.payee).to.equal(payee.address);
      expect(stream.ratePerSecond).to.equal(RATE_PER_SECOND);
      expect(stream.active).to.be.true;
    });

    it("should reject zero rate", async function () {
      const { settlement, payer, payee } = await loadFixture(deploySettlementFixture);

      await expect(
        settlement.connect(payer).createStream(
          payee.address,
          0,
          DURATION,
          ethers.ZeroAddress,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWith("rate must be > 0");
    });

    it("should reject zero address payee", async function () {
      const { settlement, payer } = await loadFixture(deploySettlementFixture);

      await expect(
        settlement.connect(payer).createStream(
          ethers.ZeroAddress,
          RATE_PER_SECOND,
          DURATION,
          ethers.ZeroAddress,
          { value: RATE_PER_SECOND * BigInt(DURATION) }
        )
      ).to.be.revertedWith("invalid payee");
    });
  });

  describe("Stream Withdrawal", function () {
    it("should allow payee to withdraw streamed amount", async function () {
      const { settlement, payer, payee } = await loadFixture(deploySettlementFixture);

      await createStream(settlement, payer, payee);

      await time.increase(100);

      const claimable = await settlement.claimableAmount(1);
      expect(claimable).to.be.greaterThan(0);

      const balanceBefore = await ethers.provider.getBalance(payee.address);
      const tx = await settlement.connect(payee).withdrawStream(1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(payee.address);

      expect(balanceAfter - balanceBefore + gasCost).to.be.closeTo(claimable, ethers.parseEther("0.0001"));
    });

    it("should reject withdrawal by non-payee", async function () {
      const { settlement, payer, payee, other } = await loadFixture(deploySettlementFixture);

      await createStream(settlement, payer, payee);

      await time.increase(100);

      await expect(
        settlement.connect(other).withdrawStream(1)
      ).to.be.revertedWith("not payee");
    });
  });

  describe("Stream Cancellation", function () {
    it("should allow payer to cancel and get refund", async function () {
      const { settlement, payer, payee } = await loadFixture(deploySettlementFixture);

      await createStream(settlement, payer, payee);

      await time.increase(100);

      const balanceBefore = await ethers.provider.getBalance(payer.address);
      await settlement.connect(payer).cancelStream(1);
      const balanceAfter = await ethers.provider.getBalance(payer.address);

      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });
  });
});
