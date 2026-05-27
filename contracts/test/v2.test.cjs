const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("COVENANT v2 Contracts", function () {
  let owner, agent1, agent2, worker, client;
  let registry, escrow, verifier, insurance, dispute;
  let deadline;

  before(async function () {
    [owner, agent1, agent2, worker, client] = await ethers.getSigners();

    // Get current block timestamp and set deadline 2 hours in the future
    const block = await ethers.provider.getBlock("latest");
    deadline = block.timestamp + 7200;

    const mockVerifier = "0x0000000000000000000000000000000000000001";

    // Deploy AgentRegistry (v2)
    const AgentRegistry = await ethers.getContractFactory("contracts/v2/core/AgentRegistry.sol:AgentRegistry");
    registry = await AgentRegistry.deploy(mockVerifier, mockVerifier);
    await registry.waitForDeployment();

    // Deploy ReceiptVerifier (v2)
    const ReceiptVerifier = await ethers.getContractFactory("contracts/v2/core/ReceiptVerifier.sol:ReceiptVerifier");
    verifier = await ReceiptVerifier.deploy();
    await verifier.waitForDeployment();

    // Deploy TaskEscrow (v2)
    const TaskEscrow = await ethers.getContractFactory("contracts/v2/core/TaskEscrow.sol:TaskEscrow");
    escrow = await TaskEscrow.deploy(
      await registry.getAddress(),
      await verifier.getAddress(),
      owner.address
    );
    await escrow.waitForDeployment();

    // Deploy InsurancePool (v2)
    const InsurancePool = await ethers.getContractFactory("InsurancePool");
    insurance = await InsurancePool.deploy();
    await insurance.waitForDeployment();

    // Deploy DisputeResolution (v2)
    const DisputeResolution = await ethers.getContractFactory("DisputeResolution");
    dispute = await DisputeResolution.deploy();
    await dispute.waitForDeployment();

    // Authorize escrow on registry
    await registry.addAuthorizedContract(await escrow.getAddress());
  });

  describe("AgentRegistry", function () {
    it("should register agent with capabilities", async function () {
      await registry.connect(agent1).register("Agent1", ["python", "security"], {
        value: ethers.parseEther("0.01")
      });
      const agent = await registry.getAgent(agent1.address);
      expect(agent.isActive).to.equal(1);
      expect(agent.reputation).to.equal(500);
      expect(agent.stakedAmount).to.equal(ethers.parseEther("0.01"));
    });

    it("should track capability hashes", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("python"));
      expect(await registry.hasCapability(agent1.address, capHash)).to.be.true;
    });

    it("should add stake", async function () {
      await registry.connect(agent1).addStake({ value: ethers.parseEther("0.005") });
      const agent = await registry.getAgent(agent1.address);
      expect(agent.stakedAmount).to.equal(ethers.parseEther("0.015"));
    });

    it("should record task completion", async function () {
      await registry.recordTaskCompletion(agent1.address, true, ethers.parseEther("0.001"));
      const agent = await registry.getAgent(agent1.address);
      expect(agent.tasksCompleted).to.equal(1);
    });

    it("should deactivate agent", async function () {
      await registry.connect(agent2).register("Agent2", ["data"], {
        value: ethers.parseEther("0.01")
      });
      await registry.connect(agent2).deactivate();
      const agent = await registry.getAgent(agent2.address);
      expect(agent.isActive).to.equal(0);
    });
  });

  describe("ReceiptVerifier", function () {
    it("should create receipt with enum type", async function () {
      await verifier.addAuthorizedIssuer(owner.address);
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test-data"));
      const tx = await verifier.createReceipt(
        agent1.address, agent2.address, 0, dataHash
      );
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });

    it("should batch verify receipts", async function () {
      const dataHash1 = ethers.keccak256(ethers.toUtf8Bytes("batch-1"));
      const dataHash2 = ethers.keccak256(ethers.toUtf8Bytes("batch-2"));
      await verifier.createReceipt(agent1.address, agent2.address, 0, dataHash1);
      await verifier.createReceipt(agent1.address, agent2.address, 1, dataHash2);

      const count = await verifier.receiptCount();
      expect(count).to.equal(3); // 1 from previous test + 2 here
    });
  });

  describe("TaskEscrow", function () {
    it("should create and fund task", async function () {
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("task-desc"));
      const tx = await escrow.connect(client).createAndFundTask(
        agent1.address, ethers.parseEther("0.01"), deadline, descHash,
        { value: ethers.parseEther("0.01") }
      );
      await tx.wait();
      const task = await escrow.getTask(0);
      expect(task.client).to.equal(client.address);
      expect(task.worker).to.equal(agent1.address);
      expect(task.status).to.equal(1); // Funded
    });

    it("should submit and verify work", async function () {
      const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("deliverable"));
      await escrow.connect(agent1).submitWork(0, deliverableHash);
      const taskBefore = await escrow.getTask(0);
      expect(taskBefore.status).to.equal(3); // Submitted

      const balanceBefore = await ethers.provider.getBalance(agent1.address);
      await escrow.connect(client).verifyTask(0, true);
      const balanceAfter = await ethers.provider.getBalance(agent1.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("should handle dispute and resolution", async function () {
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("task-dispute"));
      await escrow.connect(client).createAndFundTask(
        agent1.address, ethers.parseEther("0.01"), deadline, descHash,
        { value: ethers.parseEther("0.01") }
      );

      const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("deliverable-2"));
      await escrow.connect(agent1).submitWork(1, deliverableHash);
      await escrow.connect(agent1).disputeTask(1);
      const disputed = await escrow.getTask(1);
      expect(disputed.status).to.equal(6); // Disputed

      await escrow.connect(owner).resolveDispute(1, true, 8000);
      const resolved = await escrow.getTask(1);
      expect(resolved.status).to.equal(4); // Completed
    });

    it("should create milestone task", async function () {
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("milestone-task"));
      const milestoneDescs = [
        ethers.keccak256(ethers.toUtf8Bytes("mile-1")),
        ethers.keccak256(ethers.toUtf8Bytes("mile-2"))
      ];
      const milestonePayments = [ethers.parseEther("0.005"), ethers.parseEther("0.005")];

      await escrow.connect(client).createTaskWithMilestones(
        agent1.address, ethers.parseEther("0.01"), deadline, descHash,
        milestoneDescs, milestonePayments,
        { value: ethers.parseEther("0.01") }
      );

      const task = await escrow.getTask(2);
      expect(task.usesMilestones).to.be.true;
      const count = await escrow.getMilestoneCount(2);
      expect(count).to.equal(2);
    });
  });

  describe("InsurancePool", function () {
    it("should join pool and file claim", async function () {
      await insurance.connect(agent1).joinPool({ value: ethers.parseEther("0.01") });
      expect(await insurance.isMember(agent1.address)).to.be.true;

      await insurance.connect(agent1).fileClaim(0, ethers.parseEther("0.005"));
      const claim = await insurance.getClaim(0);
      expect(claim.claimant).to.equal(agent1.address);
    });

    it("should pay claim", async function () {
      const balanceBefore = await ethers.provider.getBalance(agent1.address);
      await insurance.connect(owner).payClaim(0, "0x");
      const balanceAfter = await ethers.provider.getBalance(agent1.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  describe("DisputeResolution", function () {
    it("should file and resolve dispute", async function () {
      await dispute.connect(agent1).fileDispute(0, { value: ethers.parseEther("0.001") });
      const d = await dispute.getDispute(0);
      expect(d.filedBy).to.equal(agent1.address);
      expect(d.resolved).to.be.false;

      await dispute.connect(owner).resolveDispute(0, true, 8000);
      const resolved = await dispute.getDispute(0);
      expect(resolved.resolved).to.be.true;
      expect(resolved.workerWins).to.be.true;
    });
  });
});
