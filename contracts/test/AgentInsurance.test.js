import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentInsurance", function () {
  let registry, escrow, verifier, insurance, owner, member1, member2, member3, worker;
  const MIN_STAKE = ethers.parseEther("0.001");

  async function deployFixture() {
    const [owner, member1, member2, member3, worker] = await ethers.getSigners();

    await owner.sendTransaction({ to: member1.address, value: ethers.parseEther("10") });
    await owner.sendTransaction({ to: member2.address, value: ethers.parseEther("10") });
    await owner.sendTransaction({ to: member3.address, value: ethers.parseEther("10") });
    await owner.sendTransaction({ to: worker.address, value: ethers.parseEther("5") });

    const Registry = await ethers.getContractFactory("AgentRegistry");
    registry = await Registry.deploy();

    const Verifier = await ethers.getContractFactory("ReceiptVerifier");
    verifier = await Verifier.deploy();

    const Escrow = await ethers.getContractFactory("TaskEscrow");
    escrow = await Escrow.deploy(await registry.getAddress(), await verifier.getAddress());
    await registry.addAuthorizedContract(await escrow.getAddress());
    await verifier.addAuthorizedIssuer(await escrow.getAddress());

    await registry.connect(member1).register("Member1", ["coding"], { value: MIN_STAKE });
    await registry.connect(member2).register("Member2", ["coding"], { value: MIN_STAKE });
    await registry.connect(member3).register("Member3", ["coding"], { value: MIN_STAKE });
    await registry.connect(worker).register("Worker", ["coding"], { value: MIN_STAKE });

    const Insurance = await ethers.getContractFactory("AgentInsurance");
    insurance = await Insurance.deploy(await registry.getAddress(), await escrow.getAddress());

    return { registry, escrow, insurance, owner, member1, member2, member3, worker };
  }

  describe("Joining Pool", function () {
    it("should allow member to join with minimum deposit", async function () {
      const { insurance, member1 } = await loadFixture(deployFixture);
      const deposit = ethers.parseEther("0.01");

      await expect(insurance.connect(member1).joinPool({ value: deposit }))
        .to.emit(insurance, "MemberJoined").withArgs(member1.address);

      const info = await insurance.getMemberInfo(member1.address);
      expect(info.isMember).to.equal(true);
      expect(info.totalPremiumsPaid).to.equal(deposit);
    });

    it("should reject joining with insufficient deposit", async function () {
      const { insurance, member1 } = await loadFixture(deployFixture);
      await expect(insurance.connect(member1).joinPool({ value: ethers.parseEther("0.005") }))
        .to.be.revertedWith("Minimum deposit is 0.01 ETH");
    });

    it("should reject already-joined member", async function () {
      const { insurance, member1 } = await loadFixture(deployFixture);
      await insurance.connect(member1).joinPool({ value: ethers.parseEther("0.01") });
      await expect(insurance.connect(member1).joinPool({ value: ethers.parseEther("0.01") }))
        .to.be.revertedWith("Already a member");
    });
  });

  describe("Pool Balance", function () {
    it("should track pool balance correctly", async function () {
      const { insurance, member1, member2 } = await loadFixture(deployFixture);
      await insurance.connect(member1).joinPool({ value: ethers.parseEther("0.01") });
      await insurance.connect(member2).joinPool({ value: ethers.parseEther("0.02") });

      expect(await insurance.getPoolBalance()).to.equal(ethers.parseEther("0.03"));
    });
  });

  describe("Member Count", function () {
    it("should increment member count", async function () {
      const { insurance, member1, member2, member3 } = await loadFixture(deployFixture);
      await insurance.connect(member1).joinPool({ value: ethers.parseEther("0.01") });
      await insurance.connect(member2).joinPool({ value: ethers.parseEther("0.01") });
      await insurance.connect(member3).joinPool({ value: ethers.parseEther("0.01") });
      expect(await insurance.memberCount()).to.equal(3);
    });
  });

  describe("Pay Premium", function () {
    it("should allow member to pay premium for an active task", async function () {
      const { insurance, member1, escrow, worker } = await loadFixture(deployFixture);
      await insurance.connect(member1).joinPool({ value: ethers.parseEther("1") });

      const payment = ethers.parseEther("1");
      const fee = (payment * 100n) / 10000n;
      const deadline = (await time.latest()) + 86400;
      await escrow.connect(member1).createAndFundTask(
        worker.address, payment, deadline, "QmTaskDescription", { value: payment + fee }
      );

      // Reputation starts at 500, so premium = 2% of task value
      const premium = (payment * 2n) / 100n;
      await expect(insurance.connect(member1).payPremium(1, { value: premium }))
        .to.emit(insurance, "PremiumPaid");
    });

    it("should reject non-member paying premium", async function () {
      const { insurance, member1 } = await loadFixture(deployFixture);
      await expect(insurance.connect(member1).payPremium(1, { value: ethers.parseEther("0.1") }))
        .to.be.revertedWithCustomError(insurance, "NotMember");
    });
  });

  describe("Claim Insurance", function () {
    it("should reject non-member claiming insurance", async function () {
      const { insurance } = await loadFixture(deployFixture);
      const [_, _m1, _m2, _m3, nonMember] = await ethers.getSigners();
      await expect(insurance.connect(nonMember).claimInsurance(1))
        .to.be.revertedWithCustomError(insurance, "NotMember");
    });

    it("should reject claim when task not failed/disputed", async function () {
      const { insurance, member1, escrow, verifier, worker } = await loadFixture(deployFixture);
      // Worker joins pool so they can claim
      await insurance.connect(worker).joinPool({ value: ethers.parseEther("1") });

      const payment = ethers.parseEther("1");
      const fee = (payment * 100n) / 10000n;
      const deadline = (await time.latest()) + 86400;
      await escrow.connect(member1).createAndFundTask(
        worker.address, payment, deadline, "QmTaskDescription", { value: payment + fee }
      );

      await expect(insurance.connect(worker).claimInsurance(1))
        .to.be.revertedWith("Task has not failed or been disputed");
    });

    it("should accept insurance claim for failed task", async function () {
      const { registry, insurance, member1, escrow, verifier, worker } = await loadFixture(deployFixture);
      await insurance.connect(worker).joinPool({ value: ethers.parseEther("1") });

      const payment = ethers.parseEther("0.1");
      const fee = (payment * 100n) / 10000n;
      const deadline = (await time.latest()) + 86400;
      // Create and fund task
      await escrow.connect(member1).createAndFundTask(
        worker.address, payment, deadline, "QmTaskDesc", { value: payment + fee }
      );

      // Worker submits work
      await escrow.connect(worker).submitWork(1, "QmDeliverable");

      // Client verifies task as FAILED
      await escrow.connect(member1).verifyTask(1, false);

      // Worker claims insurance
      await expect(insurance.connect(worker).claimInsurance(1))
        .to.emit(insurance, "ClaimSubmitted");
    });
  });

  describe("Governance", function () {
    it("should return governance settings", async function () {
      const { insurance } = await loadFixture(deployFixture);
      expect(await insurance.VOTING_DURATION()).to.equal(86400);
      expect(await insurance.MIN_GOVERNANCE_MEMBERS()).to.equal(3);
      expect(await insurance.CLAIM_COVERAGE_PERCENT()).to.equal(50);
    });
  });

  describe("Withdraw", function () {
    it("should allow member to withdraw excess funds", async function () {
      const { insurance, member1 } = await loadFixture(deployFixture);
      await insurance.connect(member1).joinPool({ value: ethers.parseEther("1.0") });

      const memberBalanceBefore = await ethers.provider.getBalance(member1.address);
      const tx = await insurance.connect(member1).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const memberBalanceAfter = await ethers.provider.getBalance(member1.address);
      expect(memberBalanceAfter + gasUsed - memberBalanceBefore).to.be.closeTo(
        ethers.parseEther("0.99"),
        ethers.parseEther("0.001")
      );
    });

    it("should reject non-member withdraw", async function () {
      const { insurance, member1 } = await loadFixture(deployFixture);
      await expect(insurance.connect(member1).withdraw())
        .to.be.revertedWithCustomError(insurance, "NotMember");
    });

    it("should reject withdraw when pool below minimum reserve", async function () {
      const { insurance, member1, member2 } = await loadFixture(deployFixture);
      await insurance.connect(member1).joinPool({ value: ethers.parseEther("0.01") });
      await insurance.connect(member2).joinPool({ value: ethers.parseEther("0.01") });

      // Pool = 0.02, minimumReserve = 2 * 0.01 = 0.02
      // poolBalance > minimumReserve is false → reverts
      await expect(insurance.connect(member1).withdraw())
        .to.be.revertedWith("Pool balance below minimum reserve");
    });
  });

  describe("Get Member Info", function () {
    it("should return correct member info", async function () {
      const { insurance, member1 } = await loadFixture(deployFixture);
      await insurance.connect(member1).joinPool({ value: ethers.parseEther("0.02") });

      const info = await insurance.getMemberInfo(member1.address);
      expect(info.isMember).to.equal(true);
      expect(info.totalPremiumsPaid).to.equal(ethers.parseEther("0.02"));
      expect(info.totalClaimsReceived).to.equal(0);
    });

    it("should return zero info for non-member", async function () {
      const { insurance, member1 } = await loadFixture(deployFixture);
      const info = await insurance.getMemberInfo(member1.address);
      expect(info.isMember).to.equal(false);
    });
  });

  describe("Get Claim", function () {
    it("should reject getting non-existent claim", async function () {
      const { insurance, member1 } = await loadFixture(deployFixture);
      await expect(insurance.getClaim(999)).to.be.revertedWithCustomError(insurance, "NoClaim");
    });
  });
});
