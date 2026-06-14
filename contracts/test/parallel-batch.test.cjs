const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ParallelTaskBatch", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const PAYMENT_PER_TASK = ethers.parseEther("0.01");
  const FEE_PER_TASK = PAYMENT_PER_TASK * 100n / 10000n;
  const TOTAL_PER_TASK = PAYMENT_PER_TASK + FEE_PER_TASK;

  async function deployFixture() {
    const [owner, client, worker1, worker2, worker3, other] = await ethers.getSigners();
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

    const ParallelTaskBatch = await ethers.getContractFactory("contracts/ParallelTaskBatch.sol:ParallelTaskBatch");
    const batch = await ParallelTaskBatch.deploy(
      await escrow.getAddress(),
      await registry.getAddress()
    );
    await batch.waitForDeployment();

    await registry.addAuthorizedContract(await escrow.getAddress());
    await verifier.addAuthorizedIssuer(await escrow.getAddress());

    return { registry, verifier, escrow, batch, owner, client, worker1, worker2, worker3, other, deadline };
  }

  async function registeredFixture() {
    const base = await deployFixture();
    const { registry, client, worker1, worker2, worker3 } = base;

    await registry.connect(client).register("Client", ["management"], { value: MIN_STAKE });
    await registry.connect(worker1).register("Worker1", ["code-review"], { value: ethers.parseEther("0.01") });
    await registry.connect(worker2).register("Worker2", ["testing"], { value: ethers.parseEther("0.01") });
    await registry.connect(worker3).register("Worker3", ["deploy"], { value: ethers.parseEther("0.01") });

    return base;
  }

  function makeDesc(i) {
    return ethers.keccak256(ethers.toUtf8Bytes("desc-" + i));
  }

  describe("Deployment", function () {
    it("should deploy with correct contract references", async function () {
      const { batch, escrow, registry } = await loadFixture(deployFixture);
      expect(await batch.taskEscrow()).to.equal(await escrow.getAddress());
      expect(await batch.agentRegistry()).to.equal(await registry.getAddress());
    });

    it("should start with zero batches", async function () {
      const { batch } = await loadFixture(deployFixture);
      expect(await batch.batchCounter()).to.equal(0);
    });
  });

  describe("createBatch", function () {
    it("should create a batch with multiple workers", async function () {
      const { batch, client, worker1, worker2, deadline } = await loadFixture(registeredFixture);
      const aggSpec = ethers.keccak256(ethers.toUtf8Bytes("aggregation-v1"));

      const workers = [worker1.address, worker2.address];
      const payments = [PAYMENT_PER_TASK, PAYMENT_PER_TASK];
      const deadlines = [deadline, deadline];
      const descHashes = [makeDesc(0), makeDesc(1)];
      const totalValue = TOTAL_PER_TASK * 2n;

      const tx = await batch.connect(client).createBatch(
        workers, payments, deadlines, descHashes, aggSpec,
        { value: totalValue }
      );

      await expect(tx).to.emit(batch, "BatchCreated");
      expect(await batch.batchCounter()).to.equal(1);

      const details = await batch.getBatchDetails(1);
      expect(details.client).to.equal(client.address);
      expect(details.totalBudget).to.equal(PAYMENT_PER_TASK * 2n);
      expect(details.aggregationSpec).to.equal(aggSpec);
      expect(details.status).to.equal(1); // InProgress
      expect(details.taskIds.length).to.equal(2);
    });

    it("should create individual tasks in the escrow", async function () {
      const { batch, escrow, client, worker1, worker2, deadline } = await loadFixture(registeredFixture);

      await batch.connect(client).createBatch(
        [worker1.address, worker2.address],
        [PAYMENT_PER_TASK, PAYMENT_PER_TASK],
        [deadline, deadline],
        [makeDesc(0), makeDesc(1)],
        ethers.keccak256(ethers.toUtf8Bytes("agg")),
        { value: TOTAL_PER_TASK * 2n }
      );

      // First task in escrow
      const task1 = await escrow.getTask(1);
      expect(task1.worker).to.equal(worker1.address);
      expect(task1.payment).to.equal(PAYMENT_PER_TASK);
      expect(task1.status).to.equal(2); // InProgress

      // Second task
      const task2 = await escrow.getTask(2);
      expect(task2.worker).to.equal(worker2.address);
      expect(task2.payment).to.equal(PAYMENT_PER_TASK);
      expect(task2.status).to.equal(2); // InProgress
    });

    it("should use address(this) as client for escrow tasks", async function () {
      const { batch, escrow, client, worker1, worker2, deadline } = await loadFixture(registeredFixture);

      await batch.connect(client).createBatch(
        [worker1.address, worker2.address],
        [PAYMENT_PER_TASK, PAYMENT_PER_TASK],
        [deadline, deadline],
        [makeDesc(0), makeDesc(1)],
        ethers.keccak256(ethers.toUtf8Bytes("agg")),
        { value: TOTAL_PER_TASK * 2n }
      );

      const task1 = await escrow.getTask(1);
      expect(task1.client).to.equal(await batch.getAddress());
    });

    it("should return task IDs via getTaskIds", async function () {
      const { batch, client, worker1, worker2, deadline } = await loadFixture(registeredFixture);

      await batch.connect(client).createBatch(
        [worker1.address, worker2.address],
        [PAYMENT_PER_TASK, PAYMENT_PER_TASK],
        [deadline, deadline],
        [makeDesc(0), makeDesc(1)],
        ethers.keccak256(ethers.toUtf8Bytes("agg")),
        { value: TOTAL_PER_TASK * 2n }
      );

      const taskIds = await batch.getTaskIds(1);
      expect(taskIds.length).to.equal(2);
      expect(taskIds[0]).to.equal(1);
      expect(taskIds[1]).to.equal(2);
    });
  });

  describe("Payment Validation", function () {
    it("should calculate total correctly with fees", async function () {
      const { batch, client, worker1, worker2, deadline } = await loadFixture(registeredFixture);

      // payment * 3 workers + fees
      const count = 3n;
      const expectedTotal = TOTAL_PER_TASK * count;

      await expect(
        batch.connect(client).createBatch(
          [worker1.address, worker2.address, worker1.address],
          [PAYMENT_PER_TASK, PAYMENT_PER_TASK, PAYMENT_PER_TASK],
          [deadline, deadline, deadline],
          [makeDesc(0), makeDesc(1), makeDesc(2)],
          ethers.keccak256(ethers.toUtf8Bytes("agg")),
          { value: expectedTotal }
        )
      ).to.not.be.reverted;
    });

    it("should reject insufficient payment", async function () {
      const { batch, client, worker1, worker2, deadline } = await loadFixture(registeredFixture);

      await expect(
        batch.connect(client).createBatch(
          [worker1.address, worker2.address],
          [PAYMENT_PER_TASK, PAYMENT_PER_TASK],
          [deadline, deadline],
          [makeDesc(0), makeDesc(1)],
          ethers.keccak256(ethers.toUtf8Bytes("agg")),
          { value: TOTAL_PER_TASK * 2n - 1n }
        )
      ).to.be.revertedWithCustomError(batch, "InsufficientFunding");
    });
  });

  describe("Batch Size Limits", function () {
    it("should reject empty batch", async function () {
      const { batch, client } = await loadFixture(registeredFixture);
      await expect(
        batch.connect(client).createBatch(
          [], [], [], [],
          ethers.keccak256(ethers.toUtf8Bytes("agg")),
          { value: 0 }
        )
      ).to.be.revertedWithCustomError(batch, "ZeroPayment");
    });

    it("should reject batch exceeding max size of 50", async function () {
      const { batch, client, worker1, deadline } = await loadFixture(registeredFixture);
      const bigWorkers = new Array(51).fill(worker1.address);
      const bigPayments = new Array(51).fill(PAYMENT_PER_TASK);
      const bigDeadlines = new Array(51).fill(deadline);
      const bigHashes = new Array(51).fill(makeDesc(0));

      await expect(
        batch.connect(client).createBatch(
          bigWorkers, bigPayments, bigDeadlines, bigHashes,
          ethers.keccak256(ethers.toUtf8Bytes("agg")),
          { value: TOTAL_PER_TASK * 51n }
        )
      ).to.be.revertedWithCustomError(batch, "BatchLimitExceeded");
    });

    it("should allow batch of exactly 50", async function () {
      const { batch, client, worker1, deadline } = await loadFixture(registeredFixture);
      const workers = new Array(50).fill(worker1.address);
      const payments = new Array(50).fill(PAYMENT_PER_TASK);
      const deadlines = new Array(50).fill(deadline);
      const hashes = new Array(50).fill(makeDesc(0));

      const tx = batch.connect(client).createBatch(
        workers, payments, deadlines, hashes,
        ethers.keccak256(ethers.toUtf8Bytes("agg")),
        { value: TOTAL_PER_TASK * 50n }
      );
      await expect(tx).to.emit(batch, "BatchCreated");
    });
  });

  describe("Validation - Array Mismatch", function () {
    it("should reject mismatched workers and payments", async function () {
      const { batch, client, worker1, worker2, deadline } = await loadFixture(registeredFixture);

      await expect(
        batch.connect(client).createBatch(
          [worker1.address, worker2.address],
          [PAYMENT_PER_TASK],
          [deadline, deadline],
          [makeDesc(0), makeDesc(1)],
          ethers.keccak256(ethers.toUtf8Bytes("agg")),
          { value: TOTAL_PER_TASK * 2n }
        )
      ).to.be.revertedWithCustomError(batch, "BatchLengthMismatch");
    });

    it("should reject mismatched workers and deadlines", async function () {
      const { batch, client, worker1, worker2, deadline } = await loadFixture(registeredFixture);

      await expect(
        batch.connect(client).createBatch(
          [worker1.address, worker2.address],
          [PAYMENT_PER_TASK, PAYMENT_PER_TASK],
          [deadline],
          [makeDesc(0), makeDesc(1)],
          ethers.keccak256(ethers.toUtf8Bytes("agg")),
          { value: TOTAL_PER_TASK * 2n }
        )
      ).to.be.revertedWithCustomError(batch, "BatchLengthMismatch");
    });

    it("should reject mismatched workers and descHashes", async function () {
      const { batch, client, worker1, worker2, deadline } = await loadFixture(registeredFixture);

      await expect(
        batch.connect(client).createBatch(
          [worker1.address, worker2.address],
          [PAYMENT_PER_TASK, PAYMENT_PER_TASK],
          [deadline, deadline],
          [makeDesc(0)],
          ethers.keccak256(ethers.toUtf8Bytes("agg")),
          { value: TOTAL_PER_TASK * 2n }
        )
      ).to.be.revertedWithCustomError(batch, "BatchLengthMismatch");
    });
  });

  describe("Agent Validation", function () {
    it("should reject unregistered client", async function () {
      const { batch, other, worker1, deadline } = await loadFixture(deployFixture);

      await expect(
        batch.connect(other).createBatch(
          [worker1.address],
          [PAYMENT_PER_TASK],
          [deadline],
          [makeDesc(0)],
          ethers.keccak256(ethers.toUtf8Bytes("agg")),
          { value: TOTAL_PER_TASK }
        )
      ).to.be.revertedWithCustomError(batch, "AgentNotActive");
    });

    it("should reject unregistered worker", async function () {
      const { batch, registry, client, other, deadline } = await loadFixture(deployFixture);
      await registry.connect(client).register("Client", ["mgmt"], { value: MIN_STAKE });

      await expect(
        batch.connect(client).createBatch(
          [other.address],
          [PAYMENT_PER_TASK],
          [deadline],
          [makeDesc(0)],
          ethers.keccak256(ethers.toUtf8Bytes("agg")),
          { value: TOTAL_PER_TASK }
        )
      ).to.be.revertedWithCustomError(batch, "AgentNotActive");
    });
  });

  describe("Aggregation Spec", function () {
    it("should reject zero aggregation spec", async function () {
      const { batch, client, worker1, deadline } = await loadFixture(registeredFixture);

      await expect(
        batch.connect(client).createBatch(
          [worker1.address],
          [PAYMENT_PER_TASK],
          [deadline],
          [makeDesc(0)],
          ethers.ZeroHash,
          { value: TOTAL_PER_TASK }
        )
      ).to.be.revertedWithCustomError(batch, "EmptyDescriptionHash");
    });
  });

  describe("Batch Queries", function () {
    it("should return batch status", async function () {
      const { batch, client, worker1, worker2, deadline } = await loadFixture(registeredFixture);

      await batch.connect(client).createBatch(
        [worker1.address, worker2.address],
        [PAYMENT_PER_TASK, PAYMENT_PER_TASK],
        [deadline, deadline],
        [makeDesc(0), makeDesc(1)],
        ethers.keccak256(ethers.toUtf8Bytes("agg")),
        { value: TOTAL_PER_TASK * 2n }
      );

      expect(await batch.getBatchStatus(1)).to.equal(1); // InProgress
    });

    it("should reject getBatchStatus for non-existent batch", async function () {
      const { batch } = await loadFixture(deployFixture);
      await expect(batch.getBatchStatus(0)).to.be.revertedWithCustomError(batch, "InvalidTaskId");
      await expect(batch.getBatchStatus(1)).to.be.revertedWithCustomError(batch, "InvalidTaskId");
    });

    it("should reject getTaskIds for non-existent batch", async function () {
      const { batch } = await loadFixture(deployFixture);
      await expect(batch.getTaskIds(1)).to.be.revertedWithCustomError(batch, "InvalidTaskId");
    });

    it("should reject getBatchDetails for non-existent batch", async function () {
      const { batch } = await loadFixture(deployFixture);
      await expect(batch.getBatchDetails(1)).to.be.revertedWithCustomError(batch, "InvalidTaskId");
    });
  });
});
