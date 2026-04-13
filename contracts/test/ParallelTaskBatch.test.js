import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("ParallelTaskBatch", function () {
  let registry, escrow, verifier, batch, owner, client, worker1, worker2, worker3;
  const MIN_STAKE = ethers.parseEther("0.001");
  const DESC_HASH_1 = ethers.encodeBytes32String("QmSubtask1");
  const DESC_HASH_2 = ethers.encodeBytes32String("QmSubtask2");
  const AGG_SPEC = ethers.encodeBytes32String("QmAggregationSpec");

  async function deployFixture() {
    const [owner, client, worker1, worker2, worker3] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("AgentRegistry");
    const registry = await Registry.deploy();

    const Verifier = await ethers.getContractFactory("ReceiptVerifier");
    const verifier = await Verifier.deploy();

    await owner.sendTransaction({ to: client.address, value: ethers.parseEther("10") });
    await owner.sendTransaction({ to: worker1.address, value: ethers.parseEther("5") });
    await owner.sendTransaction({ to: worker2.address, value: ethers.parseEther("5") });
    await owner.sendTransaction({ to: worker3.address, value: ethers.parseEther("5") });

    await registry.connect(client).register("Client", ["hiring"], { value: MIN_STAKE });
    await registry.connect(worker1).register("Worker1", ["ml"], { value: MIN_STAKE });
    await registry.connect(worker2).register("Worker2", ["ml"], { value: MIN_STAKE });
    await registry.connect(worker3).register("Worker3", ["ml"], { value: MIN_STAKE });

    const Escrow = await ethers.getContractFactory("TaskEscrow");
    const escrow = await Escrow.deploy(await registry.getAddress(), await verifier.getAddress());
    await registry.addAuthorizedContract(await escrow.getAddress());
    await verifier.addAuthorizedIssuer(await escrow.getAddress());

    const Batch = await ethers.getContractFactory("ParallelTaskBatch");
    const batch = await Batch.deploy(await escrow.getAddress(), await registry.getAddress());

    return { registry, escrow, verifier, batch, owner, client, worker1, worker2, worker3 };
  }

  describe("Create Batch", function () {
    it("should create a batch successfully", async function () {
      const { batch, client, worker1, worker2 } = await loadFixture(deployFixture);

      const workers = [worker1.address, worker2.address];
      const payments = [ethers.parseEther("0.1"), ethers.parseEther("0.15")];
      const deadlines = [(await time.latest()) + 86400, (await time.latest()) + 86400];
      const descHashes = [DESC_HASH_1, DESC_HASH_2];
      const totalBudget = payments[0] + payments[1];
      // Priority fees calculated per-task in the contract: fee = (payment * 100) / 10000
      const totalWithFees = (payments[0] + (payments[0] * 100n) / 10000n) +
                            (payments[1] + (payments[1] * 100n) / 10000n);

      await expect(
        batch.connect(client).createBatch(workers, payments, deadlines, descHashes, AGG_SPEC, {
          value: totalWithFees,
        })
      )
        .to.emit(batch, "BatchCreated")
        .and.emit(batch, "BatchCreated");

      const details = await batch.getBatchDetails(1);
      expect(details.client).to.equal(client.address);
      expect(details.totalBudget).to.equal(totalBudget);
      expect(details.taskIds.length).to.equal(2);
      expect(details.status).to.equal(1); // InProgress
    });

    it("should reject zero-length batch", async function () {
      const { batch, client } = await loadFixture(deployFixture);
      await expect(
        batch.connect(client).createBatch([], [], [], [], AGG_SPEC, { value: 0 })
      ).to.be.revertedWithCustomError(batch, "ZeroPayment");
    });

    it("should reject batch exceeding limit", async function () {
      const { batch, client, worker1 } = await loadFixture(deployFixture);
      const workers = new Array(51).fill(worker1.address);
      const payments = new Array(51).fill(ethers.parseEther("0.01"));
      const deadlines = new Array(51).fill((await time.latest()) + 86400);
      const descHashes = new Array(51).fill(DESC_HASH_1);
      const total = payments.reduce((a, b) => a + b, 0n);

      await expect(
        batch.connect(client).createBatch(workers, payments, deadlines, descHashes, AGG_SPEC, {
          value: total,
        })
      ).to.be.revertedWithCustomError(batch, "BatchLimitExceeded");
    });

    it("should reject length mismatch", async function () {
      const { batch, client, worker1, worker2 } = await loadFixture(deployFixture);
      const workers = [worker1.address, worker2.address];
      const payments = [ethers.parseEther("0.1")]; // Mismatched length
      const deadlines = [(await time.latest()) + 86400, (await time.latest()) + 86400];
      const descHashes = [DESC_HASH_1, DESC_HASH_2];

      await expect(
        batch.connect(client).createBatch(workers, payments, deadlines, descHashes, AGG_SPEC, {
          value: payments[0],
        })
      ).to.be.revertedWithCustomError(batch, "BatchLengthMismatch");
    });

    it("should reject empty aggregation spec", async function () {
      const { batch, client, worker1 } = await loadFixture(deployFixture);
      const workers = [worker1.address];
      const payments = [ethers.parseEther("0.1")];
      const deadlines = [(await time.latest()) + 86400];
      const descHashes = [DESC_HASH_1];

      await expect(
        batch.connect(client).createBatch(workers, payments, deadlines, descHashes, ethers.ZeroHash, {
          value: payments[0],
        })
      ).to.be.revertedWithCustomError(batch, "EmptyDescriptionHash");
    });

    it("should reject insufficient funding", async function () {
      const { batch, client, worker1 } = await loadFixture(deployFixture);
      const workers = [worker1.address];
      const payments = [ethers.parseEther("0.5")];
      const deadlines = [(await time.latest()) + 86400];
      const descHashes = [DESC_HASH_1];

      await expect(
        batch.connect(client).createBatch(workers, payments, deadlines, descHashes, AGG_SPEC, {
          value: ethers.parseEther("0.1"), // too little
        })
      ).to.be.revertedWithCustomError(batch, "InsufficientFunding");
    });
  });

  describe("Batch Status", function () {
    it("should return correct batch status", async function () {
      const { batch, client, worker1, worker2 } = await loadFixture(deployFixture);

      const workers = [worker1.address, worker2.address];
      const payments = [ethers.parseEther("0.1"), ethers.parseEther("0.1")];
      const deadlines = [(await time.latest()) + 86400, (await time.latest()) + 86400];
      const descHashes = [DESC_HASH_1, DESC_HASH_2];
      const totalWithFees = (payments[0] + (payments[0] * 100n) / 10000n) +
                            (payments[1] + (payments[1] * 100n) / 10000n);

      await batch.connect(client).createBatch(workers, payments, deadlines, descHashes, AGG_SPEC, {
        value: totalWithFees,
      });

      const status = await batch.getBatchStatus(1);
      expect(status).to.equal(1); // InProgress
    });

    it("should reject checking non-existent batch", async function () {
      const { batch } = await loadFixture(deployFixture);
      await expect(batch.getBatchStatus(999)).to.be.reverted;
    });
  });

  describe("Aggregate Results", function () {
    let fixture;

    beforeEach(async function () {
      fixture = await loadFixture(deployFixture);
      const workers = [fixture.worker1.address, fixture.worker2.address];
      const payments = [ethers.parseEther("0.1"), ethers.parseEther("0.1")];
      const deadlines = [(await time.latest()) + 86400, (await time.latest()) + 86400];
      const descHashes = [DESC_HASH_1, DESC_HASH_2];
      const totalWithFees = (payments[0] + (payments[0] * 100n) / 10000n) +
                            (payments[1] + (payments[1] * 100n) / 10000n);

      await fixture.batch.connect(fixture.client).createBatch(
        workers, payments, deadlines, descHashes, AGG_SPEC, { value: totalWithFees }
      );
    });

    it("should complete aggregation", async function () {
      const { batch, client } = fixture;
      // Note: In a real scenario, subtasks would be submitted first.
      // The contract currently simulates aggregation.
      await expect(batch.connect(client).aggregateResults(1))
        .to.emit(batch, "ResultsAggregated");

      const result = await batch.getAggregatedResult(1);
      expect(result).to.not.equal(ethers.ZeroHash);
    });

    it("should reject aggregation for non-existent batch", async function () {
      const { batch, client } = fixture;
      await expect(batch.connect(client).aggregateResults(999))
        .to.be.reverted;
    });
  });

  describe("Get Batch Details", function () {
    it("should return full batch details", async function () {
      const { batch, client, worker1 } = await loadFixture(deployFixture);
      const payment = ethers.parseEther("0.1");
      const fee = (payment * 100n) / 10000n;
      await batch.connect(client).createBatch(
        [worker1.address],
        [payment],
        [(await time.latest()) + 86400],
        [DESC_HASH_1],
        AGG_SPEC,
        { value: payment + fee }
      );

      const details = await batch.getBatchDetails(1);
      expect(details.client).to.equal(client.address);
      expect(details.aggregationSpec).to.equal(AGG_SPEC);
      expect(details.taskIds.length).to.equal(1);
    });
  });
});
