const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CovenantEscrow V4", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const TASK_AMOUNT = ethers.parseEther("0.1");
  const METADATA_ROOT = ethers.keccak256(ethers.toUtf8Bytes("metadata"));

  async function getDeadline(daysAhead = 1) {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp + (daysAhead * 86400);
  }

  async function deployEscrowFixture() {
    const [owner, oracle, client, worker, other] = await ethers.getSigners();

    const Identity = await ethers.getContractFactory("contracts/v4/CovenantIdentity.sol:CovenantIdentity");
    const identity = await Identity.deploy();
    await identity.initialize(MIN_STAKE, oracle.address);

    const Escrow = await ethers.getContractFactory("contracts/v4/CovenantEscrow.sol:CovenantEscrow");
    const escrow = await Escrow.deploy();
    await escrow.initialize(identity.target);

    await identity.connect(client).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });
    await identity.connect(worker).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });

    return { escrow, identity, owner, oracle, client, worker, other };
  }

  describe("Task Creation", function () {
    it("should create a task with specific worker", async function () {
      const { escrow, client, worker } = await loadFixture(deployEscrowFixture);
      const deadline = await getDeadline(1);

      const metaHash = ethers.keccak256(ethers.toUtf8Bytes("task description"));
      const tx = await escrow.connect(client).createTask(
        worker.address,
        TASK_AMOUNT,
        deadline,
        metaHash,
        { value: TASK_AMOUNT }
      );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      const task = await escrow.getTask(1);
      expect(task.client).to.equal(client.address);
      expect(task.worker).to.equal(worker.address);
      expect(task.amount).to.equal(TASK_AMOUNT);
      expect(task.status).to.equal(2);
    });

    it("should create an open task", async function () {
      const { escrow, client } = await loadFixture(deployEscrowFixture);
      const deadline = await getDeadline(1);
      const metaHash = ethers.keccak256(ethers.toUtf8Bytes("open task"));

      await escrow.connect(client).createTask(
        ethers.ZeroAddress,
        TASK_AMOUNT,
        deadline,
        metaHash,
        { value: TASK_AMOUNT }
      );

      const task = await escrow.getTask(1);
      expect(task.worker).to.equal(ethers.ZeroAddress);
      expect(task.status).to.equal(1);
    });

    it("should reject deadline too soon", async function () {
      const { escrow, client, worker } = await loadFixture(deployEscrowFixture);
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 60;

      await expect(
        escrow.connect(client).createTask(
          worker.address,
          TASK_AMOUNT,
          deadline,
          ethers.ZeroHash,
          { value: TASK_AMOUNT }
        )
      ).to.be.revertedWith("deadline too soon");
    });
  });

  describe("Work Submission", function () {
    it("should allow worker to submit work", async function () {
      const { escrow, client, worker } = await loadFixture(deployEscrowFixture);
      const deadline = await getDeadline(1);
      const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("deliverable"));

      await escrow.connect(client).createTask(
        worker.address,
        TASK_AMOUNT,
        deadline,
        ethers.keccak256(ethers.toUtf8Bytes("task")),
        { value: TASK_AMOUNT }
      );

      await escrow.connect(worker).submitWork(1, deliverableHash);

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(3);
      expect(task.metaHash).to.equal(deliverableHash);
    });

    it("should reject submission from non-worker", async function () {
      const { escrow, client, worker, other } = await loadFixture(deployEscrowFixture);
      const deadline = await getDeadline(1);

      await escrow.connect(client).createTask(
        worker.address,
        TASK_AMOUNT,
        deadline,
        ethers.keccak256(ethers.toUtf8Bytes("task")),
        { value: TASK_AMOUNT }
      );

      await expect(
        escrow.connect(other).submitWork(1, ethers.ZeroHash)
      ).to.be.revertedWith("not worker");
    });
  });

  describe("Task Completion", function () {
    it("should complete task and release funds to worker", async function () {
      const { escrow, client, worker } = await loadFixture(deployEscrowFixture);
      const deadline = await getDeadline(1);

      await escrow.connect(client).createTask(
        worker.address,
        TASK_AMOUNT,
        deadline,
        ethers.keccak256(ethers.toUtf8Bytes("task")),
        { value: TASK_AMOUNT }
      );

      await escrow.connect(worker).submitWork(1, ethers.keccak256(ethers.toUtf8Bytes("deliverable")));

      const balanceBefore = await ethers.provider.getBalance(worker.address);

      const message = ethers.keccak256(ethers.solidityPacked(["uint256", "uint256"], [1, 31337]));
      const signature = await client.signMessage(ethers.getBytes(message));

      const tx = await escrow.connect(worker).completeTask(1, signature);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(worker.address);
      expect(balanceAfter - balanceBefore + gasCost).to.equal(TASK_AMOUNT);
    });
  });

  describe("Batch Settlement", function () {
    it("should batch settle multiple tasks", async function () {
      const { escrow, client, worker, owner } = await loadFixture(deployEscrowFixture);
      const deadline = await getDeadline(1);

      for (let i = 0; i < 3; i++) {
        await escrow.connect(client).createTask(
          worker.address,
          TASK_AMOUNT,
          deadline,
          ethers.keccak256(ethers.toUtf8Bytes(`task ${i}`)),
          { value: TASK_AMOUNT }
        );
        await escrow.connect(worker).submitWork(i + 1, ethers.keccak256(ethers.toUtf8Bytes(`deliverable ${i}`)));
      }

      const taskIds = [1, 2, 3];
      const amounts = [TASK_AMOUNT, TASK_AMOUNT, TASK_AMOUNT];
      const signatures = [];

      for (const id of taskIds) {
        const message = ethers.keccak256(ethers.solidityPacked(["uint256", "uint256"], [id, 31337]));
        const sig = await client.signMessage(ethers.getBytes(message));
        signatures.push(sig);
      }

      const tx = await escrow.connect(owner).batchSettle(taskIds, amounts, signatures);
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      for (const id of taskIds) {
        const task = await escrow.getTask(id);
        expect(task.status).to.equal(5);
      }
    });
  });

  describe("Disputes", function () {
    it("should allow party to dispute task", async function () {
      const { escrow, client, worker } = await loadFixture(deployEscrowFixture);
      const deadline = await getDeadline(1);

      await escrow.connect(client).createTask(
        worker.address,
        TASK_AMOUNT,
        deadline,
        ethers.keccak256(ethers.toUtf8Bytes("task")),
        { value: TASK_AMOUNT }
      );

      await escrow.connect(worker).submitWork(1, ethers.ZeroHash);
      await escrow.connect(client).disputeTask(1);

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(4);
      expect(task.disputeCount).to.equal(1);
    });
  });
});
