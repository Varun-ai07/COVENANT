const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DisputeArbitration", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const WORKER_STAKE = ethers.parseEther("0.01");
  const PAYMENT = ethers.parseEther("0.01");
  const PRIORITY_FEE = PAYMENT * 100n / 10000n;
  const TOTAL = PAYMENT + PRIORITY_FEE;
  const DISPUTE_BOND = ethers.parseEther("0.0002");

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

    const DisputeArbitration = await ethers.getContractFactory("contracts/DisputeArbitration.sol:DisputeArbitration");
    const arbitration = await DisputeArbitration.deploy(
      await registry.getAddress(),
      await escrow.getAddress()
    );
    await arbitration.waitForDeployment();

    // Authorize escrow and arbitration on registry
    await registry.addAuthorizedContract(await escrow.getAddress());
    await registry.addAuthorizedContract(await arbitration.getAddress());
    await verifier.addAuthorizedIssuer(await escrow.getAddress());

    return { registry, verifier, escrow, arbitration, owner, client, worker, other, deadline };
  }

  async function registeredFixture() {
    const base = await deployFixture();
    const { registry, client, worker } = base;

    await registry.connect(client).register("Client", ["management"], { value: MIN_STAKE });
    await registry.connect(worker).register("Worker", ["code-review"], { value: WORKER_STAKE });

    return base;
  }

  async function taskFixture() {
    const base = await registeredFixture();
    const { escrow, client, worker, deadline } = base;

    await escrow.connect(client).createAndFundTask(
      worker.address, PAYMENT, deadline,
      ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTask")),
      { value: TOTAL }
    );

    return base;
  }

  async function submittedFixture() {
    const base = await taskFixture();
    const { escrow, worker } = base;

    await escrow.connect(worker).submitWork(
      1, ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliverable"))
    );

    return base;
  }

  describe("Deployment", function () {
    it("should deploy with correct contract references", async function () {
      const { arbitration, registry, escrow } = await loadFixture(deployFixture);
      expect(await arbitration.agentRegistry()).to.equal(await registry.getAddress());
      expect(await arbitration.taskEscrow()).to.equal(await escrow.getAddress());
    });

    it("should start with zero disputes", async function () {
      const { arbitration } = await loadFixture(deployFixture);
      expect(await arbitration.disputeCounter()).to.equal(0);
    });
  });

  describe("disputeTask", function () {
    it("should create a dispute with bond", async function () {
      const { arbitration, escrow, worker } = await loadFixture(submittedFixture);

      const tx = await arbitration.connect(worker).disputeTask(1, { value: DISPUTE_BOND });
      await expect(tx).to.emit(arbitration, "DisputeCreated");

      expect(await arbitration.disputeCounter()).to.equal(1);
      const task = await escrow.getTask(1);
      const dispute = await arbitration.getDispute(1);
      expect(dispute.taskId).to.equal(1);
      expect(dispute.client).to.equal(task.client);
      expect(dispute.worker).to.equal(task.worker);
      expect(dispute.initiator).to.equal(worker.address);
      expect(dispute.bond).to.equal(DISPUTE_BOND);
      expect(dispute.resolved).to.be.false;
    });

    it("should allow client to dispute", async function () {
      const { arbitration, client } = await loadFixture(submittedFixture);

      await expect(
        arbitration.connect(client).disputeTask(1, { value: DISPUTE_BOND })
      ).to.emit(arbitration, "DisputeCreated");
    });

    it("should reject dispute with insufficient bond", async function () {
      const { arbitration, worker } = await loadFixture(submittedFixture);

      await expect(
        arbitration.connect(worker).disputeTask(1, { value: DISPUTE_BOND - 1n })
      ).to.be.revertedWithCustomError(arbitration, "InsufficientBond");
    });

    it("should reject dispute from non-participant", async function () {
      const { arbitration, other } = await loadFixture(submittedFixture);

      await expect(
        arbitration.connect(other).disputeTask(1, { value: DISPUTE_BOND })
      ).to.be.revertedWith("Not participant");
    });

    it("should reject dispute on completed task", async function () {
      const { arbitration, escrow, client, worker } = await loadFixture(submittedFixture);
      await escrow.connect(client).verifyTask(1, true);

      await expect(
        arbitration.connect(worker).disputeTask(1, { value: DISPUTE_BOND })
      ).to.be.revertedWith("Task not in disputable state");
    });

    it("should reject dispute on non-existent task", async function () {
      const { arbitration, client } = await loadFixture(registeredFixture);

      await expect(
        arbitration.connect(client).disputeTask(999, { value: DISPUTE_BOND })
      ).to.be.reverted;
    });

    it("should accept bond larger than minimum", async function () {
      const { arbitration, worker } = await loadFixture(submittedFixture);
      const extraBond = ethers.parseEther("0.001");

      const tx = await arbitration.connect(worker).disputeTask(1, { value: extraBond });
      await expect(tx).to.emit(arbitration, "DisputeCreated");

      const dispute = await arbitration.getDispute(1);
      expect(dispute.bond).to.equal(extraBond);
    });
  });

  describe("resolveDispute — Worker Wins", function () {
    it("should resolve in worker's favor and return bond", async function () {
      const { arbitration, worker, owner } = await loadFixture(submittedFixture);
      await arbitration.connect(worker).disputeTask(1, { value: DISPUTE_BOND });

      const initiatorBalBefore = await ethers.provider.getBalance(worker.address);
      const tx = await arbitration.connect(owner).resolveDispute(1, true);
      await expect(tx).to.emit(arbitration, "DisputeResolved").withArgs(1, true);

      const initiatorBalAfter = await ethers.provider.getBalance(worker.address);
      // Bond returned
      expect(initiatorBalAfter - initiatorBalBefore).to.equal(DISPUTE_BOND);

      const dispute = await arbitration.getDispute(1);
      expect(dispute.resolved).to.be.true;
      expect(dispute.workerWins).to.be.true;
    });

    it("should update reputation positively on worker win", async function () {
      const { arbitration, registry, worker, owner } = await loadFixture(submittedFixture);
      await arbitration.connect(worker).disputeTask(1, { value: DISPUTE_BOND });
      await arbitration.connect(owner).resolveDispute(1, true);

      const agent = await registry.getAgent(worker.address);
      expect(agent.reputation).to.equal(510); // 500 + 10
    });
  });

  describe("resolveDispute — Worker Loses", function () {
    it("should resolve in client's favor and slash stake", async function () {
      const { arbitration, registry, worker, client, owner } = await loadFixture(submittedFixture);
      await arbitration.connect(worker).disputeTask(1, { value: DISPUTE_BOND });

      const agentBefore = await registry.getAgent(worker.address);
      expect(agentBefore.stakedAmount).to.equal(WORKER_STAKE);

      await arbitration.connect(owner).resolveDispute(1, false);

      const agentAfter = await registry.getAgent(worker.address);
      expect(agentAfter.stakedAmount).to.equal(WORKER_STAKE / 2n);
      expect(agentAfter.reputation).to.equal(480); // 500 - 20
    });

    it("should return bond to initiator on worker loss", async function () {
      const { arbitration, worker, client, owner } = await loadFixture(submittedFixture);
      await arbitration.connect(client).disputeTask(1, { value: DISPUTE_BOND });

      const initiatorBalBefore = await ethers.provider.getBalance(client.address);
      await arbitration.connect(owner).resolveDispute(1, false);
      const initiatorBalAfter = await ethers.provider.getBalance(client.address);

      expect(initiatorBalAfter - initiatorBalBefore).to.equal(DISPUTE_BOND);
    });

    it("should update reputation negatively on worker loss", async function () {
      const { arbitration, registry, worker, client, owner } = await loadFixture(submittedFixture);
      await arbitration.connect(client).disputeTask(1, { value: DISPUTE_BOND });
      await arbitration.connect(owner).resolveDispute(1, false);

      const agent = await registry.getAgent(worker.address);
      expect(agent.reputation).to.equal(480); // 500 - 20
    });
  });

  describe("Edge Cases", function () {
    it("should reject double resolution", async function () {
      const { arbitration, worker, owner } = await loadFixture(submittedFixture);
      await arbitration.connect(worker).disputeTask(1, { value: DISPUTE_BOND });
      await arbitration.connect(owner).resolveDispute(1, true);

      await expect(
        arbitration.connect(owner).resolveDispute(1, true)
      ).to.be.revertedWithCustomError(arbitration, "DisputeAlreadyResolved");
    });

    it("should reject resolveDispute for non-existent dispute", async function () {
      const { arbitration, owner } = await loadFixture(deployFixture);
      await expect(
        arbitration.connect(owner).resolveDispute(1, true)
      ).to.be.revertedWithCustomError(arbitration, "DisputeNotFound");
    });

    it("should reject resolveDispute from non-owner", async function () {
      const { arbitration, worker, client } = await loadFixture(submittedFixture);
      await arbitration.connect(worker).disputeTask(1, { value: DISPUTE_BOND });

      await expect(
        arbitration.connect(client).resolveDispute(1, true)
      ).to.be.revertedWithCustomError(arbitration, "OwnableUnauthorizedAccount");
    });

    it("should allow dispute from InProgress status", async function () {
      const { arbitration, client } = await loadFixture(taskFixture);
      // Task is InProgress (never submitted)
      await expect(
        arbitration.connect(client).disputeTask(1, { value: DISPUTE_BOND })
      ).to.emit(arbitration, "DisputeCreated");
    });

    it("should handle multiple disputes across different tasks", async function () {
      const { arbitration, escrow, client, worker, owner, deadline } = await loadFixture(registeredFixture);

      // Create & submit task 1
      await escrow.connect(client).createAndFundTask(
        worker.address, PAYMENT, deadline,
        ethers.keccak256(ethers.toUtf8Bytes("t1")),
        { value: TOTAL }
      );
      await escrow.connect(worker).submitWork(1, ethers.keccak256(ethers.toUtf8Bytes("d1")));

      // Create & submit task 2
      await escrow.connect(client).createAndFundTask(
        worker.address, PAYMENT, deadline,
        ethers.keccak256(ethers.toUtf8Bytes("t2")),
        { value: TOTAL }
      );
      await escrow.connect(worker).submitWork(2, ethers.keccak256(ethers.toUtf8Bytes("d2")));

      // Dispute both
      await arbitration.connect(worker).disputeTask(1, { value: DISPUTE_BOND });
      await arbitration.connect(client).disputeTask(2, { value: DISPUTE_BOND });

      expect(await arbitration.disputeCounter()).to.equal(2);

      // Resolve differently
      await arbitration.connect(owner).resolveDispute(1, true);
      await arbitration.connect(owner).resolveDispute(2, false);

      const d1 = await arbitration.getDispute(1);
      expect(d1.workerWins).to.be.true;
      const d2 = await arbitration.getDispute(2);
      expect(d2.workerWins).to.be.false;
    });
  });

  describe("Read Functions", function () {
    it("should return dispute details", async function () {
      const { arbitration, worker } = await loadFixture(submittedFixture);
      await arbitration.connect(worker).disputeTask(1, { value: DISPUTE_BOND });

      const dispute = await arbitration.getDispute(1);
      expect(dispute.taskId).to.equal(1);
      expect(dispute.worker).to.equal(worker.address);
      expect(dispute.initiator).to.equal(worker.address);
      expect(dispute.bond).to.equal(DISPUTE_BOND);
      expect(dispute.resolved).to.be.false;
    });

    it("should revert getDispute for non-existent dispute", async function () {
      const { arbitration } = await loadFixture(deployFixture);
      await expect(
        arbitration.getDispute(1)
      ).to.be.revertedWithCustomError(arbitration, "DisputeNotFound");
    });
  });
});
