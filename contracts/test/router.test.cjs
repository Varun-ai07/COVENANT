const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("COVENANTRouter", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const PAYMENT = ethers.parseEther("0.01");
  const PRIORITY_FEE = PAYMENT * 100n / 10000n;
  const TOTAL = PAYMENT + PRIORITY_FEE;

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

    const COVENANTRouter = await ethers.getContractFactory("contracts/COVENANTRouter.sol:COVENANTRouter");
    const router = await COVENANTRouter.deploy(
      await registry.getAddress(),
      await escrow.getAddress(),
      await verifier.getAddress()
    );
    await router.waitForDeployment();

    await registry.addAuthorizedContract(await escrow.getAddress());
    await verifier.addAuthorizedIssuer(await escrow.getAddress());

    return { registry, verifier, escrow, router, owner, client, worker, other, deadline };
  }

  async function workerRegisteredFixture() {
    const base = await deployFixture();
    const { registry, worker } = base;
    await registry.connect(worker).register("Worker", ["code-review"], { value: ethers.parseEther("0.01") });
    return base;
  }

  describe("Deployment", function () {
    it("should deploy with correct contract references", async function () {
      const { router, registry, escrow, verifier } = await loadFixture(deployFixture);
      expect(await router.agentRegistry()).to.equal(await registry.getAddress());
      expect(await router.escrow()).to.equal(await escrow.getAddress());
      expect(await router.receiptVerifier()).to.equal(await verifier.getAddress());
    });

    it("should reject deployment with zero addresses", async function () {
      const { registry, escrow, verifier } = await loadFixture(deployFixture);
      const Router = await ethers.getContractFactory("contracts/COVENANTRouter.sol:COVENANTRouter");

      await expect(
        Router.deploy(ethers.ZeroAddress, await escrow.getAddress(), await verifier.getAddress())
      ).to.be.revertedWithCustomError(Router, "ZeroAddress");

      await expect(
        Router.deploy(await registry.getAddress(), ethers.ZeroAddress, await verifier.getAddress())
      ).to.be.revertedWithCustomError(Router, "ZeroAddress");

      await expect(
        Router.deploy(await registry.getAddress(), await escrow.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(Router, "ZeroAddress");
    });
  });

  describe("registerAndCreateTask", function () {
    it("should reject because the router cannot preserve the caller as msg.sender", async function () {
      const { router, registry, escrow, client, worker, deadline } = await loadFixture(workerRegisteredFixture);

      const taskPayment = ethers.parseEther("0.005");
      const priorityFee = taskPayment * 100n / 10000n;
      const totalValue = MIN_STAKE + taskPayment + priorityFee;

      await expect(
        router.connect(client).registerAndCreateTask(
          "RouterAgent",
          ["management"],
          worker.address,
          taskPayment,
          deadline,
          ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTask")),
          { value: totalValue }
        )
      ).to.be.revertedWithCustomError(router, "SenderNotPreserved");

      const routerAgent = await registry.getAgent(await router.getAddress());
      expect(routerAgent.isActive).to.equal(0);
      expect(await escrow.taskCounter()).to.equal(0);
    });

    it("should reject before creating a task", async function () {
      const { router, registry, escrow, client, worker, deadline } = await loadFixture(workerRegisteredFixture);
      const taskPayment = ethers.parseEther("0.005");
      const pFee = taskPayment * 100n / 10000n;
      const totalValue = MIN_STAKE + taskPayment + pFee;

      await expect(
        router.connect(client).registerAndCreateTask(
          "Agent", ["mgmt"], worker.address, taskPayment, deadline,
          ethers.keccak256(ethers.toUtf8Bytes("t1")),
          { value: totalValue }
        )
      ).to.be.revertedWithCustomError(router, "SenderNotPreserved");
      expect(await escrow.taskCounter()).to.equal(0);
    });
  });

  describe("multicall", function () {
    it("should execute multiple calls in sequence", async function () {
      const { router, registry, escrow, client, worker, deadline } = await loadFixture(workerRegisteredFixture);

      // Build multicall: register router + create task
      // With .call, msg.sender will be the router, so the router gets registered
      const registerData = registry.interface.encodeFunctionData("register", ["RouterAgent", ["management"]]);
      const taskData = escrow.interface.encodeFunctionData("createAndFundTask", [
        worker.address, PAYMENT, deadline,
        ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmTask"))
      ]);

      const calls = [
        { target: await registry.getAddress(), value: MIN_STAKE, data: registerData },
        { target: await escrow.getAddress(), value: TOTAL, data: taskData },
      ];

      const tx = await router.connect(client).multicall(calls, { value: MIN_STAKE + TOTAL });
      await expect(tx).to.not.be.reverted;

      // Router gets registered (msg.sender from .call perspective)
      const routerAgent = await registry.getAgent(await router.getAddress());
      expect(routerAgent.isActive).to.equal(1);

      // Task client is the router contract
      const task = await escrow.getTask(1);
      expect(task.client).to.equal(await router.getAddress());
      expect(task.status).to.equal(2); // InProgress
    });

    it("should revert if total value does not match", async function () {
      const { router, registry, client } = await loadFixture(deployFixture);
      const calls = [
        { target: await registry.getAddress(), value: MIN_STAKE, data: "0x" },
      ];
      await expect(
        router.connect(client).multicall(calls, { value: MIN_STAKE - 1n })
      ).to.be.revertedWithCustomError(router, "WrongTotalValue");
    });

    it("should revert if a call fails", async function () {
      const { router, registry, client } = await loadFixture(deployFixture);
      // Try register with insufficient stake
      const registerData = registry.interface.encodeFunctionData("register", ["C", ["test"]]);
      const calls = [
        { target: await registry.getAddress(), value: 0, data: registerData },
      ];
      await expect(
        router.connect(client).multicall(calls, { value: 0 })
      ).to.be.revertedWithCustomError(router, "CallFailed");
    });

    it("should forward msg.sender as router contract in calls", async function () {
      const { router, registry, client } = await loadFixture(deployFixture);

      const registerData = registry.interface.encodeFunctionData("register", ["RouterAgent", ["management"]]);
      const calls = [
        { target: await registry.getAddress(), value: MIN_STAKE, data: registerData },
      ];

      await router.connect(client).multicall(calls, { value: MIN_STAKE });

      // The router contract gets registered (since .call preserves router as msg.sender)
      const agent = await registry.getAgent(await router.getAddress());
      expect(agent.isActive).to.equal(1);
      expect(agent.name).to.equal("RouterAgent");
    });

    it("should handle empty call array", async function () {
      const { router, client } = await loadFixture(deployFixture);
      await expect(router.connect(client).multicall([], { value: 0 })).to.not.be.reverted;
      await expect(
        router.connect(client).multicall([], { value: 1 })
      ).to.be.revertedWithCustomError(router, "WrongTotalValue");
    });
  });
});
