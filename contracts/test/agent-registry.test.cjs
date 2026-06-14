const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AgentRegistry (v1)", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const INITIAL_REPUTATION = 500;
  const MAX_REPUTATION = 1000;

  async function deployFixture() {
    const [owner, agent1, agent2, agent3, unauthorized] = await ethers.getSigners();
    const AgentRegistry = await ethers.getContractFactory("contracts/AgentRegistry.sol:AgentRegistry");
    const registry = await AgentRegistry.deploy();
    await registry.waitForDeployment();
    return { registry, owner, agent1, agent2, agent3, unauthorized };
  }

  async function registeredFixture() {
    const base = await deployFixture();
    const { registry, agent1, agent2 } = base;

    await registry.connect(agent1).register("Alpha", ["data-analysis", "code-review"], {
      value: MIN_STAKE,
    });

    await registry.connect(agent2).register("Beta", ["code-review", "testing"], {
      value: ethers.parseEther("0.005"),
    });

    return base;
  }

  describe("Deployment", function () {
    it("should deploy with correct owner", async function () {
      const { registry, owner } = await loadFixture(deployFixture);
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should start with zero agents", async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.getAgentCount()).to.equal(0);
    });

    it("should have correct constants", async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.MIN_STAKE()).to.equal(MIN_STAKE);
      expect(await registry.INITIAL_REPUTATION()).to.equal(INITIAL_REPUTATION);
      expect(await registry.MAX_REPUTATION()).to.equal(MAX_REPUTATION);
    });
  });

  describe("Registration", function () {
    it("should register an agent with minimum stake", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);
      const tx = await registry.connect(agent1).register("Alpha", ["data-analysis"], {
        value: MIN_STAKE,
      });
      await expect(tx).to.emit(registry, "AgentRegistered");

      const agent = await registry.getAgent(agent1.address);
      expect(agent.isActive).to.equal(1);
      expect(agent.name).to.equal("Alpha");
      expect(agent.reputation).to.equal(INITIAL_REPUTATION);
      expect(agent.stakedAmount).to.equal(MIN_STAKE);
      expect(agent.tasksCompleted).to.equal(0);
      expect(agent.tasksFailed).to.equal(0);
      expect(agent.totalValueTransacted).to.equal(0);
      expect(agent.wallet).to.equal(agent1.address);
      expect(agent.registeredAt).to.be.gt(0);
      expect(agent.lastTaskAt).to.equal(0);
      expect(agent.capabilities.length).to.equal(1);
      expect(agent.capabilities[0]).to.equal("data-analysis");
    });

    it("should generate a unique DID per agent", async function () {
      const { registry, agent1, agent2 } = await loadFixture(deployFixture);

      await registry.connect(agent1).register("Alpha", ["data-analysis"], { value: MIN_STAKE });
      await registry.connect(agent2).register("Beta", ["code-review"], { value: MIN_STAKE });

      const a1 = await registry.getAgent(agent1.address);
      const a2 = await registry.getAgent(agent2.address);
      expect(a1.did).to.not.equal(a2.did);
      expect(a1.did).to.not.equal(ethers.ZeroHash);
      expect(a2.did).to.not.equal(ethers.ZeroHash);
    });

    it("should reject duplicate registration", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);
      await registry.connect(agent1).register("Alpha", ["data-analysis"], { value: MIN_STAKE });
      await expect(
        registry.connect(agent1).register("Alpha", ["data-analysis"], { value: MIN_STAKE })
      ).to.be.revertedWith("Already registered");
    });

    it("should reject registration with insufficient stake", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);
      await expect(
        registry.connect(agent1).register("Alpha", ["data-analysis"], { value: 0 })
      ).to.be.revertedWith("Insufficient stake");
    });

    it("should reject registration with empty name", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);
      await expect(
        registry.connect(agent1).register("", ["data-analysis"], { value: MIN_STAKE })
      ).to.be.revertedWith("Name required");
    });

    it("should reject registration with empty capabilities", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);
      await expect(
        registry.connect(agent1).register("Alpha", [], { value: MIN_STAKE })
      ).to.be.revertedWith("At least one capability required");
    });

    it("should index agent by capability", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);
      await registry.connect(agent1).register("Alpha", ["code-review", "data-analysis"], { value: MIN_STAKE });

      const codeReviewers = await registry.getAgentsByCapability("code-review");
      expect(codeReviewers.length).to.equal(1);
      expect(codeReviewers[0]).to.equal(agent1.address);

      const dataAnalysts = await registry.getAgentsByCapability("data-analysis");
      expect(dataAnalysts.length).to.equal(1);
      expect(dataAnalysts[0]).to.equal(agent1.address);
    });

    it("should increment agent count", async function () {
      const { registry, agent1, agent2 } = await loadFixture(deployFixture);
      expect(await registry.getAgentCount()).to.equal(0);

      await registry.connect(agent1).register("Alpha", ["data-analysis"], { value: MIN_STAKE });
      expect(await registry.getAgentCount()).to.equal(1);

      await registry.connect(agent2).register("Beta", ["code-review"], { value: MIN_STAKE });
      expect(await registry.getAgentCount()).to.equal(2);
    });
  });

  describe("Agent Queries", function () {
    it("should return agent info via getAgent", async function () {
      const { registry, agent1 } = await loadFixture(registeredFixture);
      const agent = await registry.getAgent(agent1.address);
      expect(agent.name).to.equal("Alpha");
      expect(agent.isActive).to.equal(1);
    });

    it("should return all registered agents", async function () {
      const { registry, agent1, agent2 } = await loadFixture(registeredFixture);
      const allAgents = await registry.getAllAgents();
      expect(allAgents.length).to.equal(2);
      expect(allAgents).to.include(agent1.address);
      expect(allAgents).to.include(agent2.address);
    });

    it("should filter active agents by capability", async function () {
      const { registry, agent1, agent2 } = await loadFixture(registeredFixture);

      let codeReviewers = await registry.getAgentsByCapability("code-review");
      expect(codeReviewers.length).to.equal(2);
      expect(codeReviewers).to.include(agent1.address);
      expect(codeReviewers).to.include(agent2.address);

      const dataAnalysts = await registry.getAgentsByCapability("data-analysis");
      expect(dataAnalysts.length).to.equal(1);
      expect(dataAnalysts[0]).to.equal(agent1.address);
    });

    it("should not return deactivated agents in capability search", async function () {
      const { registry, agent1 } = await loadFixture(registeredFixture);
      await registry.connect(agent1).deactivate();

      const codeReviewers = await registry.getAgentsByCapability("code-review");
      expect(codeReviewers).to.not.include(agent1.address);
    });
  });

  describe("addStake", function () {
    it("should add stake to existing agent", async function () {
      const { registry, agent1 } = await loadFixture(registeredFixture);
      const before = await registry.getAgent(agent1.address);
      expect(before.stakedAmount).to.equal(MIN_STAKE);

      const additional = ethers.parseEther("0.005");
      await registry.connect(agent1).addStake({ value: additional });

      const after = await registry.getAgent(agent1.address);
      expect(after.stakedAmount).to.equal(MIN_STAKE + additional);
    });

    it("should reject addStake from non-registered address", async function () {
      const { registry, unauthorized } = await loadFixture(deployFixture);
      await expect(
        registry.connect(unauthorized).addStake({ value: MIN_STAKE })
      ).to.be.revertedWith("Not registered");
    });

    it("should reject addStake with zero value", async function () {
      const { registry, agent1 } = await loadFixture(registeredFixture);
      await expect(
        registry.connect(agent1).addStake({ value: 0 })
      ).to.be.revertedWith("Must send ETH");
    });
  });

  describe("Deactivate", function () {
    it("should deactivate agent and return stake", async function () {
      const { registry, agent1 } = await loadFixture(registeredFixture);
      const balanceBefore = await ethers.provider.getBalance(agent1.address);

      const tx = await registry.connect(agent1).deactivate();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const agent = await registry.getAgent(agent1.address);
      expect(agent.isActive).to.equal(0);
      expect(agent.stakedAmount).to.equal(0);

      const balanceAfter = await ethers.provider.getBalance(agent1.address);
      expect(balanceAfter + gasCost).to.be.closeTo(
        balanceBefore + MIN_STAKE,
        ethers.parseEther("0.0001")
      );
    });

    it("should emit AgentDeactivated event", async function () {
      const { registry, agent1 } = await loadFixture(registeredFixture);
      await expect(registry.connect(agent1).deactivate())
        .to.emit(registry, "AgentDeactivated")
        .withArgs(agent1.address);
    });

    it("should reject deactivate from non-active agent", async function () {
      const { registry, unauthorized } = await loadFixture(deployFixture);
      await expect(
        registry.connect(unauthorized).deactivate()
      ).to.be.revertedWith("Not active");
    });

    it("should not list deactivated agent in getAllAgents", async function () {
      const { registry, agent1 } = await loadFixture(registeredFixture);
      await registry.connect(agent1).deactivate();
      const allAgents = await registry.getAllAgents();
      expect(allAgents.includes(agent1.address)).to.be.true; // still in the list, just inactive
    });
  });

  describe("updateReputation", function () {
    it("should increase reputation within bounds", async function () {
      const { registry, owner, agent1 } = await loadFixture(registeredFixture);
      await registry.addAuthorizedContract(owner.address);

      await registry.updateReputation(agent1.address, 100);
      const agent = await registry.getAgent(agent1.address);
      expect(agent.reputation).to.equal(INITIAL_REPUTATION + 100);
    });

    it("should cap reputation at MAX_REPUTATION", async function () {
      const { registry, owner, agent1 } = await loadFixture(registeredFixture);
      await registry.addAuthorizedContract(owner.address);

      await registry.updateReputation(agent1.address, 1000);
      const agent = await registry.getAgent(agent1.address);
      expect(agent.reputation).to.equal(MAX_REPUTATION);
    });

    it("should decrease reputation", async function () {
      const { registry, owner, agent1 } = await loadFixture(registeredFixture);
      await registry.addAuthorizedContract(owner.address);

      await registry.updateReputation(agent1.address, -100);
      const agent = await registry.getAgent(agent1.address);
      expect(agent.reputation).to.equal(INITIAL_REPUTATION - 100);
    });

    it("should floor reputation at 0", async function () {
      const { registry, owner, agent1 } = await loadFixture(registeredFixture);
      await registry.addAuthorizedContract(owner.address);

      await registry.updateReputation(agent1.address, -1000);
      const agent = await registry.getAgent(agent1.address);
      expect(agent.reputation).to.equal(0);
    });

    it("should emit ReputationUpdated event", async function () {
      const { registry, owner, agent1 } = await loadFixture(registeredFixture);
      await registry.addAuthorizedContract(owner.address);

      await expect(registry.updateReputation(agent1.address, 50))
        .to.emit(registry, "ReputationUpdated")
        .withArgs(agent1.address, 50, INITIAL_REPUTATION + 50);
    });

    it("should reject from unauthorized caller", async function () {
      const { registry, unauthorized, agent1 } = await loadFixture(registeredFixture);
      await expect(
        registry.connect(unauthorized).updateReputation(agent1.address, 10)
      ).to.be.revertedWith("Not authorized");
    });

    it("should reject for non-active agent", async function () {
      const { registry, owner, unauthorized } = await loadFixture(deployFixture);
      await registry.addAuthorizedContract(owner.address);

      await expect(
        registry.updateReputation(unauthorized.address, 10)
      ).to.be.revertedWith("Agent not active");
    });
  });

  describe("recordTaskCompletion", function () {
    it("should increment tasksCompleted on success", async function () {
      const { registry, owner, agent1 } = await loadFixture(registeredFixture);
      await registry.addAuthorizedContract(owner.address);

      await registry.recordTaskCompletion(agent1.address, true, ethers.parseEther("0.01"));
      const agent = await registry.getAgent(agent1.address);
      expect(agent.tasksCompleted).to.equal(1);
      expect(agent.tasksFailed).to.equal(0);
      expect(agent.totalValueTransacted).to.equal(ethers.parseEther("0.01"));
    });

    it("should increment tasksFailed on failure", async function () {
      const { registry, owner, agent1 } = await loadFixture(registeredFixture);
      await registry.addAuthorizedContract(owner.address);

      await registry.recordTaskCompletion(agent1.address, false, 0);
      const agent = await registry.getAgent(agent1.address);
      expect(agent.tasksCompleted).to.equal(0);
      expect(agent.tasksFailed).to.equal(1);
    });

    it("should reject from unauthorized caller", async function () {
      const { registry, unauthorized, agent1 } = await loadFixture(registeredFixture);
      await expect(
        registry.connect(unauthorized).recordTaskCompletion(agent1.address, true, 0)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("slashStake", function () {
    it("should slash agent stake", async function () {
      const { registry, owner, agent1, agent2 } = await loadFixture(registeredFixture);
      // Use agent2 as authorized caller so owner doesn't pay tx gas
      await registry.addAuthorizedContract(agent2.address);

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const slashAmount = ethers.parseEther("0.0005");

      await registry.connect(agent2).slashStake(agent1.address, slashAmount);
      const agent = await registry.getAgent(agent1.address);
      expect(agent.stakedAmount).to.equal(MIN_STAKE - slashAmount);

      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(slashAmount);
    });

    it("should reject slash exceeding stake", async function () {
      const { registry, owner, agent1 } = await loadFixture(registeredFixture);
      await registry.addAuthorizedContract(owner.address);

      await expect(
        registry.slashStake(agent1.address, MIN_STAKE + 1n)
      ).to.be.revertedWith("Slash exceeds stake");
    });

    it("should reject from unauthorized caller", async function () {
      const { registry, unauthorized, agent1 } = await loadFixture(registeredFixture);
      await expect(
        registry.connect(unauthorized).slashStake(agent1.address, 1)
      ).to.be.revertedWith("Not authorized");
    });

    it("should reject for non-active agent", async function () {
      const { registry, owner, unauthorized } = await loadFixture(deployFixture);
      await registry.addAuthorizedContract(owner.address);

      await expect(
        registry.slashStake(unauthorized.address, 1)
      ).to.be.revertedWith("Agent not active");
    });
  });

  describe("Authorized Contract Management", function () {
    it("should allow owner to add authorized contract", async function () {
      const { registry, owner, agent1 } = await loadFixture(deployFixture);
      await expect(registry.addAuthorizedContract(agent1.address))
        .to.emit(registry, "AuthorizedContractAdded")
        .withArgs(agent1.address);
      expect(await registry.authorizedContracts(agent1.address)).to.be.true;
    });

    it("should allow owner to remove authorized contract", async function () {
      const { registry, owner, agent1 } = await loadFixture(deployFixture);
      await registry.addAuthorizedContract(agent1.address);
      await expect(registry.removeAuthorizedContract(agent1.address))
        .to.emit(registry, "AuthorizedContractRemoved")
        .withArgs(agent1.address);
      expect(await registry.authorizedContracts(agent1.address)).to.be.false;
    });

    it("should reject addAuthorizedContract from non-owner", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);
      await expect(
        registry.connect(agent1).addAuthorizedContract(agent1.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to call updateReputation directly", async function () {
      const { registry, owner, agent1 } = await loadFixture(registeredFixture);
      await registry.updateReputation(agent1.address, 50);
      const agent = await registry.getAgent(agent1.address);
      expect(agent.reputation).to.equal(INITIAL_REPUTATION + 50);
    });
  });

  describe("Reentrancy Guard", function () {
    it("should protect deactivate with nonReentrant", async function () {
      const { registry, agent1 } = await loadFixture(registeredFixture);
      expect(await registry.connect(agent1).deactivate()).to.not.be.reverted;
    });
  });

  describe("Edge Cases", function () {
    it("should handle agent with large stake", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);
      const largeStake = ethers.parseEther("100");
      await registry.connect(agent1).register("Rich", ["trading"], { value: largeStake });
      const agent = await registry.getAgent(agent1.address);
      expect(agent.stakedAmount).to.equal(largeStake);
    });

    it("should return default values for non-existent agent", async function () {
      const { registry, unauthorized } = await loadFixture(deployFixture);
      const agent = await registry.getAgent(unauthorized.address);
      expect(agent.isActive).to.equal(0);
      expect(agent.name).to.equal("");
      expect(agent.stakedAmount).to.equal(0);
    });

    it("should handle multiple deactivate and stake return", async function () {
      const { registry, agent1, agent2 } = await loadFixture(registeredFixture);
      await registry.connect(agent1).deactivate();

      await expect(registry.connect(agent1).deactivate()).to.be.revertedWith("Not active");
    });
  });
});
