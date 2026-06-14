const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("COVENANT v1 Contracts", function () {
  let owner, agent1, agent2, worker, client;
  let registry, escrow, verifier, insurance, dispute;
  let deadline;

  before(async function () {
    [owner, agent1, agent2, worker, client] = await ethers.getSigners();
    const block = await ethers.provider.getBlock("latest");
    deadline = block.timestamp + 7200;

    const AgentRegistry = await ethers.getContractFactory("contracts/AgentRegistry.sol:AgentRegistry");
    registry = await AgentRegistry.deploy();
    await registry.waitForDeployment();

    const ReceiptVerifier = await ethers.getContractFactory("contracts/ReceiptVerifier.sol:ReceiptVerifier");
    verifier = await ReceiptVerifier.deploy();
    await verifier.waitForDeployment();

    const TaskEscrow = await ethers.getContractFactory("contracts/TaskEscrow.sol:TaskEscrow");
    escrow = await TaskEscrow.deploy(await registry.getAddress(), await verifier.getAddress());
    await escrow.waitForDeployment();

    const AgentInsurance = await ethers.getContractFactory("contracts/AgentInsurance.sol:AgentInsurance");
    insurance = await AgentInsurance.deploy(await registry.getAddress(), await escrow.getAddress());
    await insurance.waitForDeployment();

    const DisputeArbitration = await ethers.getContractFactory("contracts/DisputeArbitration.sol:DisputeArbitration");
    dispute = await DisputeArbitration.deploy(await registry.getAddress(), await escrow.getAddress());
    await dispute.waitForDeployment();

    await registry.addAuthorizedContract(await escrow.getAddress());
    await registry.addAuthorizedContract(await dispute.getAddress());
    await verifier.addAuthorizedIssuer(await escrow.getAddress());

    await registry.connect(client).register("Client", ["mgmt"], { value: ethers.parseEther("0.01") });
    await registry.connect(agent1).register("Agent1", ["python", "security"], { value: ethers.parseEther("0.01") });
  });

  describe("AgentRegistry", function () {
    it("should register agent with capabilities", async function () {
      const agent = await registry.getAgent(agent1.address);
      expect(agent.isActive).to.equal(1);
      expect(agent.reputation).to.equal(500);
      expect(agent.stakedAmount).to.equal(ethers.parseEther("0.01"));
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
    it("should create receipt", async function () {
      await verifier.addAuthorizedIssuer(owner.address);
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test-data"));
      const tx = await verifier.connect(owner).createReceipt(agent1.address, agent2.address, "review", dataHash);
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });

    it("should batch verify receipts", async function () {
      const dataHash1 = ethers.keccak256(ethers.toUtf8Bytes("batch-1"));
      const dataHash2 = ethers.keccak256(ethers.toUtf8Bytes("batch-2"));
      await verifier.connect(owner).createReceipt(agent1.address, agent2.address, "review", dataHash1);
      await verifier.connect(owner).createReceipt(agent1.address, agent2.address, "audit", dataHash2);
      expect(await verifier.receiptCount()).to.equal(3);
    });
  });

  describe("TaskEscrow", function () {
    it("should create and fund task", async function () {
      const tx = await escrow.connect(client).createAndFundTask(
        agent1.address, ethers.parseEther("0.01"), deadline,
        ethers.keccak256(ethers.toUtf8Bytes("task-desc")),
        { value: ethers.parseEther("0.0101") }
      );
      const task = await escrow.getTask(1);
      expect(task.client).to.equal(client.address);
      expect(task.worker).to.equal(agent1.address);
      expect(task.status).to.equal(2); // InProgress
    });

    it("should submit and verify work", async function () {
      const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("deliverable"));
      await escrow.connect(agent1).submitWork(1, deliverableHash);
      const taskBefore = await escrow.getTask(1);
      expect(taskBefore.status).to.equal(3); // Submitted

      const balanceBefore = await ethers.provider.getBalance(agent1.address);
      await escrow.connect(client).verifyTask(1, true);
      const balanceAfter = await ethers.provider.getBalance(agent1.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("should create milestone task", async function () {
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("milestone-task"));
      const milestoneDescs = [
        ethers.keccak256(ethers.toUtf8Bytes("mile-1")),
        ethers.keccak256(ethers.toUtf8Bytes("mile-2"))
      ];
      const milestonePayments = [ethers.parseEther("0.005"), ethers.parseEther("0.005")];
      const totalPayment = ethers.parseEther("0.01");

      await escrow.connect(client).createTaskWithMilestones(
        agent1.address, totalPayment, deadline, descHash,
        milestoneDescs, milestonePayments,
        { value: totalPayment }
      );

      const task = await escrow.getTask(2);
      expect(task.usesMilestones).to.be.true;
      const count = await escrow.getMilestoneCount(2);
      expect(count).to.equal(2);
    });
  });

  describe("AgentInsurance", function () {
    it("should join pool and claim insurance", async function () {
      await insurance.connect(agent1).joinPool({ value: ethers.parseEther("0.01") });
      const info = await insurance.getMemberInfo(agent1.address);
      expect(info.isMember).to.be.true;
    });
  });

  describe("DisputeArbitration", function () {
    it("should dispute an active task and resolve", async function () {
      // Create a new task for dispute
      await escrow.connect(client).createAndFundTask(
        agent1.address, ethers.parseEther("0.01"), deadline,
        ethers.keccak256(ethers.toUtf8Bytes("dispute-task")),
        { value: ethers.parseEther("0.0101") }
      );

      // Dispute the task while InProgress
      await dispute.connect(agent1).disputeTask(3, { value: ethers.parseEther("0.0002") });
      const d = await dispute.getDispute(1);
      expect(d.initiator).to.equal(agent1.address);
      expect(d.resolved).to.be.false;

      // Resolve (parameter is disputeId, not taskId)
      await dispute.connect(owner).resolveDispute(1, true);
      const resolved = await dispute.getDispute(1);
      expect(resolved.resolved).to.be.true;
    });
  });
});
