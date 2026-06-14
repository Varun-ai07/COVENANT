const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TaskEscrow (v1)", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const PAYMENT = ethers.parseEther("0.01");
  const PRIORITY_FEE_MEDIUM = PAYMENT * 100n / 10000n;
  const TOTAL_MEDIUM = PAYMENT + PRIORITY_FEE_MEDIUM;
  const PROTOCOL_FEE = PAYMENT * 100n / 10000n;
  const REFUND_AMOUNT = PAYMENT - PROTOCOL_FEE;
  const WORKER_NET = PAYMENT - PROTOCOL_FEE;

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

    await registry.addAuthorizedContract(await escrow.getAddress());
    await verifier.addAuthorizedIssuer(await escrow.getAddress());

    return { registry, verifier, escrow, owner, client, worker, other, deadline };
  }

  async function registeredFixture() {
    const base = await deployFixture();
    const { registry, client, worker } = base;

    await registry.connect(client).register("Client", ["management"], { value: MIN_STAKE });
    await registry.connect(worker).register("Worker", ["code-review"], { value: ethers.parseEther("0.01") });

    return base;
  }

  async function fundedTaskFixture() {
    const base = await registeredFixture();
    const { escrow, client, worker, deadline } = base;

    const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTask"));

    await escrow.connect(client).createAndFundTask(
      worker.address, PAYMENT, deadline, descriptionHash,
      { value: TOTAL_MEDIUM }
    );

    return { ...base, descriptionHash };
  }

  describe("Deployment", function () {
    it("should deploy with correct contract references", async function () {
      const { registry, verifier, escrow, owner } = await loadFixture(deployFixture);
      expect(await escrow.agentRegistry()).to.equal(await registry.getAddress());
      expect(await escrow.receiptVerifier()).to.equal(await verifier.getAddress());
      expect(await escrow.feeRecipient()).to.equal(owner.address);
      expect(await escrow.owner()).to.equal(owner.address);
    });

    it("should set feeRecipient default to owner", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      expect(await escrow.feeRecipient()).to.equal(owner.address);
    });

    it("should allow owner to update feeRecipient", async function () {
      const { escrow, owner, other } = await loadFixture(deployFixture);
      await expect(escrow.setFeeRecipient(other.address))
        .to.emit(escrow, "FeeRecipientUpdated");
      expect(await escrow.feeRecipient()).to.equal(other.address);
    });

    it("should reject setFeeRecipient to zero address", async function () {
      const { escrow } = await loadFixture(deployFixture);
      await expect(
        escrow.setFeeRecipient(ethers.ZeroAddress)
      ).to.be.revertedWith("!zero addr");
    });

    it("should reject setFeeRecipient from non-owner", async function () {
      const { escrow, client } = await loadFixture(deployFixture);
      await expect(
        escrow.connect(client).setFeeRecipient(client.address)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });
  });

  describe("createAndFundTask", function () {
    it("should create and fund a task with Medium priority", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTask"));

      const tx = await escrow.connect(client).createAndFundTask(
        worker.address, PAYMENT, deadline, descriptionHash,
        { value: TOTAL_MEDIUM }
      );

      await expect(tx).to.emit(escrow, "TaskCreated").withArgs(
        1, client.address, worker.address, PAYMENT, deadline
      );

      const task = await escrow.getTask(1);
      expect(task.client).to.equal(client.address);
      expect(task.worker).to.equal(worker.address);
      expect(task.payment).to.equal(PAYMENT);
      expect(task.deadline).to.equal(deadline);
      expect(task.status).to.equal(2); // InProgress
      expect(task.priority).to.equal(1); // Medium
      expect(task.createdAt).to.be.gt(0);
      expect(task.descriptionHash).to.equal(descriptionHash);
      expect(task.deliverableHash).to.equal("");
    });

    it("should accumulate priority fees", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTask"));

      await escrow.connect(client).createAndFundTask(
        worker.address, PAYMENT, deadline, descriptionHash,
        { value: TOTAL_MEDIUM }
      );

      expect(await escrow.accumulatedFees()).to.equal(PRIORITY_FEE_MEDIUM);
    });

    it("should work with Low priority via explicit function", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTaskLow"));
      const priorityFeeLow = PAYMENT * 50n / 10000n;

      const tx = await escrow.connect(client).createAndFundTaskWithPriority(
        worker.address, PAYMENT, deadline, descriptionHash, 0,
        { value: PAYMENT + priorityFeeLow }
      );

      await expect(tx).to.emit(escrow, "TaskCreated");
      const task = await escrow.getTask(1);
      expect(task.priority).to.equal(0); // Low
    });

    it("should work with High priority", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTaskHigh"));
      const priorityFeeHigh = PAYMENT * 200n / 10000n;

      await escrow.connect(client).createAndFundTaskWithPriority(
        worker.address, PAYMENT, deadline, descriptionHash, 2,
        { value: PAYMENT + priorityFeeHigh }
      );

      const task = await escrow.getTask(1);
      expect(task.priority).to.equal(2); // High
    });

    it("should work with Urgent priority", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTaskUrgent"));
      const priorityFeeUrgent = PAYMENT * 500n / 10000n;

      await escrow.connect(client).createAndFundTaskWithPriority(
        worker.address, PAYMENT, deadline, descriptionHash, 3,
        { value: PAYMENT + priorityFeeUrgent }
      );

      const task = await escrow.getTask(1);
      expect(task.priority).to.equal(3); // Urgent
    });

    it("should reject with insufficient funds", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmFail"));

      await expect(
        escrow.connect(client).createAndFundTask(
          worker.address, PAYMENT, deadline, descriptionHash,
          { value: PAYMENT }
        )
      ).to.be.revertedWith("!funds");
    });

    it("should reject zero payment", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmFail"));

      await expect(
        escrow.connect(client).createAndFundTask(
          worker.address, 0, deadline, descriptionHash,
          { value: 0 }
        )
      ).to.be.revertedWith("!payment");
    });

    it("should reject past deadline", async function () {
      const { escrow, client, worker } = await loadFixture(registeredFixture);
      const pastDeadline = (await ethers.provider.getBlock("latest")).timestamp - 1;
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmFail"));

      await expect(
        escrow.connect(client).createAndFundTask(
          worker.address, PAYMENT, pastDeadline, descriptionHash,
          { value: TOTAL_MEDIUM }
        )
      ).to.be.revertedWith("!deadline");
    });

    it("should reject empty description", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);

      await expect(
        escrow.connect(client).createAndFundTask(
          worker.address, PAYMENT, deadline, "",
          { value: TOTAL_MEDIUM }
        )
      ).to.be.revertedWith("!desc");
    });

    it("should reject if client is not registered", async function () {
      const { escrow, registry, other, worker, deadline } = await loadFixture(deployFixture);
      await registry.connect(worker).register("Worker", ["code-review"], { value: MIN_STAKE });
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTask"));

      await expect(
        escrow.connect(other).createAndFundTask(
          worker.address, PAYMENT, deadline, descriptionHash,
          { value: TOTAL_MEDIUM }
        )
      ).to.be.revertedWith("!client reg");
    });

    it("should reject if worker is not registered", async function () {
      const { escrow, client, other, deadline } = await loadFixture(registeredFixture);
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTask"));

      await expect(
        escrow.connect(client).createAndFundTask(
          other.address, PAYMENT, deadline, descriptionHash,
          { value: TOTAL_MEDIUM }
        )
      ).to.be.revertedWith("!worker reg");
    });

    it("should reject if client has zero reputation", async function () {
      const { escrow, registry, client, owner, worker, deadline } = await loadFixture(deployFixture);
      await registry.connect(client).register("Client", ["mgmt"], { value: MIN_STAKE });
      await registry.connect(worker).register("Worker", ["code-review"], { value: MIN_STAKE });
      await registry.addAuthorizedContract(owner.address);
      await registry.updateReputation(worker.address, -500);
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTask"));

      await expect(
        escrow.connect(client).createAndFundTask(
          worker.address, PAYMENT, deadline, descriptionHash,
          { value: TOTAL_MEDIUM }
        )
      ).to.be.revertedWith("!rep");
    });
  });

  describe("Two-step: createTask + fundTask", function () {
    it("should create task in Created status then fund it", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTwoStep"));

      const tx = await escrow.connect(client).createTask(worker.address, PAYMENT, deadline, descriptionHash);
      await expect(tx).to.emit(escrow, "TaskCreated");

      let task = await escrow.getTask(1);
      expect(task.status).to.equal(0); // Created

      await escrow.connect(client).fundTask(1, { value: PAYMENT });
      task = await escrow.getTask(1);
      expect(task.status).to.equal(2); // InProgress
    });

    it("should reject fundTask with insufficient funds", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTwoStep"));

      await escrow.connect(client).createTask(worker.address, PAYMENT, deadline, descriptionHash);
      await expect(
        escrow.connect(client).fundTask(1, { value: PAYMENT - 1n })
      ).to.be.revertedWith("Insufficient funding");
    });

    it("should reject fundTask from non-client", async function () {
      const { escrow, client, worker, other, deadline } = await loadFixture(registeredFixture);
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTwoStep"));

      await escrow.connect(client).createTask(worker.address, PAYMENT, deadline, descriptionHash);
      await expect(
        escrow.connect(other).fundTask(1, { value: PAYMENT })
      ).to.be.revertedWith("!client");
    });
  });

  describe("createAndFundTaskForCollective", function () {
    it("should create task for collective (skips client reg)", async function () {
      const { escrow, registry, owner, client, worker, deadline } = await loadFixture(deployFixture);
      await registry.connect(worker).register("Worker", ["code-review"], { value: MIN_STAKE });
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmCollective"));

      const tx = await escrow.connect(owner).createAndFundTaskForCollective(
        client.address, worker.address, PAYMENT, deadline, descriptionHash,
        { value: TOTAL_MEDIUM }
      );

      const task = await escrow.getTask(1);
      expect(task.client).to.equal(client.address);
      expect(task.worker).to.equal(worker.address);
      expect(task.status).to.equal(2); // InProgress
    });
  });

  describe("Task Lifecycle: Submit and Verify", function () {
    it("should submit work and move to Submitted status", async function () {
      const { escrow, worker } = await loadFixture(fundedTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliverable"));

      const tx = await escrow.connect(worker).submitWork(1, deliverable);
      await expect(tx).to.emit(escrow, "WorkSubmitted");

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(3); // Submitted
      expect(task.deliverableHash).to.equal(deliverable);
    });

    it("should complete task on successful verification and pay worker", async function () {
      const { escrow, registry, verifier, client, worker } = await loadFixture(fundedTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliverable"));
      await escrow.connect(worker).submitWork(1, deliverable);

      const workerBalBefore = await ethers.provider.getBalance(worker.address);
      const tx = await escrow.connect(client).verifyTask(1, true);
      await expect(tx).to.emit(escrow, "TaskCompleted");

      const workerBalAfter = await ethers.provider.getBalance(worker.address);
      const netPayment = PAYMENT - (PAYMENT * 100n / 10000n);
      expect(workerBalAfter - workerBalBefore).to.equal(netPayment);

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(4); // Completed
      expect(task.completedAt).to.be.gt(0);

      const agent = await registry.getAgent(worker.address);
      expect(agent.tasksCompleted).to.equal(1);
      expect(agent.reputation).to.equal(510); // +10
    });

    it("should fail task on failed verification and refund client", async function () {
      const { escrow, registry, client, worker } = await loadFixture(fundedTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmBad"));
      await escrow.connect(worker).submitWork(1, deliverable);

      const clientBalBefore = await ethers.provider.getBalance(client.address);
      const tx = await escrow.connect(client).verifyTask(1, false);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const clientBalAfter = await ethers.provider.getBalance(client.address);
      const expectedRefund = PAYMENT - (PAYMENT * 100n / 10000n);
      expect(clientBalAfter + gasCost).to.be.closeTo(
        clientBalBefore + expectedRefund,
        ethers.parseEther("0.0001")
      );

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(5); // Failed

      const agent = await registry.getAgent(worker.address);
      expect(agent.tasksFailed).to.equal(1);
      expect(agent.reputation).to.equal(480); // -20
      // 50% stake slashed
      expect(agent.stakedAmount).to.equal(ethers.parseEther("0.01") / 2n);
    });

    it("should reject submitWork from non-worker", async function () {
      const { escrow, client } = await loadFixture(fundedTaskFixture);
      await expect(
        escrow.connect(client).submitWork(1, ethers.keccak256(ethers.toUtf8Bytes("fake")))
      ).to.be.revertedWith("!worker");
    });

    it("should reject verifyTask from non-client", async function () {
      const { escrow, worker } = await loadFixture(fundedTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliverable"));
      await escrow.connect(worker).submitWork(1, deliverable);

      await expect(
        escrow.connect(worker).verifyTask(1, true)
      ).to.be.revertedWith("!client");
    });

    it("should reject submitWork after deadline", async function () {
      const { escrow, worker, deadline } = await loadFixture(fundedTaskFixture);
      await time.increaseTo(deadline + 1);

      await expect(
        escrow.connect(worker).submitWork(1, ethers.keccak256(ethers.toUtf8Bytes("late")))
      ).to.be.revertedWith("Deadline passed");
    });

    it("should reject double verification", async function () {
      const { escrow, client, worker } = await loadFixture(fundedTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliverable"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, true);

      // Task is completed, cannot submit again
      await expect(
        escrow.connect(worker).submitWork(1, deliverable)
      ).to.be.revertedWith("Not in progress");
    });
  });

  describe("checkDeadline", function () {
    it("should fail task and refund client after deadline", async function () {
      const { escrow, client, deadline } = await loadFixture(fundedTaskFixture);
      await time.increaseTo(deadline + 1);

      const clientBalBefore = await ethers.provider.getBalance(client.address);
      await escrow.checkDeadline(1);

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(5); // Failed

      const clientBalAfter = await ethers.provider.getBalance(client.address);
      expect(clientBalAfter - clientBalBefore).to.equal(REFUND_AMOUNT);
    });

    it("should reject checkDeadline before deadline", async function () {
      const { escrow } = await loadFixture(fundedTaskFixture);
      await expect(escrow.checkDeadline(1)).to.be.revertedWith("Deadline not passed");
    });

    it("should reject checkDeadline on completed task", async function () {
      const { escrow, client, worker } = await loadFixture(fundedTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliverable"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, true);

      await expect(escrow.checkDeadline(1)).to.be.revertedWith("Cannot check deadline");
    });
  });

  describe("Milestones", function () {
    const TOTAL_PAYMENT = ethers.parseEther("0.01");
    const MILESTONE_PAYMENTS = [
      ethers.parseEther("0.004"),
      ethers.parseEther("0.006"),
    ];

    async function milestoneTaskFixture() {
      const base = await registeredFixture();
      const { escrow, client, worker, deadline } = base;

      const descHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmMilestoneTask"));
      const milestoneDescs = [
        ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmMS1")),
        ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmMS2")),
      ];

      await escrow.connect(client).createTaskWithMilestones(
        worker.address, TOTAL_PAYMENT, deadline, descHash,
        milestoneDescs, MILESTONE_PAYMENTS,
        { value: TOTAL_PAYMENT }
      );

      return { ...base, milestoneDescs, descHash };
    }

    it("should create a milestone task", async function () {
      const { escrow } = await loadFixture(milestoneTaskFixture);
      const task = await escrow.getTask(1);
      expect(task.usesMilestones).to.be.true;
      expect(task.status).to.equal(2); // InProgress
      expect(await escrow.getMilestoneCount(1)).to.equal(2);
    });

    it("should reject milestone sum mismatch", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTask"));
      const milestoneDescs = [ethers.keccak256(ethers.toUtf8Bytes("ms1"))];
      const milestonePayments = [TOTAL_PAYMENT - 1n]; // doesn't sum to total

      await expect(
        escrow.connect(client).createTaskWithMilestones(
          worker.address, TOTAL_PAYMENT, deadline, descHash,
          milestoneDescs, milestonePayments,
          { value: TOTAL_PAYMENT }
        )
      ).to.be.revertedWith("!sum");
    });

    it("should submit milestones sequentially", async function () {
      const { escrow, worker } = await loadFixture(milestoneTaskFixture);
      const deliv0 = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliv0"));

      await escrow.connect(worker).submitMilestone(1, 0, deliv0);
      const m0 = await escrow.getMilestone(1, 0);
      expect(m0.completed).to.be.true;
      expect(m0.deliverableHash).to.equal(deliv0);

      const deliv1 = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliv1"));
      await escrow.connect(worker).submitMilestone(1, 1, deliv1);
      const m1 = await escrow.getMilestone(1, 1);
      expect(m1.completed).to.be.true;
    });

    it("should reject out-of-order milestone submission", async function () {
      const { escrow, worker } = await loadFixture(milestoneTaskFixture);
      const deliv1 = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliv1"));

      await expect(
        escrow.connect(worker).submitMilestone(1, 1, deliv1)
      ).to.be.revertedWith("!prev");
    });

    it("should verify milestone and pay partial amount", async function () {
      const { escrow, worker, client } = await loadFixture(milestoneTaskFixture);
      const deliv0 = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliv0"));
      await escrow.connect(worker).submitMilestone(1, 0, deliv0);

      const workerBalBefore = await ethers.provider.getBalance(worker.address);
      const tx = await escrow.connect(client).verifyMilestone(1, 0, true);
      await expect(tx).to.emit(escrow, "MilestonePaid");

      const workerBalAfter = await ethers.provider.getBalance(worker.address);
      const msFee = MILESTONE_PAYMENTS[0] * 100n / 10000n;
      const msNet = MILESTONE_PAYMENTS[0] - msFee;
      expect(workerBalAfter - workerBalBefore).to.equal(msNet);

      const m0 = await escrow.getMilestone(1, 0);
      expect(m0.paid).to.be.true;
    });

    it("should complete task when all milestones paid", async function () {
      const { escrow, worker, client } = await loadFixture(milestoneTaskFixture);
      const deliv0 = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliv0"));
      const deliv1 = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliv1"));

      await escrow.connect(worker).submitMilestone(1, 0, deliv0);
      await escrow.connect(client).verifyMilestone(1, 0, true);

      await escrow.connect(worker).submitMilestone(1, 1, deliv1);
      const tx = await escrow.connect(client).verifyMilestone(1, 1, true);
      await expect(tx).to.emit(escrow, "TaskCompleted");

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(4); // Completed
    });

    it("should fail task on milestone rejection and refund client", async function () {
      const { escrow, client, worker } = await loadFixture(milestoneTaskFixture);
      const deliv0 = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliv0"));
      await escrow.connect(worker).submitMilestone(1, 0, deliv0);

      const clientBalBefore = await ethers.provider.getBalance(client.address);
      const tx = await escrow.connect(client).verifyMilestone(1, 0, false);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(5); // Failed

      const clientBalAfter = await ethers.provider.getBalance(client.address);
      expect(clientBalAfter + gasCost).to.be.closeTo(
        clientBalBefore + TOTAL_PAYMENT,
        ethers.parseEther("0.0001")
      );
    });

    it("should reject verifyMilestone on non-milestone task", async function () {
      const { escrow, client } = await loadFixture(fundedTaskFixture);
      await expect(
        escrow.connect(client).verifyMilestone(1, 0, true)
      ).to.be.revertedWith("Task does not use milestones");
    });

    it("should reject submitMilestone on non-milestone task", async function () {
      const { escrow, worker } = await loadFixture(fundedTaskFixture);
      await expect(
        escrow.connect(worker).submitMilestone(1, 0, ethers.keccak256(ethers.toUtf8Bytes("fake")))
      ).to.be.revertedWith("!milestones");
    });

    it("should reject submitWork on milestone task", async function () {
      const { escrow, worker } = await loadFixture(milestoneTaskFixture);
      await expect(
        escrow.connect(worker).submitWork(1, ethers.keccak256(ethers.toUtf8Bytes("fake")))
      ).to.be.revertedWith("Milestone tasks must use verifyMilestone");
    });
  });

  describe("Hierarchical Subtasks", function () {
    async function subtaskFixture() {
      const base = await fundedTaskFixture();
      const { escrow, client, worker, deadline } = base;

      const subtaskPayment = ethers.parseEther("0.005");
      const subtaskFee = subtaskPayment * 100n / 10000n;
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmSubtask"));

      await escrow.connect(client).createSubtask(
        1, worker.address, subtaskPayment, deadline, descriptionHash,
        { value: subtaskPayment + subtaskFee }
      );

      return { ...base, subtaskPayment, subtaskFee };
    }

    it("should create a subtask linked to parent", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(fundedTaskFixture);
      const subtaskPayment = ethers.parseEther("0.005");
      const subtaskFee = subtaskPayment * 100n / 10000n;
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmSubtask"));

      const tx = await escrow.connect(client).createSubtask(
        1, worker.address, subtaskPayment, deadline, descriptionHash,
        { value: subtaskPayment + subtaskFee }
      );
      await expect(tx).to.emit(escrow, "SubtaskCreated");

      const subtask = await escrow.getTask(2);
      expect(subtask.parentTaskId).to.equal(1);
      expect(subtask.status).to.equal(2); // InProgress

      const childTasks = await escrow.getChildTasks(1);
      expect(childTasks.length).to.equal(1);
      expect(childTasks[0]).to.equal(2);
    });

    it("should allow worker to create subtask", async function () {
      const { escrow, worker, client, deadline } = await loadFixture(fundedTaskFixture);
      const subtaskPayment = ethers.parseEther("0.003");
      const subtaskFee = subtaskPayment * 100n / 10000n;

      await escrow.connect(worker).createSubtask(
        1, client.address, subtaskPayment, deadline,
        ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmSubByWorker")),
        { value: subtaskPayment + subtaskFee }
      );

      expect(await escrow.getTask(2)).to.not.be.undefined;
    });

    it("should reject subtask for non-existent parent", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registeredFixture);
      await expect(
        escrow.connect(client).createSubtask(
          999, worker.address, ethers.parseEther("0.005"), deadline,
          ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmBad")),
          { value: ethers.parseEther("0.00505") }
        )
      ).to.be.revertedWith("Parent task does not exist");
    });

    it("should reject subtask from non-participant of parent", async function () {
      const { escrow, other, worker, deadline } = await loadFixture(fundedTaskFixture);
      const sub = ethers.parseEther("0.005");
      await expect(
        escrow.connect(other).createSubtask(
          1, worker.address, sub, deadline,
          ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmAuth")),
          { value: sub + sub * 100n / 10000n }
        )
      ).to.be.revertedWith("Not authorized to create subtask");
    });
  });

  describe("Batch Verification", function () {
    async function batchFixture() {
      const base = await registeredFixture();
      const { escrow, client, worker, deadline } = base;
      const desc = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmBatch"));

      // Create 3 tasks, all submitted
      for (let i = 0; i < 3; i++) {
        await escrow.connect(client).createAndFundTask(
          worker.address, PAYMENT, deadline, desc,
          { value: TOTAL_MEDIUM }
        );
        await escrow.connect(worker).submitWork(
          i + 1, ethers.keccak256(ethers.toUtf8Bytes("deliv-" + i))
        );
      }
      return base;
    }

    it("should batch verify all tasks as success", async function () {
      const { escrow, client, worker } = await loadFixture(batchFixture);

      const workerBalBefore = await ethers.provider.getBalance(worker.address);
      const tx = await escrow.connect(client).verifyBatch(
        [1, 2, 3], [true, true, true]
      );
      await expect(tx).to.emit(escrow, "BatchVerified");

      const task1 = await escrow.getTask(1);
      const task2 = await escrow.getTask(2);
      const task3 = await escrow.getTask(3);
      expect(task1.status).to.equal(4); // Completed
      expect(task2.status).to.equal(4);
      expect(task3.status).to.equal(4);

      const workerBalAfter = await ethers.provider.getBalance(worker.address);
      const netPerTask = PAYMENT - (PAYMENT * 100n / 10000n);
      expect(workerBalAfter - workerBalBefore).to.equal(netPerTask * 3n);
    });

    it("should batch verify mixed results", async function () {
      const { escrow, client } = await loadFixture(batchFixture);

      await escrow.connect(client).verifyBatch(
        [1, 2, 3], [true, false, true]
      );

      const task1 = await escrow.getTask(1);
      const task2 = await escrow.getTask(2);
      const task3 = await escrow.getTask(3);
      expect(task1.status).to.equal(4); // Completed
      expect(task2.status).to.equal(5); // Failed
      expect(task3.status).to.equal(4); // Completed
    });

    it("should reject batch with empty arrays", async function () {
      const { escrow, client } = await loadFixture(batchFixture);
      await expect(
        escrow.connect(client).verifyBatch([], [])
      ).to.be.revertedWith("No tasks to verify");
    });

    it("should reject batch with mismatched lengths", async function () {
      const { escrow, client } = await loadFixture(batchFixture);
      await expect(
        escrow.connect(client).verifyBatch([1, 2], [true])
      ).to.be.revertedWith("Task/result length mismatch");
    });
  });

  describe("Dispute and Resolve", function () {
    async function disputedFixture() {
      const base = await fundedTaskFixture();
      const { escrow, client, worker } = base;

      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDispute"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(worker).disputeTask(1);

      return base;
    }

    it("should dispute a submitted task", async function () {
      const { escrow } = await loadFixture(disputedFixture);
      const task = await escrow.getTask(1);
      expect(task.status).to.equal(6); // Disputed
    });

    it("should resolve dispute in worker's favor", async function () {
      const { escrow, client, worker, owner } = await loadFixture(disputedFixture);

      const workerBalBefore = await ethers.provider.getBalance(worker.address);
      const tx = await escrow.connect(owner).resolveDispute(1, true);
      await expect(tx).to.emit(escrow, "TaskResolved").withArgs(1, true, WORKER_NET);

      const workerBalAfter = await ethers.provider.getBalance(worker.address);
      expect(workerBalAfter - workerBalBefore).to.equal(WORKER_NET);

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(4); // Completed
    });

    it("should resolve dispute in client's favor", async function () {
      const { escrow, client, worker, owner } = await loadFixture(disputedFixture);
      // TaskEscrow v1's resolveDispute refunds client minus fee
      const clientBalBefore = await ethers.provider.getBalance(client.address);
      const tx = await escrow.connect(owner).resolveDispute(1, false);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const task = await escrow.getTask(1);
      expect(task.status).to.equal(5); // Failed

      const clientBalAfter = await ethers.provider.getBalance(client.address);
      const expectedRefund = PAYMENT - (PAYMENT * 100n / 10000n);
      expect(clientBalAfter + gasCost).to.be.closeTo(
        clientBalBefore + expectedRefund,
        ethers.parseEther("0.0001")
      );
    });

    it("should reject double resolution", async function () {
      const { escrow, owner } = await loadFixture(disputedFixture);
      await escrow.connect(owner).resolveDispute(1, true);
      await expect(
        escrow.connect(owner).resolveDispute(1, true)
      ).to.be.revertedWith("Not disputed");
    });

    it("should reject resolveDispute from non-owner", async function () {
      const { escrow, client } = await loadFixture(disputedFixture);
      await expect(
        escrow.connect(client).resolveDispute(1, true)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("should reject dispute on completed task", async function () {
      const { escrow, client, worker } = await loadFixture(fundedTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDone"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, true);

      await expect(
        escrow.connect(worker).disputeTask(1)
      ).to.be.revertedWith("Cannot dispute in current status");
    });
  });

  describe("Fee Management", function () {
    it("should accumulate protocol fees from verification", async function () {
      const { escrow, client, worker } = await loadFixture(fundedTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDone"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, true);

      // Priority fee (1% of payment) + Protocol fee (1% of payment)
      const totalFees = PRIORITY_FEE_MEDIUM + PROTOCOL_FEE;
      expect(await escrow.accumulatedFees()).to.equal(totalFees);
    });

    it("should withdraw fees to feeRecipient", async function () {
      const { escrow, client, worker, owner, other } = await loadFixture(fundedTaskFixture);
      // Set feeRecipient to a separate account so caller doesn't pay gas
      await escrow.setFeeRecipient(other.address);

      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDone"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, true);

      const balBefore = await ethers.provider.getBalance(other.address);
      await escrow.connect(owner).withdrawFees();
      const balAfter = await ethers.provider.getBalance(other.address);

      const totalFees = PRIORITY_FEE_MEDIUM + PROTOCOL_FEE;
      expect(balAfter - balBefore).to.equal(totalFees);
      expect(await escrow.accumulatedFees()).to.equal(0);
    });

    it("should reject withdrawFees from non-authorized", async function () {
      const { escrow, client } = await loadFixture(fundedTaskFixture);
      await expect(
        escrow.connect(client).withdrawFees()
      ).to.be.revertedWith("!authorized");
    });

    it("should allow feeRecipient to withdraw", async function () {
      const { escrow, client, worker, owner } = await loadFixture(fundedTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDone"));
      await escrow.connect(worker).submitWork(1, deliverable);
      await escrow.connect(client).verifyTask(1, true);

      await expect(escrow.connect(owner).withdrawFees()).to.not.be.reverted;
    });
  });

  describe("Query System", function () {
    it("should submit a query on an in-progress task", async function () {
      const { escrow, client } = await loadFixture(fundedTaskFixture);
      const tx = await escrow.connect(client).submitQuery(1, "What is the spec?", 0);
      await expect(tx).to.emit(escrow, "QuerySubmitted");

      expect(await escrow.getQueryCount(1)).to.equal(1);
      const query = await escrow.getQuery(1, 0);
      expect(query.sender).to.equal(client.address);
      expect(query.queryText).to.equal("What is the spec?");
      expect(query.queryType).to.equal(0); // SpecificationClarification
    });

    it("should respond to the latest query", async function () {
      const { escrow, client, worker } = await loadFixture(fundedTaskFixture);
      await escrow.connect(client).submitQuery(1, "What is the spec?", 0);
      const tx = await escrow.connect(worker).respondToQuery(1, "See attached spec");
      await expect(tx).to.emit(escrow, "QueryResponded");

      expect(await escrow.isLatestQueryResponded(1)).to.be.true;
    });

    it("should reject responding to own query", async function () {
      const { escrow, client } = await loadFixture(fundedTaskFixture);
      await escrow.connect(client).submitQuery(1, "What is the spec?", 0);
      await expect(
        escrow.connect(client).respondToQuery(1, "Can't answer myself")
      ).to.be.revertedWith("!own query");
    });

    it("should reject query on non-in-progress task", async function () {
      const { escrow, client, worker } = await loadFixture(fundedTaskFixture);
      const d = ethers.keccak256(ethers.toUtf8Bytes("done"));
      await escrow.connect(worker).submitWork(1, d);
      await escrow.connect(client).verifyTask(1, true);

      await expect(
        escrow.connect(client).submitQuery(1, "Too late", 1)
      ).to.be.revertedWith("Task not in progress");
    });
  });

  describe("Read Functions", function () {
    it("should get task priority", async function () {
      const { escrow } = await loadFixture(fundedTaskFixture);
      expect(await escrow.getTaskPriority(1)).to.equal(1); // Medium
    });

    it("should check if task uses milestones", async function () {
      const { escrow } = await loadFixture(fundedTaskFixture);
      expect(await escrow.isMilestoneTask(1)).to.be.false;
    });

    it("should get client tasks", async function () {
      const { escrow, client } = await loadFixture(fundedTaskFixture);
      const tasks = await escrow.getClientTasks(client.address);
      expect(tasks.length).to.equal(1);
      expect(tasks[0]).to.equal(1);
    });

    it("should get worker tasks", async function () {
      const { escrow, worker } = await loadFixture(fundedTaskFixture);
      const tasks = await escrow.getWorkerTasks(worker.address);
      expect(tasks.length).to.equal(1);
      expect(tasks[0]).to.equal(1);
    });

    it("should get milestone count for non-milestone task", async function () {
      const { escrow } = await loadFixture(fundedTaskFixture);
      expect(await escrow.getMilestoneCount(1)).to.equal(0);
    });
  });
});
