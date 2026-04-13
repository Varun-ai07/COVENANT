import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TaskEscrow Enhancements", function () {
  let registry, escrow, receiptVerifier;
  let owner, client, worker, other;
  const MIN_STAKE = ethers.parseEther("0.001");
  const TASK_PAYMENT = ethers.parseEther("0.1");

  beforeEach(async function () {
    [owner, client, worker, other] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("AgentRegistry");
    registry = await Registry.deploy();

    const Verifier = await ethers.getContractFactory("ReceiptVerifier");
    receiptVerifier = await Verifier.deploy();

    const Escrow = await ethers.getContractFactory("TaskEscrow");
    escrow = await Escrow.deploy(
      await registry.getAddress(),
      await receiptVerifier.getAddress()
    );

    await registry.addAuthorizedContract(await escrow.getAddress());
    await receiptVerifier.addAuthorizedIssuer(await escrow.getAddress());

    await registry.connect(client).register("ClientAgent", ["hiring"], {
      value: MIN_STAKE,
    });
    await registry.connect(worker).register("WorkerAgent", ["data-analysis"], {
      value: MIN_STAKE,
    });
  });

  // ============================================================
  // PRIORITY SYSTEM
  // ============================================================

  describe("Priority System", function () {
    it("should return correct BPS for Low priority", async function () {
      expect(await escrow.getPriorityFeeBps(0)).to.equal(50);
    });

    it("should return correct BPS for Medium priority", async function () {
      expect(await escrow.getPriorityFeeBps(1)).to.equal(100);
    });

    it("should return correct BPS for High priority", async function () {
      expect(await escrow.getPriorityFeeBps(2)).to.equal(200);
    });

    it("should return correct BPS for Urgent priority", async function () {
      expect(await escrow.getPriorityFeeBps(3)).to.equal(500);
    });

    it("should createAndFundTask use Medium priority by default", async function () {
      const deadline = (await time.latest()) + 86400;
      const fee = (TASK_PAYMENT * 100n) / 10000n;
      const required = TASK_PAYMENT + fee;

      await escrow.connect(client).createAndFundTask(
        worker.address, TASK_PAYMENT, deadline, "QmDesc",
        { value: required }
      );

      const priority = await escrow.getTaskPriority(1);
      expect(priority).to.equal(1); // Medium
    });

    it("should create task with Low priority and charge 0.5% fee", async function () {
      const deadline = (await time.latest()) + 86400;
      const fee = (TASK_PAYMENT * 50n) / 10000n;
      const required = TASK_PAYMENT + fee;

      await escrow.connect(client).createAndFundTaskWithPriority(
        worker.address, TASK_PAYMENT, deadline, "QmDesc", 0, // Low
        { value: required }
      );

      const priority = await escrow.getTaskPriority(1);
      expect(priority).to.equal(0); // Low

      const accumulatedFees = await escrow.accumulatedFees();
      expect(accumulatedFees).to.equal(fee);
    });

    it("should create task with High priority and charge 2% fee", async function () {
      const deadline = (await time.latest()) + 86400;
      const fee = (TASK_PAYMENT * 200n) / 10000n;
      const required = TASK_PAYMENT + fee;

      await escrow.connect(client).createAndFundTaskWithPriority(
        worker.address, TASK_PAYMENT, deadline, "QmDesc", 2, // High
        { value: required }
      );

      const priority = await escrow.getTaskPriority(1);
      expect(priority).to.equal(2); // High

      const accumulatedFees = await escrow.accumulatedFees();
      expect(accumulatedFees).to.equal(fee);
    });

    it("should create task with Urgent priority and charge 5% fee", async function () {
      const deadline = (await time.latest()) + 86400;
      const fee = (TASK_PAYMENT * 500n) / 10000n;
      const required = TASK_PAYMENT + fee;

      await escrow.connect(client).createAndFundTaskWithPriority(
        worker.address, TASK_PAYMENT, deadline, "QmDesc", 3, // Urgent
        { value: required }
      );

      const priority = await escrow.getTaskPriority(1);
      expect(priority).to.equal(3); // Urgent

      const accumulatedFees = await escrow.accumulatedFees();
      expect(accumulatedFees).to.equal(fee);
    });

    it("should revert if insufficient funding for priority fee", async function () {
      const deadline = (await time.latest()) + 86400;

      await expect(
        escrow.connect(client).createAndFundTaskWithPriority(
          worker.address, TASK_PAYMENT, deadline, "QmDesc", 3, // Urgent
          { value: TASK_PAYMENT } // Only payment, no fee
        )
      ).to.be.revertedWith("Insufficient funding");
    });
  });

  // ============================================================
  // MILESTONE SYSTEM
  // ============================================================

  describe("Milestone System", function () {
    let milestoneDescs, milestonePayments, totalPayment;

    beforeEach(async function () {
      milestoneDescs = ["QmMs1", "QmMs2", "QmMs3"];
      milestonePayments = [
        ethers.parseEther("0.03"),
        ethers.parseEther("0.03"),
        ethers.parseEther("0.04"),
      ];
      totalPayment = ethers.parseEther("0.1");
    });

    it("should create a milestone task", async function () {
      const deadline = (await time.latest()) + 86400;

      await escrow.connect(client).createTaskWithMilestones(
        worker.address, totalPayment, deadline, "QmDesc",
        milestoneDescs, milestonePayments,
        { value: totalPayment }
      );

      expect(await escrow.getMilestoneCount(1)).to.equal(3);
      expect(await escrow.isMilestoneTask(1)).to.equal(true);

      const ms0 = await escrow.getMilestone(1, 0);
      expect(ms0.descriptionHash).to.equal("QmMs1");
      expect(ms0.paymentAmount).to.equal(ethers.parseEther("0.03"));
      expect(ms0.completed).to.equal(false);
      expect(ms0.paid).to.equal(false);
    });

    it("should revert if milestone payments do not sum to total", async function () {
      const deadline = (await time.latest()) + 86400;
      const badPayments = [ethers.parseEther("0.03"), ethers.parseEther("0.03")]; // 6 < 10

      await expect(
        escrow.connect(client).createTaskWithMilestones(
          worker.address, totalPayment, deadline, "QmDesc",
          ["QmMs1", "QmMs2"],
          badPayments,
          { value: totalPayment }
        )
      ).to.be.revertedWith("Milestone payments must sum to total");
    });

    it("should revert if milestone lengths mismatch", async function () {
      const deadline = (await time.latest()) + 86400;

      await expect(
        escrow.connect(client).createTaskWithMilestones(
          worker.address, totalPayment, deadline, "QmDesc",
          ["QmMs1"],
          [ethers.parseEther("0.05"), ethers.parseEther("0.05")],
          { value: totalPayment }
        )
      ).to.be.revertedWith("Milestone length mismatch");
    });

    it("should worker submit milestones in order", async function () {
      const deadline = (await time.latest()) + 86400;

      await escrow.connect(client).createTaskWithMilestones(
        worker.address, totalPayment, deadline, "QmDesc",
        milestoneDescs, milestonePayments,
        { value: totalPayment }
      );

      // Submit milestone 0
      await escrow.connect(worker).submitMilestone(1, 0, "QmDeliverable0");
      let ms0 = await escrow.getMilestone(1, 0);
      expect(ms0.completed).to.equal(true);
      expect(ms0.deliverableHash).to.equal("QmDeliverable0");

      // Submit milestone 1
      await escrow.connect(worker).submitMilestone(1, 1, "QmDeliverable1");
      let ms1 = await escrow.getMilestone(1, 1);
      expect(ms1.completed).to.equal(true);

      // Submit milestone 2
      await escrow.connect(worker).submitMilestone(1, 2, "QmDeliverable2");
      let ms2 = await escrow.getMilestone(1, 2);
      expect(ms2.completed).to.equal(true);
    });

    it("should revert if submitting out of order", async function () {
      const deadline = (await time.latest()) + 86400;

      await escrow.connect(client).createTaskWithMilestones(
        worker.address, totalPayment, deadline, "QmDesc",
        milestoneDescs, milestonePayments,
        { value: totalPayment }
      );

      // Skip milestone 0 — try 1 first
      await expect(
        escrow.connect(worker).submitMilestone(1, 1, "QmDeliverable1")
      ).to.be.revertedWith("Previous milestone not completed");
    });

    it("should revert if submitting a completed milestone", async function () {
      const deadline = (await time.latest()) + 86400;

      await escrow.connect(client).createTaskWithMilestones(
        worker.address, totalPayment, deadline, "QmDesc",
        milestoneDescs, milestonePayments,
        { value: totalPayment }
      );

      await escrow.connect(worker).submitMilestone(1, 0, "QmDeliverable0");
      await expect(
        escrow.connect(worker).submitMilestone(1, 0, "QmDeliverable0_again")
      ).to.be.revertedWith("Milestone already completed");
    });

    it("should revert if non-worker submits milestone", async function () {
      const deadline = (await time.latest()) + 86400;

      await escrow.connect(client).createTaskWithMilestones(
        worker.address, totalPayment, deadline, "QmDesc",
        milestoneDescs, milestonePayments,
        { value: totalPayment }
      );

      await expect(
        escrow.connect(other).submitMilestone(1, 0, "QmFake")
      ).to.be.revertedWith("Not task worker");
    });

    it("should client verify milestone and pay worker", async function () {
      const deadline = (await time.latest()) + 86400;

      await escrow.connect(client).createTaskWithMilestones(
        worker.address, totalPayment, deadline, "QmDesc",
        milestoneDescs, milestonePayments,
        { value: totalPayment }
      );

      await escrow.connect(worker).submitMilestone(1, 0, "QmDeliverable0");

      const workerBalanceBefore = await ethers.provider.getBalance(worker.address);
      await escrow.connect(client).verifyMilestone(1, 0, true);

      const ms0 = await escrow.getMilestone(1, 0);
      expect(ms0.paid).to.equal(true);

      // Task should still be InProgress (not all paid)
      const task = await escrow.getTask(1);
      expect(task.status).to.equal(2); // InProgress
    });

    it("should auto-complete task when all milestones paid", async function () {
      const deadline = (await time.latest()) + 86400;

      await escrow.connect(client).createTaskWithMilestones(
        worker.address, totalPayment, deadline, "QmDesc",
        milestoneDescs, milestonePayments,
        { value: totalPayment }
      );

      for (let i = 0; i < 3; i++) {
        await escrow.connect(worker).submitMilestone(1, i, `QmDeliverable${i}`);
        await escrow.connect(client).verifyMilestone(1, i, true);
      }

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(4); // Completed
      expect(task.completedAt).to.be.greaterThan(0);

      // Worker reputation should increase
      const workerAgent = await registry.getAgent(worker.address);
      expect(workerAgent.reputation).to.equal(510);
      expect(workerAgent.tasksCompleted).to.equal(1);
    });

    it("should fail task and refund client on milestone rejection", async function () {
      const deadline = (await time.latest()) + 86400;

      await escrow.connect(client).createTaskWithMilestones(
        worker.address, totalPayment, deadline, "QmDesc",
        milestoneDescs, milestonePayments,
        { value: totalPayment }
      );

      await escrow.connect(worker).submitMilestone(1, 0, "QmBadDeliverable");

      const clientBalanceBefore = await ethers.provider.getBalance(client.address);
      await escrow.connect(client).verifyMilestone(1, 0, false);

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(5); // Failed
    });

    it("should revert verifyMilestone for non-milestone task", async function () {
      const deadline = (await time.latest()) + 86400;

      const fee = (TASK_PAYMENT * 100n) / 10000n;
      const required = TASK_PAYMENT + fee;

      await escrow.connect(client).createAndFundTask(
        worker.address, TASK_PAYMENT, deadline, "QmDesc",
        { value: required }
      );

      await expect(
        escrow.connect(client).verifyMilestone(1, 0, true)
      ).to.be.revertedWith("Task does not use milestones");
    });

    it("should revert submitWork on non-milestone tasks that use milestones path", async function () {
      const deadline = (await time.latest()) + 86400;

      await escrow.connect(client).createTaskWithMilestones(
        worker.address, totalPayment, deadline, "QmDesc",
        milestoneDescs, milestonePayments,
        { value: totalPayment }
      );

      await expect(
        escrow.connect(worker).submitWork(1, "QmDirectDeliverable")
      ).to.be.revertedWith("Milestone tasks must use verifyMilestone");
    });

    it("should emit TaskWithMilestonesCreated event", async function () {
      const deadline = (await time.latest()) + 86400;

      await expect(
        escrow.connect(client).createTaskWithMilestones(
          worker.address, totalPayment, deadline, "QmDesc",
          milestoneDescs, milestonePayments,
          { value: totalPayment }
        )
      ).to.emit(escrow, "TaskWithMilestonesCreated")
        .withArgs(1, client.address, worker.address, totalPayment, 3);
    });

    it("should emit MilestoneCompleted event", async function () {
      const deadline = (await time.latest()) + 86400;

      await escrow.connect(client).createTaskWithMilestones(
        worker.address, totalPayment, deadline, "QmDesc",
        milestoneDescs, milestonePayments,
        { value: totalPayment }
      );

      await expect(
        escrow.connect(worker).submitMilestone(1, 0, "QmDeliverable0")
      ).to.emit(escrow, "MilestoneCompleted").withArgs(1, 0);
    });

    it("should emit MilestonePaid event", async function () {
      const deadline = (await time.latest()) + 86400;

      await escrow.connect(client).createTaskWithMilestones(
        worker.address, totalPayment, deadline, "QmDesc",
        milestoneDescs, milestonePayments,
        { value: totalPayment }
      );

      await escrow.connect(worker).submitMilestone(1, 0, "QmDeliverable0");

      await expect(
        escrow.connect(client).verifyMilestone(1, 0, true)
      ).to.emit(escrow, "MilestonePaid");
    });
  });

  // ============================================================
  // BATCH VERIFICATION
  // ============================================================

  describe("Batch Verification", function () {
    async function createAndCompleteTask(clientSigner, workerSigner, desc) {
      const deadline = (await time.latest()) + 86400;
      const fee = (TASK_PAYMENT * 100n) / 10000n;
      const required = TASK_PAYMENT + fee;

      await escrow.connect(clientSigner).createAndFundTask(
        workerSigner.address, TASK_PAYMENT, deadline, desc,
        { value: required }
      );
      const taskId = await escrow.taskCounter();
      return Number(taskId);
    }

    it("should batch verify all successful tasks", async function () {
      // Need to register the worker for all tasks
      // We'll create 3 tasks between client and worker

      // Submit work on all tasks
      for (let i = 0; i < 3; i++) {
        const taskId = await createAndCompleteTask(client, worker, `QmDesc${i}`);
        await escrow.connect(worker).submitWork(taskId, `QmDeliverable${i}`);
      }

      const taskIds = [1, 2, 3];
      const results = [true, true, true];

      await escrow.connect(client).verifyBatch(taskIds, results);

      for (const id of taskIds) {
        const task = await escrow.getTask(id);
        expect(task.status).to.equal(4); // Completed
      }
    });

    it("should batch verify mixed success/failure", async function () {
      for (let i = 0; i < 3; i++) {
        const taskId = await createAndCompleteTask(client, worker, `QmDesc${i}`);
        await escrow.connect(worker).submitWork(taskId, `QmDeliverable${i}`);
      }

      const taskIds = [1, 2, 3];
      const results = [true, false, true];

      const result = await escrow.connect(client).verifyBatch.staticCall(taskIds, results);
      expect(result[0]).to.equal(2); // successCount
      expect(result[1]).to.equal(1); // failureCount

      // Actually execute
      await escrow.connect(client).verifyBatch(taskIds, results);

      const task1 = await escrow.getTask(1);
      expect(task1.status).to.equal(4); // Completed

      const task2 = await escrow.getTask(2);
      expect(task2.status).to.equal(5); // Failed

      const task3 = await escrow.getTask(3);
      expect(task3.status).to.equal(4); // Completed
    });

    it("should batch verify all failures", async function () {
      for (let i = 0; i < 2; i++) {
        const taskId = await createAndCompleteTask(client, worker, `QmDesc${i}`);
        await escrow.connect(worker).submitWork(taskId, `QmDeliverable${i}`);
      }

      const taskIds = [1, 2];
      const results = [false, false];

      await escrow.connect(client).verifyBatch(taskIds, results);

      for (const id of taskIds) {
        const task = await escrow.getTask(id);
        expect(task.status).to.equal(5); // Failed
      }
    });

    it("should revert with empty task list", async function () {
      await expect(
        escrow.connect(client).verifyBatch([], [])
      ).to.be.revertedWith("No tasks to verify");
    });

    it("should revert with length mismatch", async function () {
      await expect(
        escrow.connect(client).verifyBatch([1], [true, true])
      ).to.be.revertedWith("Task/result length mismatch");
    });

    it("should revert if task not submitted", async function () {
      await expect(
        escrow.connect(client).verifyBatch([999], [true])
      ).to.be.revertedWith("Task not submitted");
    });

    it("should revert if caller is not the client", async function () {
      const deadline = (await time.latest()) + 86400;
      const fee = (TASK_PAYMENT * 100n) / 10000n;
      const required = TASK_PAYMENT + fee;

      await escrow.connect(client).createAndFundTask(
        worker.address, TASK_PAYMENT, deadline, "QmDesc",
        { value: required }
      );
      await escrow.connect(worker).submitWork(1, "QmDelivery");

      // other is not the client
      await expect(
        escrow.connect(other).verifyBatch([1], [true])
      ).to.be.revertedWith("Not task client");
    });

    it("should emit BatchVerified event", async function () {
      for (let i = 0; i < 2; i++) {
        const taskId = await createAndCompleteTask(client, worker, `QmDesc${i}`);
        await escrow.connect(worker).submitWork(taskId, `QmDeliverable${i}`);
      }

      await expect(
        escrow.connect(client).verifyBatch([1, 2], [true, false])
      ).to.emit(escrow, "BatchVerified")
        .withArgs(client.address, 2, 1, 1);
    });
  });
});
