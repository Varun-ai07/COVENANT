const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MultiTokenEscrow", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const PAYMENT_ETH = ethers.parseEther("0.01");
  const PAYMENT_ERC20 = ethers.parseEther("100");

  async function deployFixture() {
    const [owner, client, worker, other] = await ethers.getSigners();
    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 7200;

    const AgentRegistry = await ethers.getContractFactory("contracts/AgentRegistry.sol:AgentRegistry");
    const registry = await AgentRegistry.deploy();
    await registry.waitForDeployment();

    const MultiTokenEscrow = await ethers.getContractFactory("contracts/MultiTokenEscrow.sol:MultiTokenEscrow");
    const escrow = await MultiTokenEscrow.deploy(
      await registry.getAddress(),
      owner.address
    );
    await escrow.waitForDeployment();

    await registry.addAuthorizedContract(await escrow.getAddress());

    // Deploy mock ERC20
    const MockERC20 = await ethers.getContractFactory("contracts/test/MockERC20.sol:MockERC20");
    const mockToken = await MockERC20.deploy("MockUSDC", "mUSDC", ethers.parseEther("1000000"));
    await mockToken.waitForDeployment();

    // Whitelist the mock token
    await escrow.setAcceptedToken(await mockToken.getAddress(), true);

    return { registry, escrow, mockToken, owner, client, worker, other, deadline };
  }

  async function registerFixture() {
    const base = await deployFixture();
    const { registry, client, worker } = base;

    await registry.connect(client).register("Client", ["management"], { value: MIN_STAKE });
    await registry.connect(worker).register("Worker", ["code-review"], { value: ethers.parseEther("0.01") });

    // Distribute tokens to client
    const { mockToken } = base;
    await mockToken.transfer(client.address, ethers.parseEther("10000"));

    return base;
  }

  async function ethTaskFixture() {
    const base = await registerFixture();
    const { escrow, client, worker, deadline } = base;

    const descHash = ethers.keccak256(ethers.toUtf8Bytes("eth-task"));

    await escrow.connect(client).createAndFundTask(
      worker.address, PAYMENT_ETH, deadline, descHash,
      { value: PAYMENT_ETH }
    );

    return { ...base, descHash };
  }

  async function erc20TaskFixture() {
    const base = await registerFixture();
    const { escrow, client, worker, deadline, mockToken } = base;

    const descHash = ethers.keccak256(ethers.toUtf8Bytes("erc20-task"));
    const tokenAddr = await mockToken.getAddress();

    await mockToken.connect(client).approve(await escrow.getAddress(), PAYMENT_ERC20);
    await escrow.connect(client).createAndFundTaskERC20(
      worker.address, PAYMENT_ERC20, deadline, descHash, tokenAddr
    );

    return { ...base, descHash, tokenAddr };
  }

  describe("Token Management", function () {
    it("should report token as accepted", async function () {
      const { escrow, mockToken } = await loadFixture(deployFixture);
      expect(await escrow.isAcceptedToken(await mockToken.getAddress())).to.be.true;
    });

    it("should allow owner to toggle accepted token", async function () {
      const { escrow, mockToken } = await loadFixture(deployFixture);
      const tokenAddr = await mockToken.getAddress();

      await escrow.setAcceptedToken(tokenAddr, false);
      expect(await escrow.isAcceptedToken(tokenAddr)).to.be.false;

      await escrow.setAcceptedToken(tokenAddr, true);
      expect(await escrow.isAcceptedToken(tokenAddr)).to.be.true;
    });

    it("should emit TokenAccepted event", async function () {
      const { escrow, mockToken } = await loadFixture(deployFixture);
      const tokenAddr = await mockToken.getAddress();

      await expect(escrow.setAcceptedToken(tokenAddr, false))
        .to.emit(escrow, "TokenAccepted")
        .withArgs(tokenAddr, false);
    });

    it("should revert setAcceptedToken for address(0)", async function () {
      const { escrow } = await loadFixture(deployFixture);
      await expect(
        escrow.setAcceptedToken(ethers.ZeroAddress, true)
      ).to.be.revertedWith("Use address(0) for ETH");
    });

    it("should revert setAcceptedToken from non-owner", async function () {
      const { escrow, mockToken, client } = await loadFixture(deployFixture);
      await expect(
        escrow.connect(client).setAcceptedToken(await mockToken.getAddress(), true)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("should reject createAndFundTaskERC20 with non-whitelisted token", async function () {
      const { escrow, registry, client, worker, deadline } = await loadFixture(deployFixture);
      await registry.connect(client).register("Client", ["mgmt"], { value: MIN_STAKE });
      await registry.connect(worker).register("Worker", ["code"], { value: MIN_STAKE });

      const MockERC20 = await ethers.getContractFactory("contracts/test/MockERC20.sol:MockERC20");
      const badToken = await MockERC20.deploy("Bad", "BAD", ethers.parseEther("1000"));
      await badToken.waitForDeployment();
      await badToken.transfer(client.address, ethers.parseEther("100"));
      await badToken.connect(client).approve(await escrow.getAddress(), PAYMENT_ERC20);

      await expect(
        escrow.connect(client).createAndFundTaskERC20(
          worker.address, PAYMENT_ERC20, deadline,
          ethers.keccak256(ethers.toUtf8Bytes("fail")),
          await badToken.getAddress()
        )
      ).to.be.revertedWith("Token not accepted");
    });

    it("should reject createAndFundTaskERC20 with ETH address", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registerFixture);
      await expect(
        escrow.connect(client).createAndFundTaskERC20(
          worker.address, PAYMENT_ERC20, deadline,
          ethers.keccak256(ethers.toUtf8Bytes("err")),
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Use ETH function for native token");
    });
  });

  describe("ETH Tasks", function () {
    it("should create and fund task with ETH", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registerFixture);
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("eth-task"));

      const tx = await escrow.connect(client).createAndFundTask(
        worker.address, PAYMENT_ETH, deadline, descHash,
        { value: PAYMENT_ETH }
      );

      await expect(tx).to.emit(escrow, "TaskCreated");
      const task = await escrow.getTask(0);
      expect(task.client).to.equal(client.address);
      expect(task.worker).to.equal(worker.address);
      expect(task.payment).to.equal(PAYMENT_ETH);
      expect(task.status).to.equal(1); // Funded
      expect(task.token).to.equal(ethers.ZeroAddress);
    });

    it("should submit work and complete with success", async function () {
      const { escrow, worker, client } = await loadFixture(ethTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("result"));

      await escrow.connect(worker).submitWork(0, deliverable);
      let task = await escrow.getTask(0);
      expect(task.status).to.equal(3); // Submitted

      const balanceBefore = await ethers.provider.getBalance(worker.address);
      await escrow.connect(client).verifyTask(0, true);
      const balanceAfter = await ethers.provider.getBalance(worker.address);

      const expectedFee = PAYMENT_ETH * 100n / 10000n;
      const expectedNet = PAYMENT_ETH - expectedFee;
      expect(balanceAfter - balanceBefore).to.equal(expectedNet);

      task = await escrow.getTask(0);
      expect(task.status).to.equal(4); // Completed
    });

    it("should fail task and refund client on rejection", async function () {
      const { escrow, worker, client } = await loadFixture(ethTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("bad"));

      await escrow.connect(worker).submitWork(0, deliverable);

      const balanceBefore = await ethers.provider.getBalance(client.address);
      const tx = await escrow.connect(client).verifyTask(0, false);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(client.address);
      expect(balanceAfter + gasCost).to.be.closeTo(
        balanceBefore + PAYMENT_ETH,
        ethers.parseEther("0.0001")
      );

      const task = await escrow.getTask(0);
      expect(task.status).to.equal(5); // Failed
    });

    it("should reject createAndFundTask with wrong msg.value", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registerFixture);
      await expect(
        escrow.connect(client).createAndFundTask(
          worker.address, PAYMENT_ETH, deadline,
          ethers.keccak256(ethers.toUtf8Bytes("err")),
          { value: PAYMENT_ETH - 1n }
        )
      ).to.be.revertedWith("Must send exact payment");
    });

    it("should reject submitWork from non-worker", async function () {
      const { escrow, client } = await loadFixture(ethTaskFixture);
      await expect(
        escrow.connect(client).submitWork(0, ethers.keccak256(ethers.toUtf8Bytes("fake")))
      ).to.be.revertedWith("Only worker");
    });
  });

  describe("ERC20 Tasks", function () {
    it("should create and fund task with ERC20", async function () {
      const { escrow, client, worker, deadline, mockToken } = await loadFixture(registerFixture);
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("erc20-task"));
      const tokenAddr = await mockToken.getAddress();

      await mockToken.connect(client).approve(await escrow.getAddress(), PAYMENT_ERC20);
      const tx = await escrow.connect(client).createAndFundTaskERC20(
        worker.address, PAYMENT_ERC20, deadline, descHash, tokenAddr
      );

      await expect(tx).to.emit(escrow, "TaskCreated");
      const task = await escrow.getTask(0);
      expect(task.token).to.equal(tokenAddr);
      expect(task.status).to.equal(1); // Funded
      expect(await escrow.escrowedTokenBalances(tokenAddr)).to.equal(PAYMENT_ERC20);
    });

    it("should complete ERC20 task and pay worker", async function () {
      const { escrow, worker, client, mockToken } = await loadFixture(erc20TaskFixture);
      const tokenAddr = await mockToken.getAddress();
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("result"));

      await escrow.connect(worker).submitWork(0, deliverable);

      const balanceBefore = await mockToken.balanceOf(worker.address);
      await escrow.connect(client).verifyTask(0, true);
      const balanceAfter = await mockToken.balanceOf(worker.address);

      const expectedFee = PAYMENT_ERC20 * 100n / 10000n;
      const expectedNet = PAYMENT_ERC20 - expectedFee;
      expect(balanceAfter - balanceBefore).to.equal(expectedNet);
      expect(await escrow.accumulatedTokenFees(tokenAddr)).to.equal(expectedFee);
      expect(await escrow.escrowedTokenBalances(tokenAddr)).to.equal(0);

      const task = await escrow.getTask(0);
      expect(task.status).to.equal(4); // Completed
    });

    it("should fail ERC20 task and refund client", async function () {
      const { escrow, worker, client, mockToken } = await loadFixture(erc20TaskFixture);
      const tokenAddr = await mockToken.getAddress();
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("bad"));

      await escrow.connect(worker).submitWork(0, deliverable);

      const balanceBefore = await mockToken.balanceOf(client.address);
      await escrow.connect(client).verifyTask(0, false);
      const balanceAfter = await mockToken.balanceOf(client.address);

      expect(balanceAfter - balanceBefore).to.equal(PAYMENT_ERC20);
      expect(await escrow.escrowedTokenBalances(tokenAddr)).to.equal(0);

      const task = await escrow.getTask(0);
      expect(task.status).to.equal(5); // Failed
    });

    it("should reject createAndFundTaskERC20 without approval", async function () {
      const { escrow, client, worker, deadline, mockToken } = await loadFixture(registerFixture);
      await expect(
        escrow.connect(client).createAndFundTaskERC20(
          worker.address, PAYMENT_ERC20, deadline,
          ethers.keccak256(ethers.toUtf8Bytes("err")),
          await mockToken.getAddress()
        )
      ).to.be.reverted;
    });
  });

  describe("Deadline (checkDeadline)", function () {
    it("should fail ETH task and refund client after deadline", async function () {
      const { escrow, client, worker, deadline } = await loadFixture(registerFixture);

      await escrow.connect(client).createAndFundTask(
        worker.address, PAYMENT_ETH, deadline,
        ethers.keccak256(ethers.toUtf8Bytes("late")),
        { value: PAYMENT_ETH }
      );

      await time.increaseTo(deadline + 1);
      const balanceBefore = await ethers.provider.getBalance(client.address);
      const tx = await escrow.checkDeadline(0);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(client.address);
      expect(balanceAfter + gasCost).to.be.closeTo(
        balanceBefore + PAYMENT_ETH,
        ethers.parseEther("0.0001")
      );

      const task = await escrow.getTask(0);
      expect(task.status).to.equal(5); // Failed
    });

    it("should fail ERC20 task and refund after deadline", async function () {
      const { escrow, client, worker, deadline, mockToken } = await loadFixture(registerFixture);
      const tokenAddr = await mockToken.getAddress();

      await mockToken.connect(client).approve(await escrow.getAddress(), PAYMENT_ERC20);
      await escrow.connect(client).createAndFundTaskERC20(
        worker.address, PAYMENT_ERC20, deadline,
        ethers.keccak256(ethers.toUtf8Bytes("late-erc20")),
        tokenAddr
      );

      await time.increaseTo(deadline + 1);
      const balanceBefore = await mockToken.balanceOf(client.address);
      await escrow.checkDeadline(0);
      const balanceAfter = await mockToken.balanceOf(client.address);

      expect(balanceAfter - balanceBefore).to.equal(PAYMENT_ERC20);
      expect(await escrow.escrowedTokenBalances(tokenAddr)).to.equal(0);
    });

    it("should reject checkDeadline before deadline", async function () {
      const { escrow } = await loadFixture(ethTaskFixture);
      await expect(escrow.checkDeadline(0)).to.be.revertedWith("Deadline not passed");
    });
  });

  describe("Dispute and Resolve", function () {
    it("should dispute ETH task and resolve with worker win", async function () {
      const { escrow, client, worker, owner } = await loadFixture(ethTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("dispute"));

      await escrow.connect(worker).submitWork(0, deliverable);
      await escrow.connect(worker).disputeTask(0);

      let task = await escrow.getTask(0);
      expect(task.status).to.equal(6); // Disputed

      await escrow.connect(owner).resolveDispute(0, true, 8000);

      task = await escrow.getTask(0);
      expect(task.status).to.equal(4); // Completed
    });

    it("should resolve ERC20 dispute with worker win", async function () {
      const { escrow, client, worker, owner, mockToken } = await loadFixture(erc20TaskFixture);
      const tokenAddr = await mockToken.getAddress();

      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("dispute"));
      await escrow.connect(worker).submitWork(0, deliverable);
      await escrow.connect(worker).disputeTask(0);

      const workerBalBefore = await mockToken.balanceOf(worker.address);
      await escrow.connect(owner).resolveDispute(0, true, 8000);
      const workerBalAfter = await mockToken.balanceOf(worker.address);

      const expectedWorker = PAYMENT_ERC20 * 8000n / 10000n;
      expect(workerBalAfter - workerBalBefore).to.equal(expectedWorker);
    });

    it("should resolve dispute with client win (full refund)", async function () {
      const { escrow, client, worker, owner } = await loadFixture(ethTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("dispute"));

      await escrow.connect(worker).submitWork(0, deliverable);
      await escrow.connect(client).disputeTask(0);

      const clientBalBefore = await ethers.provider.getBalance(client.address);
      const tx = await escrow.connect(owner).resolveDispute(0, false, 0);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const clientBalAfter = await ethers.provider.getBalance(client.address);
      expect(clientBalAfter + gasCost).to.be.closeTo(
        clientBalBefore + PAYMENT_ETH,
        ethers.parseEther("0.0001")
      );

      const task = await escrow.getTask(0);
      expect(task.status).to.equal(5); // Failed
    });

    it("should reject dispute from non-participant", async function () {
      const { escrow, other } = await loadFixture(ethTaskFixture);
      await expect(
        escrow.connect(other).disputeTask(0)
      ).to.be.revertedWith("Not authorized");
    });

    it("should reject resolveDispute from non-owner", async function () {
      const { escrow, worker, client } = await loadFixture(ethTaskFixture);
      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("dispute"));
      await escrow.connect(worker).submitWork(0, deliverable);
      await escrow.connect(worker).disputeTask(0);

      await expect(
        escrow.connect(client).resolveDispute(0, true, 5000)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });
  });

  describe("Fee Withdrawal", function () {
    it("should withdraw accumulated ETH fees", async function () {
      const { escrow, client, worker, owner, other } = await loadFixture(ethTaskFixture);
      // Set feeRecipient to separate address so caller doesn't pay gas
      await escrow.setFeeRecipient(other.address);

      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("result"));
      await escrow.connect(worker).submitWork(0, deliverable);
      await escrow.connect(client).verifyTask(0, true);

      const feesBefore = await escrow.accumulatedFees();
      expect(feesBefore).to.be.gt(0);

      const balBefore = await ethers.provider.getBalance(other.address);
      await escrow.connect(owner).withdrawFees();
      const balAfter = await ethers.provider.getBalance(other.address);

      expect(balAfter - balBefore).to.equal(feesBefore);
      expect(await escrow.accumulatedFees()).to.equal(0);
    });

    it("should withdraw accumulated ERC20 fees", async function () {
      const { escrow, client, worker, owner, mockToken } = await loadFixture(erc20TaskFixture);
      const tokenAddr = await mockToken.getAddress();

      const deliverable = ethers.keccak256(ethers.toUtf8Bytes("result"));
      await escrow.connect(worker).submitWork(0, deliverable);
      await escrow.connect(client).verifyTask(0, true);

      const feesBefore = await escrow.accumulatedTokenFees(tokenAddr);
      expect(feesBefore).to.be.gt(0);

      const balBefore = await mockToken.balanceOf(owner.address);
      await escrow.connect(owner).withdrawTokenFees(tokenAddr);
      const balAfter = await mockToken.balanceOf(owner.address);

      expect(balAfter - balBefore).to.equal(feesBefore);
      expect(await escrow.accumulatedTokenFees(tokenAddr)).to.equal(0);
    });

    it("should revert withdrawFees when no fees", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      await expect(escrow.connect(owner).withdrawFees()).to.be.revertedWith("No ETH fees");
    });

    it("should revert withdrawTokenFees when no fees", async function () {
      const { escrow, owner, mockToken } = await loadFixture(deployFixture);
      await expect(
        escrow.connect(owner).withdrawTokenFees(await mockToken.getAddress())
      ).to.be.revertedWith("No token fees");
    });

    it("should revert withdrawFees from non-owner", async function () {
      const { escrow, client } = await loadFixture(deployFixture);
      await expect(
        escrow.connect(client).withdrawFees()
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("should revert withdrawTokenFees from non-owner", async function () {
      const { escrow, client, mockToken } = await loadFixture(deployFixture);
      await expect(
        escrow.connect(client).withdrawTokenFees(await mockToken.getAddress())
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });
  });

  describe("Read Functions", function () {
    it("should return correct task count", async function () {
      const { escrow } = await loadFixture(ethTaskFixture);
      expect(await escrow.getTaskCount()).to.equal(1);
    });

    it("should return full task data via getTask", async function () {
      const { escrow, client, worker } = await loadFixture(ethTaskFixture);
      const [taskClient, taskWorker, payment, , , , status, , , token] = await escrow.getTask(0);
      expect(taskClient).to.equal(client.address);
      expect(taskWorker).to.equal(worker.address);
      expect(payment).to.equal(PAYMENT_ETH);
      expect(token).to.equal(ethers.ZeroAddress);
      expect(status).to.equal(1); // Funded
    });

    it("should allow owner to update fee recipient", async function () {
      const { escrow, owner, other } = await loadFixture(deployFixture);
      await expect(escrow.setFeeRecipient(other.address))
        .to.emit(escrow, "FeeRecipientUpdated");
      expect(await escrow.feeRecipient()).to.equal(other.address);
    });

    it("should reject setFeeRecipient to zero address", async function () {
      const { escrow } = await loadFixture(deployFixture);
      await expect(
        escrow.setFeeRecipient(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid recipient");
    });
  });
});
