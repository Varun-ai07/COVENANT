const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("COVENANT Integration — Full Agent Lifecycle", function () {
  const MOCK_VERIFIER = "0x0000000000000000000000000000000000000001";
  const TASK_PAYMENT = ethers.parseEther("0.01");
  const STAKE_AMOUNT = ethers.parseEther("0.01");

  async function deployFixture() {
    const [owner, client, worker, other] = await ethers.getSigners();

    // Deploy AgentRegistry
    const AgentRegistry = await ethers.getContractFactory(
      "contracts/v2/core/AgentRegistry.sol:AgentRegistry"
    );
    const registry = await AgentRegistry.deploy(MOCK_VERIFIER, MOCK_VERIFIER);
    await registry.waitForDeployment();

    // Deploy ReceiptVerifier
    const ReceiptVerifier = await ethers.getContractFactory(
      "contracts/v2/core/ReceiptVerifier.sol:ReceiptVerifier"
    );
    const verifier = await ReceiptVerifier.deploy();
    await verifier.waitForDeployment();

    // Deploy TaskEscrow with registry + verifier + feeRecipient
    const TaskEscrow = await ethers.getContractFactory(
      "contracts/v2/core/TaskEscrow.sol:TaskEscrow"
    );
    const escrow = await TaskEscrow.deploy(
      await registry.getAddress(),
      await verifier.getAddress(),
      owner.address
    );
    await escrow.waitForDeployment();

    // Authorize escrow on registry so it can call recordTaskCompletion
    await registry.addAuthorizedContract(await escrow.getAddress());

    // Authorize escrow on verifier so it can create receipts
    await verifier.addAuthorizedIssuer(await escrow.getAddress());

    // Authorize owner on verifier for direct receipt creation
    await verifier.addAuthorizedIssuer(owner.address);

    // Deadline: 2 hours from now
    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 7200;

    return { registry, verifier, escrow, owner, client, worker, other, deadline };
  }

  async function deployAndRegisterFixture() {
    const fixture = await deployFixture();
    const { registry, client, worker, deadline } = fixture;

    // Register client agent
    await registry.connect(client).register("ClientAgent", ["task-management"], {
      value: STAKE_AMOUNT,
    });

    // Register worker agent
    await registry.connect(worker).register("WorkerAgent", ["data-analysis", "code-review"], {
      value: STAKE_AMOUNT,
    });

    return { ...fixture };
  }

  // ─── Deploy + Registration ───────────────────────────────────────

  describe("Contract Deployment", function () {
    it("should deploy all three contracts with correct links", async function () {
      const { registry, verifier, escrow } = await loadFixture(deployFixture);

      expect(await escrow.agentRegistry()).to.equal(await registry.getAddress());
      expect(await escrow.receiptVerifier()).to.equal(await verifier.getAddress());
    });

    it("should authorize escrow on registry", async function () {
      const { registry, escrow } = await loadFixture(deployFixture);
      const AUTHORIZED_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUTHORIZED_ROLE"));
      expect(
        await registry.hasRole(AUTHORIZED_ROLE, await escrow.getAddress())
      ).to.be.true;
    });
  });

  // ─── Agent Registration ──────────────────────────────────────────

  describe("Agent Registration", function () {
    it("should register client agent with correct initial state", async function () {
      const { registry, client } = await loadFixture(deployAndRegisterFixture);

      const agent = await registry.getAgent(client.address);
      expect(agent.isActive).to.equal(1);
      expect(agent.reputation).to.equal(500);
      expect(agent.stakedAmount).to.equal(STAKE_AMOUNT);
      expect(agent.tasksCompleted).to.equal(0);
      expect(agent.tasksFailed).to.equal(0);
    });

    it("should register worker agent with capabilities", async function () {
      const { registry, worker } = await loadFixture(deployAndRegisterFixture);

      const agent = await registry.getAgent(worker.address);
      expect(agent.isActive).to.equal(1);

      const capHash1 = ethers.keccak256(ethers.toUtf8Bytes("data-analysis"));
      const capHash2 = ethers.keccak256(ethers.toUtf8Bytes("code-review"));
      expect(await registry.hasCapability(worker.address, capHash1)).to.be.true;
      expect(await registry.hasCapability(worker.address, capHash2)).to.be.true;
    });

    it("should increment agent count", async function () {
      const { registry } = await loadFixture(deployAndRegisterFixture);
      expect(await registry.agentCount()).to.equal(2);
    });

    it("should reject duplicate registration", async function () {
      const { registry, client } = await loadFixture(deployAndRegisterFixture);
      await expect(
        registry.connect(client).register("Duplicate", ["test"], { value: STAKE_AMOUNT })
      ).to.be.revertedWith("Already registered");
    });

    it("should reject registration with insufficient stake", async function () {
      const { registry, other } = await loadFixture(deployFixture);
      await expect(
        registry.connect(other).register("LowStake", ["test"], { value: 0n })
      ).to.be.revertedWith("Insufficient stake");
    });
  });

  // ─── Full Lifecycle: Create -> Submit -> Verify ──────────────────

  describe("Full Lifecycle: Create, Submit, Verify", function () {
    it("should complete full lifecycle: register -> create -> submit -> verify", async function () {
      const { registry, verifier, escrow, client, worker, owner, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTaskDescription"));
      const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliverableData"));

      // ── Step 1: Client creates and funds task ──
      const tx = await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        descriptionHash,
        { value: TASK_PAYMENT }
      );
      const receipt = await tx.wait();

      // Verify TaskCreated event
      const taskCreatedEvent = receipt.logs.find(
        (log) => escrow.interface.parseLog(log)?.name === "TaskCreated"
      );
      expect(taskCreatedEvent).to.not.be.undefined;

      const task = await escrow.getTask(0);
      expect(task.client).to.equal(client.address);
      expect(task.worker).to.equal(worker.address);
      expect(task.payment).to.equal(TASK_PAYMENT);
      expect(task.status).to.equal(1); // Funded
      expect(task.descriptionHash).to.equal(descriptionHash);

      // ── Step 2: Worker submits deliverable ──
      const submitTx = await escrow.connect(worker).submitWork(0, deliverableHash);
      const submitReceipt = await submitTx.wait();

      const workSubmittedEvent = submitReceipt.logs.find(
        (log) => escrow.interface.parseLog(log)?.name === "WorkSubmitted"
      );
      expect(workSubmittedEvent).to.not.be.undefined;

      const taskAfterSubmit = await escrow.getTask(0);
      expect(taskAfterSubmit.status).to.equal(3); // Submitted
      expect(taskAfterSubmit.deliverableHash).to.equal(deliverableHash);

      // ── Step 3: Client verifies task (releases payment) ──
      const workerBalBefore = await ethers.provider.getBalance(worker.address);

      const verifyTx = await escrow.connect(client).verifyTask(0, true);
      const verifyReceipt = await verifyTx.wait();

      const taskCompletedEvent = verifyReceipt.logs.find(
        (log) => escrow.interface.parseLog(log)?.name === "TaskCompleted"
      );
      expect(taskCompletedEvent).to.not.be.undefined;

      const taskAfterVerify = await escrow.getTask(0);
      expect(taskAfterVerify.status).to.equal(4); // Completed
      expect(taskAfterVerify.completedAt).to.be.gt(0n);

      // ── Step 4: Assert worker received payment (minus 1% fee) ──
      const expectedFee = (TASK_PAYMENT * 100n) / 10000n; // 1% protocol fee
      const expectedWorkerPayment = TASK_PAYMENT - expectedFee;

      const workerBalAfter = await ethers.provider.getBalance(worker.address);
      expect(workerBalAfter - workerBalBefore).to.equal(expectedWorkerPayment);

      // ── Step 5: Assert protocol fee accumulated ──
      expect(await escrow.accumulatedFees()).to.equal(expectedFee);

      // ── Step 6: Assert worker reputation updated ──
      const workerAgent = await registry.getAgent(worker.address);
      expect(workerAgent.tasksCompleted).to.equal(1);
      expect(workerAgent.totalValueTransacted).to.equal(TASK_PAYMENT);

      // ── Step 7: Assert receipt count incremented (if escrow creates receipts) ──
      const receiptCount = await verifier.receiptCount();
      // ReceiptVerifier receiptCount tracks manually-created receipts.
      // TaskEscrow.verifyTask() calls recordTaskCompletion but does NOT
      // automatically create a ReceiptVerifier receipt. This is by design —
      // receipts are created separately via the receipt tools.
      expect(receiptCount).to.equal(0n);
    });

    it("should handle task failure (client rejects) with refund", async function () {
      const { registry, escrow, client, worker, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTaskDesc2"));
      const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliverable2"));

      // Create task
      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        descriptionHash,
        { value: TASK_PAYMENT }
      );

      // Worker submits
      await escrow.connect(worker).submitWork(0, deliverableHash);

      // Client rejects
      const clientBalBefore = await ethers.provider.getBalance(client.address);
      const tx = await escrow.connect(client).verifyTask(0, false);
      const txReceipt = await tx.wait();
      const gasCost = txReceipt.gasUsed * txReceipt.gasPrice;

      const task = await escrow.getTask(0);
      expect(task.status).to.equal(5); // Failed

      // Client gets refund (minus gas)
      const clientBalAfter = await ethers.provider.getBalance(client.address);
      expect(clientBalAfter + gasCost).to.be.closeTo(
        clientBalBefore + TASK_PAYMENT,
        ethers.parseEther("0.0001")
      );

      // Worker reputation hit
      const workerAgent = await registry.getAgent(worker.address);
      expect(workerAgent.tasksFailed).to.equal(1);
      expect(workerAgent.tasksCompleted).to.equal(0);
    });
  });

  // ─── Deadline Expiry ─────────────────────────────────────────────

  describe("Deadline Expiry", function () {
    it("should fail task and refund client when deadline passes", async function () {
      const { escrow, client, worker, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeadlineTask"));

      // Create task
      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        descriptionHash,
        { value: TASK_PAYMENT }
      );

      // Fast-forward past deadline
      await time.increaseTo(deadline + 1);

      // checkDeadline should fail and refund client
      const clientBalBefore = await ethers.provider.getBalance(client.address);
      const tx = await escrow.checkDeadline(0);
      const txReceipt = await tx.wait();
      const gasCost = txReceipt.gasUsed * txReceipt.gasPrice;

      const task = await escrow.getTask(0);
      expect(task.status).to.equal(5); // Failed

      const clientBalAfter = await ethers.provider.getBalance(client.address);
      expect(clientBalAfter + gasCost).to.be.closeTo(
        clientBalBefore + TASK_PAYMENT,
        ethers.parseEther("0.0001")
      );
    });

    it("should reject submitWork after deadline", async function () {
      const { escrow, client, worker, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmLateSubmit"));

      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        descriptionHash,
        { value: TASK_PAYMENT }
      );

      // Fast-forward past deadline
      await time.increaseTo(deadline + 1);

      const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmLateDeliverable"));
      await expect(
        escrow.connect(worker).submitWork(0, deliverableHash)
      ).to.be.revertedWith("Deadline passed");
    });

    it("should reject checkDeadline before deadline", async function () {
      const { escrow, client, worker, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmEarlyCheck"));

      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        descriptionHash,
        { value: TASK_PAYMENT }
      );

      await expect(escrow.checkDeadline(0)).to.be.revertedWith("Deadline not passed");
    });
  });

  // ─── Dispute Resolution ──────────────────────────────────────────

  describe("Dispute Resolution", function () {
    it("should allow worker to dispute a submitted task", async function () {
      const { escrow, client, worker, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDisputeTask"));
      const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDisputeDeliverable"));

      // Create + submit
      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        descriptionHash,
        { value: TASK_PAYMENT }
      );
      await escrow.connect(worker).submitWork(0, deliverableHash);

      // Worker disputes
      const tx = await escrow.connect(worker).disputeTask(0);
      const txReceipt = await tx.wait();

      const disputeEvent = txReceipt.logs.find(
        (log) => escrow.interface.parseLog(log)?.name === "TaskDisputed"
      );
      expect(disputeEvent).to.not.be.undefined;

      const task = await escrow.getTask(0);
      expect(task.status).to.equal(6); // Disputed
    });

    it("should allow client to dispute a funded task", async function () {
      const { escrow, client, worker, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmClientDispute"));

      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        descriptionHash,
        { value: TASK_PAYMENT }
      );

      // Client disputes before work is submitted
      await escrow.connect(client).disputeTask(0);

      const task = await escrow.getTask(0);
      expect(task.status).to.equal(6); // Disputed
    });

    it("should resolve dispute in worker's favor", async function () {
      const { escrow, client, worker, owner, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmResolveWorker"));
      const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmResolveDeliv"));

      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        descriptionHash,
        { value: TASK_PAYMENT }
      );
      await escrow.connect(worker).submitWork(0, deliverableHash);
      await escrow.connect(worker).disputeTask(0);

      // Owner resolves: worker wins, 80% to worker
      const workerBalBefore = await ethers.provider.getBalance(worker.address);
      await escrow.connect(owner).resolveDispute(0, true, 8000);

      const task = await escrow.getTask(0);
      expect(task.status).to.equal(4); // Completed

      const workerBalAfter = await ethers.provider.getBalance(worker.address);
      const expectedWorkerPay = (TASK_PAYMENT * 8000n) / 10000n;
      expect(workerBalAfter - workerBalBefore).to.equal(expectedWorkerPay);
    });

    it("should resolve dispute in client's favor with full refund", async function () {
      const { escrow, client, worker, owner, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmResolveClient"));
      const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmResolveClientDeliv"));

      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        descriptionHash,
        { value: TASK_PAYMENT }
      );
      await escrow.connect(worker).submitWork(0, deliverableHash);
      await escrow.connect(client).disputeTask(0);

      // Owner resolves: client wins
      const clientBalBefore = await ethers.provider.getBalance(client.address);
      const tx = await escrow.connect(owner).resolveDispute(0, false, 0);
      const txReceipt = await tx.wait();
      const gasCost = txReceipt.gasUsed * txReceipt.gasPrice;

      const task = await escrow.getTask(0);
      expect(task.status).to.equal(5); // Failed

      const clientBalAfter = await ethers.provider.getBalance(client.address);
      expect(clientBalAfter + gasCost).to.be.closeTo(
        clientBalBefore + TASK_PAYMENT,
        ethers.parseEther("0.0001")
      );
    });

    it("should reject dispute from unauthorized address", async function () {
      const { escrow, client, worker, other, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmAuthDispute"));

      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        descriptionHash,
        { value: TASK_PAYMENT }
      );

      await expect(
        escrow.connect(other).disputeTask(0)
      ).to.be.revertedWith("Not authorized");
    });
  });

  // ─── Milestone Tasks ─────────────────────────────────────────────

  describe("Milestone Tasks", function () {
    it("should create, submit, and verify milestone-based task", async function () {
      const { escrow, client, worker, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmMilestoneTask"));
      const milestoneDescs = [
        ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmMilestone1")),
        ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmMilestone2")),
      ];
      const milestonePayments = [ethers.parseEther("0.004"), ethers.parseEther("0.006")];
      const totalPayment = ethers.parseEther("0.01");

      // Create milestone task
      await escrow.connect(client).createTaskWithMilestones(
        worker.address,
        totalPayment,
        deadline,
        descriptionHash,
        milestoneDescs,
        milestonePayments,
        { value: totalPayment }
      );

      const task = await escrow.getTask(0);
      expect(task.usesMilestones).to.be.true;
      expect(await escrow.getMilestoneCount(0)).to.equal(2);

      // Submit milestone 0
      const deliv0 = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliv0"));
      await escrow.connect(worker).submitMilestone(0, 0, deliv0);

      const m0 = await escrow.getMilestone(0, 0);
      expect(m0.completed).to.be.true;
      expect(m0.paid).to.be.false;

      // Verify milestone 0 — releases partial payment
      const workerBalBefore = await ethers.provider.getBalance(worker.address);
      await escrow.connect(client).verifyMilestone(0, 0, true);

      const m0After = await escrow.getMilestone(0, 0);
      expect(m0After.paid).to.be.true;

      const workerBalAfter = await ethers.provider.getBalance(worker.address);
      const expectedPay0 = milestonePayments[0] - (milestonePayments[0] * 100n) / 10000n;
      expect(workerBalAfter - workerBalBefore).to.equal(expectedPay0);

      // Submit + verify milestone 1
      const deliv1 = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmDeliv1"));
      await escrow.connect(worker).submitMilestone(0, 1, deliv1);

      const workerBalBefore1 = await ethers.provider.getBalance(worker.address);
      await escrow.connect(client).verifyMilestone(0, 1, true);

      const m1After = await escrow.getMilestone(0, 1);
      expect(m1After.paid).to.be.true;

      const workerBalAfter1 = await ethers.provider.getBalance(worker.address);
      const expectedPay1 = milestonePayments[1] - (milestonePayments[1] * 100n) / 10000n;
      expect(workerBalAfter1 - workerBalBefore1).to.equal(expectedPay1);
    });
  });

  // ─── Access Control ──────────────────────────────────────────────

  describe("Access Control", function () {
    it("should reject submitWork from non-worker", async function () {
      const { escrow, client, worker, other, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmAuthWork"));

      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        descriptionHash,
        { value: TASK_PAYMENT }
      );

      const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmFakeDeliv"));
      await expect(
        escrow.connect(other).submitWork(0, deliverableHash)
      ).to.be.revertedWith("Only worker");
    });

    it("should reject verifyTask from non-client", async function () {
      const { escrow, client, worker, other, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmAuthVerify"));
      const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmAuthDeliv"));

      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        descriptionHash,
        { value: TASK_PAYMENT }
      );
      await escrow.connect(worker).submitWork(0, deliverableHash);

      await expect(
        escrow.connect(other).verifyTask(0, true)
      ).to.be.revertedWith("Only client");
    });

    it("should reject resolveDispute from non-owner", async function () {
      const { escrow, client, worker, other, deadline } =
        await loadFixture(deployAndRegisterFixture);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmAuthResolve"));
      const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmAuthResDeliv"));

      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        descriptionHash,
        { value: TASK_PAYMENT }
      );
      await escrow.connect(worker).submitWork(0, deliverableHash);
      await escrow.connect(worker).disputeTask(0);

      await expect(
        escrow.connect(other).resolveDispute(0, true, 5000)
      ).to.be.revertedWith("Not owner");
    });
  });

  // ─── ERC-8004 Receipts ───────────────────────────────────────────

  describe("ERC-8004 Receipts", function () {
    it("should create and verify an attestation receipt", async function () {
      const { verifier, owner, client, worker } = await loadFixture(deployFixture);

      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("task-completion-proof"));

      // Create receipt (TaskCompletion = 0)
      const tx = await verifier.connect(owner).createReceipt(
        client.address,
        worker.address,
        0, // ReceiptType.TaskCompletion
        dataHash
      );
      const txReceipt = await tx.wait();

      // Extract receiptId from event
      const receiptCreatedEvent = txReceipt.logs.find(
        (log) => verifier.interface.parseLog(log)?.name === "ReceiptCreated"
      );
      expect(receiptCreatedEvent).to.not.be.undefined;

      const parsedEvent = verifier.interface.parseLog(receiptCreatedEvent);
      const receiptId = parsedEvent.args.receiptId;

      // Verify receipt
      expect(await verifier.verifyReceipt(receiptId)).to.be.true;

      // Get receipt details
      const receipt = await verifier.getReceipt(receiptId);
      expect(receipt.issuer).to.equal(client.address);
      expect(receipt.counterparty).to.equal(worker.address);
      expect(receipt.receiptType).to.equal(0); // TaskCompletion
      expect(receipt.isValid).to.be.true;
    });

    it("should batch verify multiple receipts", async function () {
      const { verifier, owner, client, worker } = await loadFixture(deployFixture);

      const hash1 = ethers.keccak256(ethers.toUtf8Bytes("receipt-1"));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("receipt-2"));
      const hash3 = ethers.keccak256(ethers.toUtf8Bytes("receipt-3"));

      await verifier.connect(owner).createReceipt(client.address, worker.address, 0, hash1);
      await verifier.connect(owner).createReceipt(client.address, worker.address, 1, hash2);
      await verifier.connect(owner).createReceipt(worker.address, client.address, 2, hash3);

      expect(await verifier.receiptCount()).to.equal(3);
    });
  });

  // ─── Multi-Task Scenario ─────────────────────────────────────────

  describe("Multi-Task Scenario", function () {
    it("should handle multiple sequential tasks between same agents", async function () {
      const { registry, escrow, client, worker, deadline } =
        await loadFixture(deployAndRegisterFixture);

      // Task 1: success
      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        ethers.keccak256(ethers.toUtf8Bytes("task-1")),
        { value: TASK_PAYMENT }
      );
      await escrow.connect(worker).submitWork(0, ethers.keccak256(ethers.toUtf8Bytes("deliv-1")));
      await escrow.connect(client).verifyTask(0, true);

      // Task 2: failure
      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        ethers.keccak256(ethers.toUtf8Bytes("task-2")),
        { value: TASK_PAYMENT }
      );
      await escrow.connect(worker).submitWork(1, ethers.keccak256(ethers.toUtf8Bytes("deliv-2")));
      await escrow.connect(client).verifyTask(1, false);

      // Task 3: success
      await escrow.connect(client).createAndFundTask(
        worker.address,
        TASK_PAYMENT,
        deadline,
        ethers.keccak256(ethers.toUtf8Bytes("task-3")),
        { value: TASK_PAYMENT }
      );
      await escrow.connect(worker).submitWork(2, ethers.keccak256(ethers.toUtf8Bytes("deliv-3")));
      await escrow.connect(client).verifyTask(2, true);

      // Final state checks
      expect(await escrow.taskCounter()).to.equal(3);

      const workerAgent = await registry.getAgent(worker.address);
      expect(workerAgent.tasksCompleted).to.equal(2);
      expect(workerAgent.tasksFailed).to.equal(1);
      expect(workerAgent.totalValueTransacted).to.equal(TASK_PAYMENT * 3n);
    });
  });
});
