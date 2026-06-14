const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CovenantIdentity V4", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const METADATA_ROOT = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
  const CAPABILITY_HASH = ethers.keccak256(ethers.toUtf8Bytes("create_task"));

  async function deployIdentityFixture() {
    const [owner, oracle, agent1, agent2] = await ethers.getSigners();

    const Identity = await ethers.getContractFactory("contracts/v4/CovenantIdentity.sol:CovenantIdentity");
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

    it("should register with excess ETH as stake", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);
      const largeStake = ethers.parseEther("1");

      await identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: largeStake });

      const agent = await identity.getAgent(agent1.address);
      expect(agent.stake).to.equal(largeStake);
    });

    it("should reject registration with insufficient stake", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);
      const insufficientStake = ethers.parseEther("0.0001");

      await expect(
        identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: insufficientStake })
      ).to.be.revertedWith("insufficient stake");
    });

    it("should reject double registration", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);

      await identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });

      await expect(
        identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE })
      ).to.be.revertedWith("already registered");
    });
  });

  describe("Capability Delegation", function () {
    it("should grant a capability to an agent", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);

      await identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });

      const expiry = Math.floor(Date.now() / 1000) + 86400;
      await identity.connect(agent1).grantCapability(
        agent1.address,
        CAPABILITY_HASH,
        expiry,
        ethers.parseEther("1")
      );

      const hasCap = await identity.hasCapability(agent1.address, CAPABILITY_HASH);
      expect(hasCap).to.be.true;

      const cap = await identity.getCapability(agent1.address, CAPABILITY_HASH);
      expect(cap.capabilityHash).to.equal(CAPABILITY_HASH);
      expect(cap.valueLimit).to.equal(ethers.parseEther("1"));
      expect(cap.revoked).to.be.false;
    });

    it("should revoke a capability", async function () {
      const { identity, agent1 } = await loadFixture(deployIdentityFixture);

      await identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });

      const expiry = Math.floor(Date.now() / 1000) + 86400;
      await identity.connect(agent1).grantCapability(
        agent1.address,
        CAPABILITY_HASH,
        expiry,
        ethers.parseEther("1")
      );

      await identity.connect(agent1).revokeCapability(agent1.address, CAPABILITY_HASH);

      const hasCap = await identity.hasCapability(agent1.address, CAPABILITY_HASH);
      expect(hasCap).to.be.false;

      const cap = await identity.getCapability(agent1.address, CAPABILITY_HASH);
      expect(cap.revoked).to.be.true;
    });

    it("should reject grant from non-owner", async function () {
      const { identity, agent1, agent2 } = await loadFixture(deployIdentityFixture);

      await identity.connect(agent1).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });
      await identity.connect(agent2).register(MIN_STAKE, METADATA_ROOT, { value: MIN_STAKE });

      const expiry = Math.floor(Date.now() / 1000) + 86400;
      await expect(
        identity.connect(agent2).grantCapability(
          agent1.address,
          CAPABILITY_HASH,
          expiry,
          ethers.parseEther("1")
        )
      ).to.be.revertedWith("unauthorized");
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

      const agent = await identity.getAgent(agent1.address);
      expect(agent.active).to.be.false;
    });
  });

  describe("Access Control", function () {
    it("should only allow oracle to update reputation root", async function () {
      const { identity, oracle, agent1 } = await loadFixture(deployIdentityFixture);

      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("new root"));
      const message = ethers.solidityPacked(["bytes32", "uint256"], [newRoot, 1]);
      const ethSignedHash = ethers.hashMessage(ethers.getBytes(message));
      const signature = await oracle.signMessage(ethers.getBytes(message));

      await expect(
        identity.connect(agent1).updateReputationRoot(newRoot, 1, signature)
      ).to.be.revertedWith("not oracle");
    });
  });
});
