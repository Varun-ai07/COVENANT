const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("COVENANT Integration — Full Agent Lifecycle", function () {
  const PAYMENT = ethers.parseEther("0.01");
  const PRIORITY_FEE = PAYMENT * 100n / 10000n;
  const TOTAL = PAYMENT + PRIORITY_FEE;
  const STAKE = ethers.parseEther("0.01");

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
    const escrow = await TaskEscrow.deploy(await registry.getAddress(), await verifier.getAddress());
    await escrow.waitForDeployment();

    const DisputeArbitration = await ethers.getContractFactory("contracts/DisputeArbitration.sol:DisputeArbitration");
    const arbitration = await DisputeArbitration.deploy(await registry.getAddress(), await escrow.getAddress());
    await arbitration.waitForDeployment();

    await registry.addAuthorizedContract(await escrow.getAddress());
    await registry.addAuthorizedContract(await arbitration.getAddress());
    await verifier.addAuthorizedIssuer(await escrow.getAddress());
    await verifier.addAuthorizedIssuer(owner.address);

    return { registry, verifier, escrow, arbitration, owner, client, worker, other, deadline };
  }

  async function registeredFixture() {
    const f = await deployFixture();
    await f.registry.connect(f.client).register("Client", ["mgmt"], { value: STAKE });
    await f.registry.connect(f.worker).register("Worker", ["code-review"], { value: STAKE });
    return f;
  }

  describe("Contract Deployment", function () {
    it("should deploy all contracts with correct links", async function () {
      const { registry, verifier, escrow } = await loadFixture(deployFixture);
      expect(await escrow.agentRegistry()).to.equal(await registry.getAddress());
      expect(await escrow.receiptVerifier()).to.equal(await verifier.getAddress());
    });

    it("should authorize escrow on registry", async function () {
      const { registry, escrow } = await loadFixture(deployFixture);
      expect(await registry.authorizedContracts(await escrow.getAddress())).to.be.true;
    });
  });

  describe("Agent Registration", function () {
    it("should register agent with correct initial state", async function () {
      const { registry, client } = await loadFixture(registeredFixture);
      const agent = await registry.getAgent(client.address);
      expect(agent.isActive).to.equal(1);
      expect(agent.reputation).to.equal(500);
      expect(agent.stakedAmount).to.equal(STAKE);
    });

    it("should reject duplicate registration", async function () {
      const { registry, client } = await loadFixture(registeredFixture);
      await expect(
        registry.connect(client).register("Dup", ["test"], { value: STAKE })
      ).to.be.reverted;
    });

    it("should reject registration with insufficient stake", async function () {
      const { registry, other } = await loadFixture(deployFixture);
      await expect(
        registry.connect(other).register("Low", ["test"], { value: 0 })
      ).to.be.reverted;
    });
  });

  describe("Full Lifecycle", function () {
    it("should complete full lifecycle: create -> submit -> verify", async function () {
      const { escrow, registry, client, worker, deadline } = await loadFixture(registeredFixture);

      const descHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTask"));
      const delivHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliverable"));

      // Create task
      await escrow.connect(client).createAndFundTask(worker.address, PAYMENT, deadline, descHash, { value: TOTAL });

      // Task ids start at 1
      let task = await escrow.getTask(1);
      expect(task.client).to.equal(client.address);
      expect(task.worker).to.equal(worker.address);
      expect(task.status).to.equal(2); // InProgress

      // Submit
      await escrow.connect(worker).submitWork(1, delivHash);
      task = await escrow.getTask(1);
      expect(task.status).to.equal(3); // Submitted

      // Verify (success)
      const workerBalBefore = await ethers.provider.getBalance(worker.address);
      await escrow.connect(client).verifyTask(1, true);
      task = await escrow.getTask(1);
      expect(task.status).to.equal(4); // Completed

      // Worker gets paid (minus 1% fee)
      const fee = PAYMENT * 100n / 10000n;
      const workerBalAfter = await ethers.provider.getBalance(worker.address);
      expect(workerBalAfter - workerBalBefore).to.equal(PAYMENT - fee);
    });

    it("should handle task failure (client rejects) with refund", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);

      await escrow.connect(client).createAndFundTask(worker.address, PAYMENT, deadline,
        ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTask2")), { value: TOTAL });
      await escrow.connect(worker).submitWork(1, ethers.keccak256(ethers.toUtf8Bytes("bad")));

      const clientBalBefore = await ethers.provider.getBalance(client.address);
      const tx = await escrow.connect(client).verifyTask(1, false);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(5); // Failed

      const clientBalAfter = await ethers.provider.getBalance(client.address);
      expect(clientBalAfter + gasCost).to.be.closeTo(clientBalBefore + PAYMENT, ethers.parseEther("0.0001"));
    });
  });

  describe("Deadline Expiry", function () {
    it("should fail task and refund after deadline", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);
      await escrow.connect(client).createAndFundTask(worker.address, PAYMENT, deadline,
        ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeadline")), { value: TOTAL });

      await time.increaseTo(deadline + 1);

      const clientBalBefore = await ethers.provider.getBalance(client.address);
      const tx = await escrow.checkDeadline(1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(5);

      const clientBalAfter = await ethers.provider.getBalance(client.address);
      expect(clientBalAfter + gasCost).to.be.closeTo(clientBalBefore + PAYMENT, ethers.parseEther("0.0001"));
    });
  });

  describe("Dispute Resolution", function () {
    it("should dispute and resolve in worker's favor", async function () {
      const { escrow, arbitration, registry, client, worker, owner, deadline } = await loadFixture(registeredFixture);
      await escrow.connect(client).createAndFundTask(worker.address, PAYMENT, deadline,
        ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDispute")), { value: TOTAL });
      await escrow.connect(worker).submitWork(1, ethers.keccak256(ethers.toUtf8Bytes("deliv")));

      const bond = ethers.parseEther("0.0002");
      await arbitration.connect(worker).disputeTask(1, { value: bond });
      await arbitration.connect(owner).resolveDispute(1, true);

      const dispute_ = await arbitration.getDispute(1);
      expect(dispute_.resolved).to.be.true;
      const agent = await registry.getAgent(worker.address);
      expect(agent.reputation).to.equal(510); // 500 + 10
    });

    it("should resolve dispute in client's favor with refund", async function () {
      const { escrow, arbitration, registry, client, worker, owner, deadline } = await loadFixture(registeredFixture);
      await escrow.connect(client).createAndFundTask(worker.address, PAYMENT, deadline,
        ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDispute2")), { value: TOTAL });
      await escrow.connect(worker).submitWork(1, ethers.keccak256(ethers.toUtf8Bytes("deliv")));

      const bond = ethers.parseEther("0.0002");
      await arbitration.connect(client).disputeTask(1, { value: bond });
      await arbitration.connect(owner).resolveDispute(1, false);

      const dispute_ = await arbitration.getDispute(1);
      expect(dispute_.resolved).to.be.true;
      const agent = await registry.getAgent(worker.address);
      expect(agent.stakedAmount).to.equal(ethers.parseEther("0.005")); // 50% slashed from 0.01
    });
  });

  describe("Multi-Task Scenario", function () {
    it("should handle multiple sequential tasks", async function () {
      const { escrow, registry, client, worker, deadline } = await loadFixture(registeredFixture);

      for (let i = 0; i < 3; i++) {
        await escrow.connect(client).createAndFundTask(worker.address, PAYMENT, deadline,
          ethers.keccak256(ethers.toUtf8Bytes(`task-${i}`)), { value: TOTAL });
      }

      expect(await escrow.taskCounter()).to.equal(3);
    });
  });
});
