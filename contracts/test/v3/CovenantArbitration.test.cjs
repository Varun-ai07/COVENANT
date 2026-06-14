const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CovenantArbitration V3", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const TASK_AMOUNT = ethers.parseEther("0.1");
  const DISPUTE_STAKE = ethers.parseEther("0.005");

  async function getDeadline() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp + 86400;
  }

  async function deployArbitrationFixture() {
    const [owner, oracle, arbiter, client, worker, other] = await ethers.getSigners();

    const Identity = await ethers.getContractFactory("contracts/v3/CovenantIdentity.sol:CovenantIdentity");
    const identity = await Identity.deploy();
    await identity.initialize(MIN_STAKE, oracle.address);

    const Escrow = await ethers.getContractFactory("contracts/v3/CovenantEscrow.sol:CovenantEscrow");
    const escrow = await Escrow.deploy();
    await escrow.initialize(identity.target);

    const Arbitration = await ethers.getContractFactory("contracts/v3/CovenantArbitration.sol:CovenantArbitration");
    const arbitration = await Arbitration.deploy();
    await arbitration.initialize(escrow.target, arbiter.address);

    await escrow.setAuthorizedArbitration(arbitration.target);

    await identity.connect(client).register(MIN_STAKE, ethers.ZeroHash, { value: MIN_STAKE });
    await identity.connect(worker).register(MIN_STAKE, ethers.ZeroHash, { value: MIN_STAKE });

    const deadline = await getDeadline();
    await escrow.connect(client).createTask(
      worker.address,
      TASK_AMOUNT,
      deadline,
      ethers.keccak256(ethers.toUtf8Bytes("task")),
      { value: TASK_AMOUNT }
    );

    return { arbitration, escrow, identity, owner, arbiter, client, worker, other };
  }

  describe("Dispute Creation", function () {
    it("should create a dispute for a task", async function () {
      const { arbitration, client } = await loadFixture(deployArbitrationFixture);
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("evidence"));

      await arbitration.connect(client).createDispute(1, evidenceHash);

      const dispute = await arbitration.getDispute(1);
      expect(dispute.taskId).to.equal(1);
      expect(dispute.disputant).to.equal(client.address);
    });
  });

  describe("Staking", function () {
    it("should allow parties to stake for dispute", async function () {
      const { arbitration, client, worker } = await loadFixture(deployArbitrationFixture);

      await arbitration.connect(client).createDispute(1, ethers.ZeroHash);
      await arbitration.connect(client).stakeForDispute(1, { value: DISPUTE_STAKE });
      await arbitration.connect(worker).stakeForDispute(1, { value: DISPUTE_STAKE });

      const dispute = await arbitration.getDispute(1);
      expect(dispute.clientStake).to.equal(DISPUTE_STAKE);
      expect(dispute.workerStake).to.equal(DISPUTE_STAKE);
    });

    it("should reject non-party staking", async function () {
      const { arbitration, client, other } = await loadFixture(deployArbitrationFixture);

      await arbitration.connect(client).createDispute(1, ethers.ZeroHash);

      await expect(
        arbitration.connect(other).stakeForDispute(1, { value: DISPUTE_STAKE })
      ).to.be.revertedWith("not party");
    });
  });

  describe("Ruling", function () {
    it("should allow arbiter to submit ruling with valid signature", async function () {
      const { arbitration, arbiter, client } = await loadFixture(deployArbitrationFixture);

      await arbitration.connect(client).createDispute(1, ethers.ZeroHash);

      const message = ethers.keccak256(ethers.solidityPacked(
        ["uint256", "uint8", "uint8", "uint256"],
        [1, 1, 0, 31337]
      ));
      const signature = await arbiter.signMessage(ethers.getBytes(message));

      await arbitration.connect(arbiter).submitRuling(1, 1, 0, signature);

      const dispute = await arbitration.getDispute(1);
      expect(dispute.ruling).to.equal(1); // ClientWins
    });

    it("should reject ruling from non-arbiter", async function () {
      const { arbitration, client } = await loadFixture(deployArbitrationFixture);

      await arbitration.connect(client).createDispute(1, ethers.ZeroHash);

      await expect(
        arbitration.connect(client).submitRuling(1, 1, 0, "0x")
      ).to.be.revertedWith("not arbiter");
    });
  });
});
