const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CovenantIdentity V3", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const METADATA_ROOT = ethers.keccak256(ethers.toUtf8Bytes("metadata"));

  async function deployIdentityFixture() {
    const [owner, oracle, agent1, agent2] = await ethers.getSigners();

    const Identity = await ethers.getContractFactory("contracts/v3/CovenantIdentity.sol:CovenantIdentity");
    const identity = await Identity.deploy();
    await identity.initialize(MIN_STAKE, oracle.address);

    return { identity, owner, oracle, agent1, agent2 };
  }

  describe("Registration", function () {
    it("should register a new agent with minimum stake", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);

      await identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });

      const agent = await identity.getAgent(agent1.address);
      expect(agent.owner).to.equal(agent1.address);
      expect(agent.stake).to.equal(MIN_STAKE);
      expect(agent.active).to.be.true;
      expect(agent.metadataRoot).to.equal(METADATA_ROOT);
    });

    it("should reject registration with insufficient stake", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);

      await expect(
        identity.connect(agent1).register(0, METADATA_ROOT, { value: ethers.parseEther("0.0001") })
      ).to.be.revertedWith("insufficient stake");
    });

    it("should reject double registration", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);

      await identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });

      await expect(
        identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE })
      ).to.be.revertedWith("already registered");
    });

    it("should track total agents count", async function () {
      const { identity, agent1, agent2 } = await loadFixture(deployIdentityFixture);

      await identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });
      expect(await identity.totalAgents()).to.equal(1);

      await identity.connect(agent2).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });
      expect(await identity.totalAgents()).to.equal(2);
    });
  });

  describe("Stake Management", function () {
    it("should allow increasing stake", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);

      await identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });
      await identity.connect(agent1).increaseStake({ value: ethers.parseEther("0.01") });

      const agent = await identity.getAgent(agent1.address);
      expect(agent.stake).to.equal(MIN_STAKE + ethers.parseEther("0.01"));
    });

    it("should allow withdrawing excess stake", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);
      const largeStake = ethers.parseEther("1");

      await identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: largeStake });
      await identity.connect(agent1).withdrawStake(ethers.parseEther("0.5"));

      const agent = await identity.getAgent(agent1.address);
      expect(agent.stake).to.equal(ethers.parseEther("0.5"));
    });

    it("should reject withdrawal below minimum", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);

      await identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });

      await expect(
        identity.connect(agent1).withdrawStake(MIN_STAKE)
      ).to.be.revertedWith("below minimum");
    });
  });

  describe("Deactivation", function () {
    it("should allow agent to deactivate", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);

      await identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });
      await identity.connect(agent1).deactivate();

      expect(await identity.isRegistered(agent1.address)).to.be.false;
    });
  });

  describe("Metadata Updates", function () {
    it("should allow metadata update", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);
      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("new metadata"));

      await identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });
      await identity.connect(agent1).updateMetadata(newRoot);

      const agent = await identity.getAgent(agent1.address);
      expect(agent.metadataRoot).to.equal(newRoot);
    });
  });

  describe("Access Control", function () {
    it("should only allow oracle to update reputation root", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);

      await expect(
        identity.connect(agent1).updateReputationRoot(ethers.ZeroHash, 1, "0x")
      ).to.be.revertedWith("not oracle");
    });

    it("should only allow owner to pause", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);

      await expect(
        identity.connect(agent1).pause()
      ).to.be.reverted;
    });
  });
});
