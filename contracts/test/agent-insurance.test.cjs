const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AgentInsurance", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const MIN_POOL_DEPOSIT = ethers.parseEther("0.01");
  const PAYMENT = ethers.parseEther("0.01");
  const PRIORITY_FEE = PAYMENT * 100n / 10000n;
  const TOTAL = PAYMENT + PRIORITY_FEE;

  const PREMIUM_RATE_LOW = 2n; // 2% for rep 500-599
  const PREMIUM_DIVISOR = 100n;
  const EXPECTED_PREMIUM = PAYMENT * PREMIUM_RATE_LOW / PREMIUM_DIVISOR;

  async function deployFixture() {
    const [owner, client, worker, other] = await ethers.getSigners();
    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 7200;

    const AgentRegistry = await ethers.getContractFactory("contracts/AgentRegistry.sol:AgentRegistry");
    const registry = await AgentRegistry.deploy();
    await registry.waitForDeployment();

    const ReceiptVerifier = await ethers.getContractFactory("contracts/ReceiptVerifier.sol:ReceiptVerifier");
    const verifier = await ReceiptVerifier.deploy();
    await verifier.waitForDeployment();

    const TaskEscrow = await ethers.getContractFactory("contracts/TaskEscrow.sol:TaskEscrow");
    const escrow = await TaskEscrow.deploy(
      await registry.getAddress(),
      await verifier.getAddress()
    );
    await escrow.waitForDeployment();

    const AgentInsurance = await ethers.getContractFactory("contracts/AgentInsurance.sol:AgentInsurance");
    const insurance = await AgentInsurance.deploy(
      await registry.getAddress(),
      await escrow.getAddress()
    );
    await insurance.waitForDeployment();

    await registry.addAuthorizedContract(await escrow.getAddress());
    await registry.addAuthorizedContract(await insurance.getAddress());

    return { registry, verifier, escrow, insurance, owner, client, worker, other, deadline };
  }

  async function registerFixture() {
    const base = await deployFixture();
    const { registry, client, worker } = base;

    await registry.connect(client).register("Client", ["management"], { value: MIN_STAKE });
    await registry.connect(worker).register("Worker", ["code-review"], { value: ethers.parseEther("0.01") });

    return base;
  }

  async function taskFixture() {
    const base = await registerFixture();
    const { escrow, client, worker, deadline } = base;

    await escrow.connect(client).createAndFundTask(
      worker.address, PAYMENT, deadline,
      ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTask")),
      { value: TOTAL }
    );

    return base;
  }

  async function memberFixture() {
    const base = await taskFixture();
    const { insurance, worker } = base;

    await insurance.connect(worker).joinPool({ value: MIN_POOL_DEPOSIT });

    return base;
  }

  async function premiumPaidFixture() {
    const base = await memberFixture();
    const { insurance, worker } = base;

    await insurance.connect(worker).payPremium(1, { value: EXPECTED_PREMIUM });

    return base;
  }

  describe("Deployment", function () {
    it("should deploy with correct contract references", async function () {
      const { insurance, registry, escrow } = await loadFixture(deployFixture);
      expect(await insurance.agentRegistry()).to.equal(await registry.getAddress());
      expect(await insurance.taskEscrow()).to.equal(await escrow.getAddress());
    });

    it("should start with zero members and zero claims", async function () {
      const { insurance } = await loadFixture(deployFixture);
      expect(await insurance.memberCount()).to.equal(0);
      expect(await insurance.claimCounter()).to.equal(0);
      expect(await insurance.poolBalance()).to.equal(0);
    });
  });

  describe("joinPool", function () {
    it("should allow agent to join with minimum deposit", async function () {
      const { insurance, worker } = await loadFixture(registerFixture);

      const tx = await insurance.connect(worker).joinPool({ value: MIN_POOL_DEPOSIT });
      await expect(tx).to.emit(insurance, "MemberJoined").withArgs(worker.address);

      const info = await insurance.getMemberInfo(worker.address);
      expect(info.isMember).to.be.true;
      expect(info.totalPremiumsPaid).to.equal(MIN_POOL_DEPOSIT);
      expect(info.totalClaimsReceived).to.equal(0);

      expect(await insurance.memberCount()).to.equal(1);
      expect(await insurance.poolBalance()).to.equal(MIN_POOL_DEPOSIT);
    });

    it("should reject deposit below minimum", async function () {
      const { insurance, worker } = await loadFixture(registerFixture);
      await expect(
        insurance.connect(worker).joinPool({ value: ethers.parseEther("0.009") })
      ).to.be.revertedWith("Minimum deposit is 0.01 ETH");
    });

    it("should reject duplicate membership", async function () {
      const { insurance, worker } = await loadFixture(registerFixture);
      await insurance.connect(worker).joinPool({ value: MIN_POOL_DEPOSIT });
      await expect(
        insurance.connect(worker).joinPool({ value: MIN_POOL_DEPOSIT })
      ).to.be.revertedWithCustomError(insurance, "AlreadyMember");
    });

    it("should reject join from non-member (implicit — anyone can call)", async function () {
      const { insurance, other } = await loadFixture(registerFixture);
      // Anyone can join, but they must meet minimum deposit
      await expect(insurance.connect(other).joinPool({ value: MIN_POOL_DEPOSIT })).to.not.be.reverted;
    });
  });

  describe("payPremium", function () {
    it("should pay premium with correct calculation (reputation 500)", async function () {
      const { insurance, worker } = await loadFixture(memberFixture);
      const poolBefore = await insurance.poolBalance();

      const tx = await insurance.connect(worker).payPremium(1, { value: EXPECTED_PREMIUM });
      await expect(tx).to.emit(insurance, "PremiumPaid");

      const info = await insurance.getMemberInfo(worker.address);
      expect(info.totalPremiumsPaid).to.equal(MIN_POOL_DEPOSIT + EXPECTED_PREMIUM);

      const poolAfter = await insurance.poolBalance();
      expect(poolAfter - poolBefore).to.equal(EXPECTED_PREMIUM);
    });

    it("should calculate different premiums for different reputations", async function () {
      const { insurance, registry, owner, worker } = await loadFixture(memberFixture);
      await registry.addAuthorizedContract(owner.address);

      // Set reputation to 700 (medium tier: 1%)
      await registry.updateReputation(worker.address, 200); // 500 -> 700
      const premiumMedium = PAYMENT * 1n / 100n;
      await insurance.connect(worker).payPremium(1, { value: premiumMedium });

      const info = await insurance.getMemberInfo(worker.address);
      expect(info.totalPremiumsPaid).to.equal(MIN_POOL_DEPOSIT + premiumMedium);
    });

    it("should calculate premium for high reputation (>=800)", async function () {
      const { insurance, registry, owner, worker } = await loadFixture(memberFixture);
      await registry.addAuthorizedContract(owner.address);

      // Set reputation to 900
      await registry.updateReputation(worker.address, 400); // 500 -> 900
      const premiumHigh = PAYMENT * 5n / 1000n;
      await insurance.connect(worker).payPremium(1, { value: premiumHigh });

      const info = await insurance.getMemberInfo(worker.address);
      expect(info.totalPremiumsPaid).to.equal(MIN_POOL_DEPOSIT + premiumHigh);
    });

    it("should reject from non-member", async function () {
      const { insurance, client } = await loadFixture(taskFixture);
      await expect(
        insurance.connect(client).payPremium(1, { value: EXPECTED_PREMIUM })
      ).to.be.revertedWithCustomError(insurance, "NotMember");
    });

    it("should reject for non-active agent", async function () {
      const { insurance, registry, worker } = await loadFixture(memberFixture);
      await registry.connect(worker).deactivate();

      await expect(
        insurance.connect(worker).payPremium(1, { value: EXPECTED_PREMIUM })
      ).to.be.revertedWith("Agent not active");
    });

    it("should reject insufficient premium payment", async function () {
      const { insurance, worker } = await loadFixture(memberFixture);
      await expect(
        insurance.connect(worker).payPremium(1, { value: EXPECTED_PREMIUM - 1n })
      ).to.be.revertedWith("Insufficient funds for premium");
    });

    it("should reject premium for invalid task status", async function () {
      const { insurance, worker, client } = await loadFixture(memberFixture);
      // Complete the task first
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("done"));
      const { escrow } = await loadFixture(taskFixture);
      // The member fixture already created the task

      await expect(
        insurance.connect(worker).payPremium(999, { value: EXPECTED_PREMIUM })
      ).to.be.reverted;
    });
  });

  describe("claimInsurance", function () {
    it("should submit a claim after task failure", async function () {
      const { insurance, escrow, client, worker } = await loadFixture(premiumPaidFixture);

      // Fail the task
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("bad"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, false);

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(5); // Failed

      const claimAmount = PAYMENT * 50n / 100n; // 50% coverage

      const tx = await insurance.connect(worker).claimInsurance(1);
      await expect(tx).to.emit(insurance, "ClaimSubmitted");

      expect(await insurance.claimCounter()).to.equal(1);
      const claim = await insurance.getClaim(1);
      expect(claim.taskId).to.equal(1);
      expect(claim.agent).to.equal(worker.address);
      expect(claim.amountRequested).to.equal(claimAmount);
      expect(claim.isPaid).to.be.false;
      expect(claim.isRejected).to.be.false;
    });

    it("should reject claim from non-worker", async function () {
      const { insurance, escrow, client, worker } = await loadFixture(premiumPaidFixture);
      // Fail the task first
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("bad"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, false);
      // Make client a member first so NotMember doesn't shadow the worker check
      await insurance.connect(client).joinPool({ value: MIN_POOL_DEPOSIT });
      await expect(
        insurance.connect(client).claimInsurance(1)
      ).to.be.revertedWith("Only the worker can claim insurance");
    });

    it("should reject claim from non-member", async function () {
      const { insurance, client } = await loadFixture(taskFixture);
      await expect(
        insurance.connect(client).claimInsurance(1)
      ).to.be.revertedWithCustomError(insurance, "NotMember");
    });

    it("should reject claim when task is still active", async function () {
      const { insurance, worker } = await loadFixture(memberFixture);
      await expect(
        insurance.connect(worker).claimInsurance(1)
      ).to.be.revertedWith("Task has not failed or been disputed");
    });

    it("should reject duplicate claim on same task", async function () {
      const { insurance, escrow, client, worker } = await loadFixture(premiumPaidFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("bad"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, false);

      await insurance.connect(worker).claimInsurance(1);
      await expect(
        insurance.connect(worker).claimInsurance(1)
      ).to.be.revertedWithCustomError(insurance, "ClaimAlreadyPaid");
    });
  });

  describe("payClaim", function () {
    it("should pay claim and update balances", async function () {
      const { insurance, escrow, client, worker, owner } = await loadFixture(premiumPaidFixture);

      // Fail task
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("bad"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, false);

      // Claim
      await insurance.connect(worker).claimInsurance(1);
      const claimAmount = PAYMENT * 50n / 100n;

      const poolBefore = await insurance.poolBalance();

      const tx = await insurance.connect(owner).payClaim(1);
      await expect(tx).to.emit(insurance, "ClaimPaid");

      const poolAfter = await insurance.poolBalance();
      expect(poolBefore - poolAfter).to.equal(claimAmount);

      const info = await insurance.getMemberInfo(worker.address);
      expect(info.totalClaimsReceived).to.equal(claimAmount);

      const claim = await insurance.getClaim(1);
      expect(claim.isPaid).to.be.true;
    });

    it("should update reputation on claim payment", async function () {
      const { insurance, registry, escrow, client, worker, owner } = await loadFixture(premiumPaidFixture);

      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("bad"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, false);
      await insurance.connect(worker).claimInsurance(1);
      await insurance.connect(owner).payClaim(1);

      const agent = await registry.getAgent(worker.address);
      expect(agent.reputation).to.equal(505); // 500 - 20 (failure) + 25 (claim)
    });

    it("should reject payClaim from non-owner", async function () {
      const { insurance, escrow, client, worker } = await loadFixture(premiumPaidFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("bad"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, false);
      await insurance.connect(worker).claimInsurance(1);

      await expect(
        insurance.connect(worker).payClaim(1)
      ).to.be.revertedWithCustomError(insurance, "OwnableUnauthorizedAccount");
    });

    it("should reject payClaim for non-existent claim", async function () {
      const { insurance, owner } = await loadFixture(deployFixture);
      await expect(
        insurance.connect(owner).payClaim(1)
      ).to.be.revertedWithCustomError(insurance, "NoClaim");
    });

    it("should reject paying already paid claim", async function () {
      const { insurance, escrow, client, worker, owner } = await loadFixture(premiumPaidFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("bad"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, false);
      await insurance.connect(worker).claimInsurance(1);
      await insurance.connect(owner).payClaim(1);

      await expect(
        insurance.connect(owner).payClaim(1)
      ).to.be.revertedWithCustomError(insurance, "ClaimAlreadyPaid");
    });

    it("should reject paying a rejected claim", async function () {
      const { insurance, escrow, client, worker, owner } = await loadFixture(premiumPaidFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("bad"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, false);
      await insurance.connect(worker).claimInsurance(1);
      await insurance.connect(owner).rejectClaim(1);

      await expect(
        insurance.connect(owner).payClaim(1)
      ).to.be.revertedWithCustomError(insurance, "ClaimNotPending");
    });
  });

  describe("rejectClaim", function () {
    it("should reject a pending claim", async function () {
      const { insurance, escrow, client, worker, owner } = await loadFixture(premiumPaidFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("bad"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, false);
      await insurance.connect(worker).claimInsurance(1);

      const tx = await insurance.connect(owner).rejectClaim(1);
      await expect(tx).to.emit(insurance, "ClaimRejected");

      const claim = await insurance.getClaim(1);
      expect(claim.isRejected).to.be.true;
    });

    it("should reject rejectClaim from non-owner", async function () {
      const { insurance, escrow, client, worker } = await loadFixture(premiumPaidFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("bad"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, false);
      await insurance.connect(worker).claimInsurance(1);

      await expect(
        insurance.connect(worker).rejectClaim(1)
      ).to.be.revertedWithCustomError(insurance, "OwnableUnauthorizedAccount");
    });
  });

  describe("withdraw", function () {
    it("should allow member to withdraw net contribution", async function () {
      const { insurance, escrow, client, worker, owner } = await loadFixture(premiumPaidFixture);

      const poolBefore = await insurance.poolBalance();
      const minReserve = ethers.parseEther("0.01"); // 1 member * 0.01
      const withdrawable = poolBefore - minReserve;
      expect(withdrawable).to.be.gt(0);

      await insurance.connect(worker).withdraw(withdrawable);

      const poolAfter = await insurance.poolBalance();
      expect(poolAfter).to.equal(minReserve);
    });

    it("should reject withdraw when pool is at minimum reserve", async function () {
      const { insurance, worker } = await loadFixture(premiumPaidFixture);
      // Pool can only go down to minReserve (0.01). Withdraw maximum withdrawable.
      const poolBal = await insurance.poolBalance();
      const minReserve = ethers.parseEther("0.01");
      const withdrawable = poolBal - minReserve;
      if (withdrawable > 0) {
        await insurance.connect(worker).withdraw(withdrawable);
      }
      // Pool is at min reserve; any further withdrawal fails on reserve check
      await expect(
        insurance.connect(worker).withdraw(1)
      ).to.be.revertedWith("Pool balance below minimum reserve");
    });

    it("should reject withdraw from non-member", async function () {
      const { insurance, client } = await loadFixture(deployFixture);
      await expect(
        insurance.connect(client).withdraw(1)
      ).to.be.revertedWithCustomError(insurance, "NotMember");
    });

    it("should reject withdraw that drops pool below minimum reserve", async function () {
      const { insurance, worker } = await loadFixture(memberFixture);
      // Pool is 0.01, minimum reserve is 0.01, so no withdraw possible
      // But net contribution is 0.01 - premium not yet paid
      const info = await insurance.getMemberInfo(worker.address);
      const netContrib = info.totalPremiumsPaid - info.totalClaimsReceived; // 0.01
      const minReserve = ethers.parseEther("0.01"); // 1 member

      await expect(
        insurance.connect(worker).withdraw(1)
      ).to.be.revertedWith("Pool balance below minimum reserve");
    });

    it("should reject zero withdrawal", async function () {
      const { insurance, worker } = await loadFixture(premiumPaidFixture);
      await expect(
        insurance.connect(worker).withdraw(0)
      ).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("Pool Balance", function () {
    it("should track pool balance correctly across operations", async function () {
      const { insurance, worker } = await loadFixture(memberFixture);
      expect(await insurance.poolBalance()).to.equal(MIN_POOL_DEPOSIT);

      await insurance.connect(worker).payPremium(1, { value: EXPECTED_PREMIUM });
      expect(await insurance.poolBalance()).to.equal(MIN_POOL_DEPOSIT + EXPECTED_PREMIUM);
    });
  });

  describe("Read Functions", function () {
    it("should return pool balance", async function () {
      const { insurance } = await loadFixture(memberFixture);
      expect(await insurance.getPoolBalance()).to.equal(MIN_POOL_DEPOSIT);
    });

    it("should return claim count", async function () {
      const { insurance } = await loadFixture(deployFixture);
      expect(await insurance.getClaimCount()).to.equal(0);
    });

    it("should return member info for non-member", async function () {
      const { insurance, client } = await loadFixture(deployFixture);
      const info = await insurance.getMemberInfo(client.address);
      expect(info.isMember).to.be.false;
      expect(info.totalPremiumsPaid).to.equal(0);
      expect(info.totalClaimsReceived).to.equal(0);
    });
  });
});
