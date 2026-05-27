const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiTokenEscrow", function () {
  let owner, client, worker, other;
  let registry, escrow, mockToken;
  let deadline;

  before(async function () {
    [owner, client, worker, other] = await ethers.getSigners();

    const block = await ethers.provider.getBlock("latest");
    deadline = block.timestamp + 7200; // 2 hours

    // Deploy AgentRegistry (v1 — same as MultiTokenEscrow imports)
    const AgentRegistry = await ethers.getContractFactory("contracts/AgentRegistry.sol:AgentRegistry");
    registry = await AgentRegistry.deploy();
    await registry.waitForDeployment();

    // Deploy MultiTokenEscrow
    const MultiTokenEscrow = await ethers.getContractFactory("MultiTokenEscrow");
    escrow = await MultiTokenEscrow.deploy(
      await registry.getAddress(),
      owner.address
    );
    await escrow.waitForDeployment();

    // Authorize escrow on registry
    await registry.addAuthorizedContract(await escrow.getAddress());

    // Register worker as active agent so recordTaskCompletion succeeds
    await registry.connect(worker).register("Worker", ["code-review"], {
      value: ethers.parseEther("0.01"),
    });

    // Deploy mock ERC20 (1M supply, 18 decimals)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("MockUSDC", "mUSDC", ethers.parseEther("1000000"));
    await mockToken.waitForDeployment();

    // Whitelist the token
    await escrow.setAcceptedToken(await mockToken.getAddress(), true);

    // Distribute tokens to client
    await mockToken.transfer(client.address, ethers.parseEther("10000"));
  });

  describe("Token Management", function () {
    it("should report token as accepted", async function () {
      const tokenAddr = await mockToken.getAddress();
      expect(await escrow.isAcceptedToken(tokenAddr)).to.be.true;
    });

    it("should allow owner to remove accepted token", async function () {
      const tokenAddr = await mockToken.getAddress();
      await escrow.setAcceptedToken(tokenAddr, false);
      expect(await escrow.isAcceptedToken(tokenAddr)).to.be.false;
      // Re-add for remaining tests
      await escrow.setAcceptedToken(tokenAddr, true);
    });

    it("should revert setAcceptedToken for address(0)", async function () {
      await expect(
        escrow.setAcceptedToken(ethers.ZeroAddress, true)
      ).to.be.revertedWith("Use address(0) for ETH");
    });

    it("should revert setAcceptedToken from non-owner", async function () {
      const tokenAddr = await mockToken.getAddress();
      await expect(
        escrow.connect(other).setAcceptedToken(tokenAddr, true)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });
  });

  describe("ETH Tasks", function () {
    let ethTaskId;

    it("should create and fund task with ETH", async function () {
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("eth-task"));
      const payment = ethers.parseEther("0.01");

      const tx = await escrow.connect(client).createAndFundTask(
        worker.address, payment, deadline, descHash,
        { value: payment }
      );
      const receipt = await tx.wait();

      // Check TaskCreated event
      const event = receipt.logs.find(
        l => l.fragment && l.fragment.name === "TaskCreated"
      );
      expect(event).to.not.be.undefined;

      ethTaskId = 0;
      const task = await escrow.getTask(ethTaskId);
      expect(task.client).to.equal(client.address);
      expect(task.worker).to.equal(worker.address);
      expect(task.payment).to.equal(payment);
      expect(task.status).to.equal(1); // Funded
      expect(task.token).to.equal(ethers.ZeroAddress); // ETH
    });

    it("should submit work and verify success (ETH)", async function () {
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("result"));
      await escrow.connect(worker).submitWork(ethTaskId, deliverable);

      const taskBefore = await escrow.getTask(ethTaskId);
      expect(taskBefore.status).to.equal(3); // Submitted

      const balanceBefore = await ethers.provider.getBalance(worker.address);
      await escrow.connect(client).verifyTask(ethTaskId, true);
      const balanceAfter = await ethers.provider.getBalance(worker.address);

      // Worker gets payment minus 1% fee
      const expectedFee = ethers.parseEther("0.01") * 100n / 10000n;
      const expectedNet = ethers.parseEther("0.01") - expectedFee;
      expect(balanceAfter - balanceBefore).to.equal(expectedNet);

      const taskAfter = await escrow.getTask(ethTaskId);
      expect(taskAfter.status).to.equal(4); // Completed
    });

    it("should create task and verify failure (refund client)", async function () {
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("eth-task-fail"));
      const payment = ethers.parseEther("0.005");

      await escrow.connect(client).createAndFundTask(
        worker.address, payment, deadline, descHash,
        { value: payment }
      );
      const failTaskId = 1;

      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("bad-result"));
      await escrow.connect(worker).submitWork(failTaskId, deliverable);

      const balanceBefore = await ethers.provider.getBalance(client.address);
      await escrow.connect(client).verifyTask(failTaskId, false);
      const balanceAfter = await ethers.provider.getBalance(client.address);

      // Client gets full refund (minus gas)
      expect(balanceAfter).to.be.gt(balanceBefore);

      const task = await escrow.getTask(failTaskId);
      expect(task.status).to.equal(5); // Failed
    });

    it("should revert createAndFundTask with wrong msg.value", async function () {
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("eth-task-err"));
      const payment = ethers.parseEther("0.01");

      await expect(
        escrow.connect(client).createAndFundTask(
          worker.address, payment, deadline, descHash,
          { value: ethers.parseEther("0.005") } // wrong amount
        )
      ).to.be.revertedWith("Must send exact payment");
    });
  });

  describe("ERC20 Tasks", function () {
    let erc20TaskId;

    it("should create and fund task with ERC20", async function () {
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("erc20-task"));
      const payment = ethers.parseEther("100"); // 100 mUSDC
      const tokenAddr = await mockToken.getAddress();

      // Approve escrow to spend tokens
      await mockToken.connect(client).approve(await escrow.getAddress(), payment);

      const tx = await escrow.connect(client).createAndFundTaskERC20(
        worker.address, payment, deadline, descHash, tokenAddr
      );
      const receipt = await tx.wait();

      const event = receipt.logs.find(
        l => l.fragment && l.fragment.name === "TaskCreated"
      );
      expect(event).to.not.be.undefined;

      erc20TaskId = 2; // Two ETH tasks already created
      const task = await escrow.getTask(erc20TaskId);
      expect(task.client).to.equal(client.address);
      expect(task.worker).to.equal(worker.address);
      expect(task.payment).to.equal(payment);
      expect(task.token).to.equal(tokenAddr);
      expect(task.status).to.equal(1); // Funded

      // Check escrowed balance
      expect(await escrow.escrowedTokenBalances(tokenAddr)).to.equal(payment);
    });

    it("should submit work and verify success (ERC20)", async function () {
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("erc20-result"));
      await escrow.connect(worker).submitWork(erc20TaskId, deliverable);

      const payment = ethers.parseEther("100");
      const tokenAddr = await mockToken.getAddress();

      const balanceBefore = await mockToken.balanceOf(worker.address);
      await escrow.connect(client).verifyTask(erc20TaskId, true);
      const balanceAfter = await mockToken.balanceOf(worker.address);

      // Worker gets payment minus 1% fee
      const expectedFee = payment * 100n / 10000n;
      const expectedNet = payment - expectedFee;
      expect(balanceAfter - balanceBefore).to.equal(expectedNet);

      // Check accumulated token fees
      expect(await escrow.accumulatedTokenFees(tokenAddr)).to.equal(expectedFee);

      const task = await escrow.getTask(erc20TaskId);
      expect(task.status).to.equal(4); // Completed
    });

    it("should create task and verify failure (ERC20 refund)", async function () {
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("erc20-fail"));
      const payment = ethers.parseEther("50");
      const tokenAddr = await mockToken.getAddress();

      await mockToken.connect(client).approve(await escrow.getAddress(), payment);
      await escrow.connect(client).createAndFundTaskERC20(
        worker.address, payment, deadline, descHash, tokenAddr
      );
      const failTaskId = 3;

      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("erc20-bad"));
      await escrow.connect(worker).submitWork(failTaskId, deliverable);

      const balanceBefore = await mockToken.balanceOf(client.address);
      await escrow.connect(client).verifyTask(failTaskId, false);
      const balanceAfter = await mockToken.balanceOf(client.address);

      // Client gets full refund
      expect(balanceAfter - balanceBefore).to.equal(payment);

      const task = await escrow.getTask(failTaskId);
      expect(task.status).to.equal(5); // Failed
    });

    it("should revert createAndFundTaskERC20 with ETH address", async function () {
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("erc20-err"));
      const payment = ethers.parseEther("10");

      await expect(
        escrow.connect(client).createAndFundTaskERC20(
          worker.address, payment, deadline, descHash, ethers.ZeroAddress
        )
      ).to.be.revertedWith("Use ETH function for native token");
    });

    it("should revert createAndFundTaskERC20 with unaccepted token", async function () {
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("erc20-err2"));
      const payment = ethers.parseEther("10");

      // Deploy another mock token but don't whitelist it
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const badToken = await MockERC20.deploy("Bad", "BAD", ethers.parseEther("1000"));
      await badToken.transfer(client.address, ethers.parseEther("100"));
      await badToken.connect(client).approve(await escrow.getAddress(), payment);

      await expect(
        escrow.connect(client).createAndFundTaskERC20(
          worker.address, payment, deadline, descHash, await badToken.getAddress()
        )
      ).to.be.revertedWith("Token not accepted");
    });
  });

  describe("Dispute (ETH)", function () {
    it("should dispute and resolve in favor of worker", async function () {
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("dispute-task"));
      const payment = ethers.parseEther("0.01");

      await escrow.connect(client).createAndFundTask(
        worker.address, payment, deadline, descHash,
        { value: payment }
      );
      const disputeTaskId = 4;

      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("deliverable-dispute"));
      await escrow.connect(worker).submitWork(disputeTaskId, deliverable);

      await escrow.connect(worker).disputeTask(disputeTaskId);
      const disputed = await escrow.getTask(disputeTaskId);
      expect(disputed.status).to.equal(6); // Disputed

      // Resolve: worker wins 80%, client gets 20% refund
      await escrow.connect(owner).resolveDispute(disputeTaskId, true, 8000);
      const resolved = await escrow.getTask(disputeTaskId);
      expect(resolved.status).to.equal(4); // Completed
    });

    it("should dispute and resolve in favor of client", async function () {
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("dispute-task-client"));
      const payment = ethers.parseEther("0.01");

      await escrow.connect(client).createAndFundTask(
        worker.address, payment, deadline, descHash,
        { value: payment }
      );
      const disputeTaskId2 = 5;

      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("deliverable-dispute2"));
      await escrow.connect(worker).submitWork(disputeTaskId2, deliverable);

      await escrow.connect(client).disputeTask(disputeTaskId2);

      // Resolve: client wins (full refund)
      await escrow.connect(owner).resolveDispute(disputeTaskId2, false, 0);
      const resolved = await escrow.getTask(disputeTaskId2);
      expect(resolved.status).to.equal(5); // Failed (client gets refund)
    });
  });

  describe("Fee Withdrawal", function () {
    it("should withdraw accumulated ETH fees", async function () {
      const feesBefore = await escrow.accumulatedFees();
      expect(feesBefore).to.be.gt(0);

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      await escrow.connect(owner).withdrawFees();
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
      expect(await escrow.accumulatedFees()).to.equal(0);
    });

    it("should withdraw accumulated ERC20 fees", async function () {
      const tokenAddr = await mockToken.getAddress();
      const feesBefore = await escrow.accumulatedTokenFees(tokenAddr);
      expect(feesBefore).to.be.gt(0);

      const balanceBefore = await mockToken.balanceOf(owner.address);
      await escrow.connect(owner).withdrawTokenFees(tokenAddr);
      const balanceAfter = await mockToken.balanceOf(owner.address);

      expect(balanceAfter - balanceBefore).to.equal(feesBefore);
      expect(await escrow.accumulatedTokenFees(tokenAddr)).to.equal(0);
    });

    it("should revert withdrawFees when no fees", async function () {
      await expect(
        escrow.connect(owner).withdrawFees()
      ).to.be.revertedWith("No ETH fees");
    });

    it("should revert withdrawTokenFees when no fees", async function () {
      const tokenAddr = await mockToken.getAddress();
      await expect(
        escrow.connect(owner).withdrawTokenFees(tokenAddr)
      ).to.be.revertedWith("No token fees");
    });

    it("should revert withdrawFees from non-owner", async function () {
      await expect(
        escrow.connect(other).withdrawFees()
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });
  });

  describe("Read Functions", function () {
    it("should return correct task count", async function () {
      expect(await escrow.getTaskCount()).to.equal(6); // All tasks created in this test
    });

    it("should return full task data via getTask", async function () {
      const task = await escrow.getTask(0);
      expect(task.client).to.equal(client.address);
      expect(task.worker).to.equal(worker.address);
      expect(task.payment).to.equal(ethers.parseEther("0.01"));
      expect(task.token).to.equal(ethers.ZeroAddress);
      expect(task.status).to.equal(4); // Completed
    });
  });
});
