import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TaskEscrow", function () {
  let registry, escrow, receiptVerifier;
  let owner, client, worker, other;
  const MIN_STAKE = ethers.parseEther("0.001");
  const TASK_PAYMENT = ethers.parseEther("0.1");

  beforeEach(async function () {
    [owner, client, worker, other] = await ethers.getSigners();

    // Deploy AgentRegistry
    const Registry = await ethers.getContractFactory("AgentRegistry");
    registry = await Registry.deploy();

    // Deploy ReceiptVerifier
    const Verifier = await ethers.getContractFactory("ReceiptVerifier");
    receiptVerifier = await Verifier.deploy();

    // Deploy TaskEscrow
    const Escrow = await ethers.getContractFactory("TaskEscrow");
    escrow = await Escrow.deploy(
      await registry.getAddress(),
      await receiptVerifier.getAddress()
    );

    // Authorize escrow to update reputation and create receipts
    await registry.addAuthorizedContract(await escrow.getAddress());
    await receiptVerifier.addAuthorizedIssuer(await escrow.getAddress());

    // Register agents
    await registry.connect(client).register("ClientAgent", ["hiring"], {
      value: MIN_STAKE,
    });
    await registry.connect(worker).register("WorkerAgent", ["data-analysis"], {
      value: MIN_STAKE,
    });
  });

  describe("Task Creation", function () {
    it("should create a task", async function () {
      const deadline = (await time.latest()) + 86400;

      await escrow
        .connect(client)
        .createTask(worker.address, TASK_PAYMENT, deadline, "QmTestHash123");

      const task = await escrow.getTask(1);
      expect(task.client).to.equal(client.address);
      expect(task.worker).to.equal(worker.address);
      expect(task.payment).to.equal(TASK_PAYMENT);
      expect(task.status).to.equal(0); // Created
    });

    it("should reject task with past deadline", async function () {
      const pastDeadline = (await time.latest()) - 100;

      await expect(
        escrow
          .connect(client)
          .createTask(worker.address, TASK_PAYMENT, pastDeadline, "QmTestHash123")
      ).to.be.revertedWith("!deadline");
    });

    it("should reject task from unregistered client", async function () {
      const deadline = (await time.latest()) + 86400;

      await expect(
        escrow
          .connect(other)
          .createTask(worker.address, TASK_PAYMENT, deadline, "QmTestHash123")
      ).to.be.revertedWith("!client reg");
    });
  });

  describe("Task Lifecycle", function () {
    let taskId;
    const deadline = 86400;

    beforeEach(async function () {
      const currentDeadline = (await time.latest()) + deadline;
      await escrow
        .connect(client)
        .createTask(worker.address, TASK_PAYMENT, currentDeadline, "QmTestHash123");
      taskId = 1;
    });

    it("should fund and auto-start a task", async function () {
      await escrow.connect(client).fundTask(taskId, { value: TASK_PAYMENT });

      const task = await escrow.getTask(taskId);
      expect(task.status).to.equal(2); // InProgress
    });

    it("should allow worker to submit work", async function () {
      await escrow.connect(client).fundTask(taskId, { value: TASK_PAYMENT });
      await escrow.connect(worker).submitWork(taskId, "QmDeliverable123");

      const task = await escrow.getTask(taskId);
      expect(task.status).to.equal(3); // Submitted
      expect(task.deliverableHash).to.equal("QmDeliverable123");
    });

    it("should complete task on successful verification", async function () {
      await escrow.connect(client).fundTask(taskId, { value: TASK_PAYMENT });
      await escrow.connect(worker).submitWork(taskId, "QmDeliverable123");

      await escrow.connect(client).verifyTask(taskId, true);

      const task = await escrow.getTask(taskId);
      expect(task.status).to.equal(4); // Completed

      const workerAgent = await registry.getAgent(worker.address);
      expect(workerAgent.reputation).to.equal(510);
      expect(workerAgent.tasksCompleted).to.equal(1);
    });

    it("should fail task on failed verification", async function () {
      await escrow.connect(client).fundTask(taskId, { value: TASK_PAYMENT });
      await escrow.connect(worker).submitWork(taskId, "QmBadDeliverable");

      await escrow.connect(client).verifyTask(taskId, false);

      const task = await escrow.getTask(taskId);
      expect(task.status).to.equal(5); // Failed

      const workerAgent = await registry.getAgent(worker.address);
      expect(workerAgent.reputation).to.equal(450);
      expect(workerAgent.tasksFailed).to.equal(1);
    });

    it("should reject submission after deadline", async function () {
      await escrow.connect(client).fundTask(taskId, { value: TASK_PAYMENT });
      await time.increase(deadline + 100);

      await expect(
        escrow.connect(worker).submitWork(taskId, "QmDeliverable123")
      ).to.be.revertedWith("Deadline passed");
    });
  });

  describe("Disputes", function () {
    let taskId;

    beforeEach(async function () {
      const currentDeadline = (await time.latest()) + 86400;
      await escrow
        .connect(client)
        .createTask(worker.address, TASK_PAYMENT, currentDeadline, "QmTestHash123");
      taskId = 1;
      await escrow.connect(client).fundTask(taskId, { value: TASK_PAYMENT });
      await escrow.connect(worker).submitWork(taskId, "QmDeliverable123");
    });

    it("should allow dispute and resolution", async function () {
      await escrow.connect(client).disputeTask(taskId);
      const task = await escrow.getTask(taskId);
      expect(task.status).to.equal(6); // Disputed

      await escrow.resolveDispute(taskId, true);
      const resolvedTask = await escrow.getTask(taskId);
      expect(resolvedTask.status).to.equal(4); // Completed
    });
  });

  describe("Protocol Fees", function () {
    it("should accumulate fees", async function () {
      const currentDeadline = (await time.latest()) + 86400;
      await escrow
        .connect(client)
        .createTask(worker.address, TASK_PAYMENT, currentDeadline, "QmTestHash123");
      await escrow.connect(client).fundTask(1, { value: TASK_PAYMENT });
      await escrow.connect(worker).submitWork(1, "QmDeliverable");
      await escrow.connect(client).verifyTask(1, true);

      const accumulatedFees = await escrow.accumulatedFees();
      const expectedFee = (TASK_PAYMENT * 100n) / 10000n;
      expect(accumulatedFees).to.equal(expectedFee);
    });
  });
});
