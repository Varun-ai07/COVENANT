const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Reentrancy Attack Tests", function () {
  let deployer;

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();
  });

  describe("AgentWallet.execute - CEI + nonReentrant", function () {
    it("should NOT allow draining via reentrancy", async function () {
      const WalletFactory = await ethers.getContractFactory("AgentWallet");
      const wallet = await WalletFactory.deploy(deployer.address, deployer.address);

      // Set daily limit: 0.04 ETH, per-tx limit: 0.03 ETH
      await wallet.setLimits(ethers.parseEther("0.04"), ethers.parseEther("0.03"));

      const AttackerFactory = await ethers.getContractFactory("WalletReentrancyAttacker");
      const attacker = await AttackerFactory.deploy(wallet.target);

      // Fund wallet with 1 ETH
      await deployer.sendTransaction({
        to: wallet.target,
        value: ethers.parseEther("1")
      });

      const balanceBefore = await ethers.provider.getBalance(wallet.target);

      // Attacker sends 0.03 ETH via execute, receive() tries to send 0.03 again
      // Without CEI: both succeed → 0.06 drained (exceeds 0.04 limit)
      // With CEI: dailySpent=0.03 before first call, second sees 0.06 > 0.04 → REVERT
      try {
        await attacker.attack(ethers.parseEther("0.03"));
      } catch (e) {}

      const balanceAfter = await ethers.provider.getBalance(wallet.target);
      const spent = balanceBefore - balanceAfter;

      // Should spend at most 0.03 ETH (1 tx), NOT 0.06 (2 txs)
      expect(spent).to.be.lessThanOrEqual(ethers.parseEther("0.03"));
    });

    it("should allow normal execution", async function () {
      const WalletFactory = await ethers.getContractFactory("AgentWallet");
      const wallet = await WalletFactory.deploy(deployer.address, deployer.address);

      await wallet.setLimits(ethers.parseEther("1"), ethers.parseEther("0.5"));

      await deployer.sendTransaction({
        to: wallet.target,
        value: ethers.parseEther("1")
      });

      const balanceBefore = await ethers.provider.getBalance(wallet.target);
      await wallet.execute(deployer.address, ethers.parseEther("0.1"), "0x");
      const balanceAfter = await ethers.provider.getBalance(wallet.target);

      expect(balanceBefore - balanceAfter).to.equal(ethers.parseEther("0.1"));
    });

    it("should block daily limit bypass via reentrancy", async function () {
      const WalletFactory = await ethers.getContractFactory("AgentWallet");
      const wallet = await WalletFactory.deploy(deployer.address, deployer.address);

      // Very tight limit: 0.05 ETH total
      await wallet.setLimits(ethers.parseEther("0.05"), ethers.parseEther("0.03"));

      const AttackerFactory = await ethers.getContractFactory("WalletReentrancyAttacker");
      const attacker = await AttackerFactory.deploy(wallet.target);

      await deployer.sendTransaction({
        to: wallet.target,
        value: ethers.parseEther("1")
      });

      const walletBalanceBefore = await ethers.provider.getBalance(wallet.target);

      // Attack: 0.03 first call, 0.03 in receive() = 0.06 total > 0.05 limit
      // CEI prevents this because dailySpent is updated before external call
      try {
        await attacker.attack(ethers.parseEther("0.03"));
      } catch (e) {}

      const walletBalanceAfter = await ethers.provider.getBalance(wallet.target);

      // Wallet should retain > 0.95 ETH (max 0.03 spent)
      expect(walletBalanceAfter).to.be.greaterThan(ethers.parseEther("0.95"));
    });
  });
});
