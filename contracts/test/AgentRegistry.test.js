import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("AgentRegistry", function () {
  let registry;
  let owner, agent1, agent2, unauthorized;

  const MIN_STAKE = ethers.parseEther("0.001");
  const INITIAL_REPUTATION = 500;

  beforeEach(async function () {
    [owner, agent1, agent2, unauthorized] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("AgentRegistry");
    registry = await Registry.deploy();
  });

  describe("Registration", function () {
    it("should register an agent with sufficient stake", async function () {
      await registry.connect(agent1).register("Alpha", ["data-analysis"], {
        value: MIN_STAKE,
      });

      const agent = await registry.getAgent(agent1.address);
      expect(agent.isActive).to.be.true;
      expect(agent.name).to.equal("Alpha");
      expect(agent.reputation).to.equal(INITIAL_REPUTATION);
      expect(agent.stakedAmount).to.equal(MIN_STAKE);
    });

    it("should generate unique DIDs for different agents", async function () {
      await registry.connect(agent1).register("Alpha", ["data-analysis"], {
        value: MIN_STAKE,
      });
      await registry.connect(agent2).register("Beta", ["content-writing"], {
        value: MIN_STAKE,
      });

      const agent1Data = await registry.getAgent(agent1.address);
      const agent2Data = await registry.getAgent(agent2.address);
      expect(agent1Data.did).to.not.equal(agent2Data.did);
    });

    it("should reject registration with insufficient stake", async function () {
      const lowStake = ethers.parseEther("0.0005");
      await expect(
        registry.connect(agent1).register("Alpha", ["data-analysis"], {
          value: lowStake,
        })
      ).to.be.revertedWith("Insufficient stake");
    });

    it("should reject duplicate registration", async function () {
      await registry.connect(agent1).register("Alpha", ["data-analysis"], {
        value: MIN_STAKE,
      });

      await expect(
        registry.connect(agent1).register("Alpha2", ["content-writing"], {
          value: MIN_STAKE,
        })
      ).to.be.revertedWith("Already registered");
    });

    it("should reject registration with empty name", async function () {
      await expect(
        registry.connect(agent1).register("", ["data-analysis"], {
          value: MIN_STAKE,
        })
      ).to.be.revertedWith("Name required");
    });

    it("should index agents by capability", async function () {
      await registry.connect(agent1).register("Alpha", ["data-analysis"], {
        value: MIN_STAKE,
      });
      await registry.connect(agent2).register("Beta", ["data-analysis", "content-writing"], {
        value: MIN_STAKE,
      });

      const dataAgents = await registry.getAgentsByCapability("data-analysis");
      expect(dataAgents).to.include(agent1.address);
      expect(dataAgents).to.include(agent2.address);
    });

    it("should emit AgentRegistered event", async function () {
      await expect(
        registry.connect(agent1).register("Alpha", ["data-analysis"], {
          value: MIN_STAKE,
        })
      ).to.emit(registry, "AgentRegistered");
    });
  });

  describe("Reputation", function () {
    beforeEach(async function () {
      await registry.connect(agent1).register("Alpha", ["data-analysis"], {
        value: MIN_STAKE,
      });
      await registry.addAuthorizedContract(owner.address);
    });

    it("should update reputation positively", async function () {
      await registry.updateReputation(agent1.address, 10);
      const agent = await registry.getAgent(agent1.address);
      expect(agent.reputation).to.equal(510);
    });

    it("should update reputation negatively", async function () {
      await registry.updateReputation(agent1.address, -50);
      const agent = await registry.getAgent(agent1.address);
      expect(agent.reputation).to.equal(450);
    });

    it("should cap reputation at MAX_REPUTATION", async function () {
      await registry.updateReputation(agent1.address, 600);
      const agent = await registry.getAgent(agent1.address);
      expect(agent.reputation).to.equal(1000);
    });

    it("should not go below 0 reputation", async function () {
      await registry.updateReputation(agent1.address, -600);
      const agent = await registry.getAgent(agent1.address);
      expect(agent.reputation).to.equal(0);
    });

    it("should reject unauthorized reputation updates", async function () {
      await expect(
        registry.connect(unauthorized).updateReputation(agent1.address, 10)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Stake Management", function () {
    beforeEach(async function () {
      await registry.connect(agent1).register("Alpha", ["data-analysis"], {
        value: MIN_STAKE,
      });
    });

    it("should allow adding additional stake", async function () {
      const additionalStake = ethers.parseEther("0.05");
      await registry.connect(agent1).addStake({ value: additionalStake });

      const agent = await registry.getAgent(agent1.address);
      expect(agent.stakedAmount).to.equal(MIN_STAKE + additionalStake);
    });

    it("should allow deactivation and return stake", async function () {
      await registry.connect(agent1).deactivate();

      const agent = await registry.getAgent(agent1.address);
      expect(agent.isActive).to.be.false;
      expect(agent.stakedAmount).to.equal(0);
    });
  });

  describe("Discovery", function () {
    it("should return agent count", async function () {
      await registry.connect(agent1).register("Alpha", ["data-analysis"], {
        value: MIN_STAKE,
      });
      await registry.connect(agent2).register("Beta", ["content-writing"], {
        value: MIN_STAKE,
      });

      expect(await registry.getAgentCount()).to.equal(2);
    });

    it("should filter inactive agents from capability search", async function () {
      await registry.connect(agent1).register("Alpha", ["data-analysis"], {
        value: MIN_STAKE,
      });
      await registry.connect(agent2).register("Beta", ["data-analysis"], {
        value: MIN_STAKE,
      });

      await registry.connect(agent1).deactivate();

      const activeAgents = await registry.getAgentsByCapability("data-analysis");
      expect(activeAgents).to.have.lengthOf(1);
      expect(activeAgents[0]).to.equal(agent2.address);
    });
  });
});
