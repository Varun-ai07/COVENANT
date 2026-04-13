import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentWallet", function () {
  let wallet, owner, humanController, recipient, random;

  async function deployFixture() {
    const [owner, humanController, recipient, random] = await ethers.getSigners();
    const AgentWallet = await ethers.getContractFactory("AgentWallet");
    const wallet = await AgentWallet.deploy(owner.address, humanController.address);

    // Fund the wallet with 10 ETH for testing
    await owner.sendTransaction({ to: wallet.target, value: ethers.parseEther("10") });

    return { wallet, owner, humanController, recipient, random };
  }

  describe("Deployment", function () {
    it("should set correct owner and humanController", async function () {
      const { wallet, owner, humanController } = await loadFixture(deployFixture);
      expect(await wallet.owner()).to.equal(owner.address);
      expect(await wallet.humanController()).to.equal(humanController.address);
      expect(await wallet.paused()).to.equal(false);
      expect(await wallet.dailySpendLimit()).to.equal(0);
      expect(await wallet.maxPerTransaction()).to.equal(0);
    });

    it("should have zero allowed recipients initially", async function () {
      const { wallet, recipient } = await loadFixture(deployFixture);
      expect(await wallet.recipientAllowed(recipient.address)).to.equal(false);
    });
  });

  describe("Set Limits", function () {
    it("should allow owner to set spending limits", async function () {
      const { wallet, owner } = await loadFixture(deployFixture);
      await wallet.connect(owner).setLimits(ethers.parseEther("1"), ethers.parseEther("0.1"));
      expect(await wallet.dailySpendLimit()).to.equal(ethers.parseEther("1"));
      expect(await wallet.maxPerTransaction()).to.equal(ethers.parseEther("0.1"));
    });

    it("should allow humanController to set spending limits", async function () {
      const { wallet, humanController } = await loadFixture(deployFixture);
      await wallet.connect(humanController).setLimits(ethers.parseEther("2"), ethers.parseEther("0.2"));
      expect(await wallet.dailySpendLimit()).to.equal(ethers.parseEther("2"));
      expect(await wallet.maxPerTransaction()).to.equal(ethers.parseEther("0.2"));
    });

    it("should reject setLimits from unauthorized address", async function () {
      const { wallet, random } = await loadFixture(deployFixture);
      await expect(wallet.connect(random).setLimits(ethers.parseEther("1"), ethers.parseEther("0.1")))
        .to.be.revertedWithCustomError(wallet, "OnlyHumanController");
    });

    it("should emit SpendingLimitsUpdated event", async function () {
      const { wallet, owner } = await loadFixture(deployFixture);
      await expect(wallet.connect(owner).setLimits(ethers.parseEther("1"), ethers.parseEther("0.1")))
        .to.emit(wallet, "SpendingLimitsUpdated").withArgs(ethers.parseEther("1"), ethers.parseEther("0.1"));
    });
  });

  describe("Recipient Whitelist", function () {
    it("should add recipient to whitelist", async function () {
      const { wallet, owner, recipient } = await loadFixture(deployFixture);
      await expect(wallet.connect(owner).addAllowedRecipient(recipient.address))
        .to.emit(wallet, "AllowedRecipientAdded").withArgs(recipient.address);
      expect(await wallet.recipientAllowed(recipient.address)).to.equal(true);
    });

    it("should reject adding zero address", async function () {
      const { wallet, owner } = await loadFixture(deployFixture);
      await expect(wallet.connect(owner).addAllowedRecipient(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(wallet, "InvalidAddress");
    });

    it("should reject adding from unauthorized address", async function () {
      const { wallet, random, recipient } = await loadFixture(deployFixture);
      await expect(wallet.connect(random).addAllowedRecipient(recipient.address))
        .to.be.revertedWithCustomError(wallet, "OnlyHumanController");
    });

    it("should remove recipient from whitelist", async function () {
      const { wallet, owner, recipient } = await loadFixture(deployFixture);
      await wallet.connect(owner).addAllowedRecipient(recipient.address);
      await expect(wallet.connect(owner).removeAllowedRecipient(recipient.address))
        .to.emit(wallet, "AllowedRecipientRemoved").withArgs(recipient.address);
      expect(await wallet.recipientAllowed(recipient.address)).to.equal(false);
    });

    it("should reject removing from unauthorized address", async function () {
      const { wallet, owner, random, recipient } = await loadFixture(deployFixture);
      await wallet.connect(owner).addAllowedRecipient(recipient.address);
      await expect(wallet.connect(random).removeAllowedRecipient(recipient.address))
        .to.be.revertedWithCustomError(wallet, "OnlyHumanController");
    });
  });

  describe("Pause/Unpause", function () {
    it("should allow owner to pause wallet", async function () {
      const { wallet, owner } = await loadFixture(deployFixture);
      await expect(wallet.connect(owner).emergencyPause()).to.emit(wallet, "WalletPaused");
      expect(await wallet.paused()).to.equal(true);
    });

    it("should reject pause from unauthorized address", async function () {
      const { wallet, random } = await loadFixture(deployFixture);
      await expect(wallet.connect(random).emergencyPause())
        .to.be.revertedWithCustomError(wallet, "OnlyHumanController");
    });

    it("should allow owner to unpause wallet", async function () {
      const { wallet, owner } = await loadFixture(deployFixture);
      await wallet.connect(owner).emergencyPause();
      await expect(wallet.connect(owner).emergencyUnpause()).to.emit(wallet, "WalletUnpaused");
      expect(await wallet.paused()).to.equal(false);
    });
  });

  // Simple contract to receive ETH for testing
  async function deployReceiver() {
    const Receiver = await ethers.getContractFactory("TestReceiver");
    return await Receiver.deploy();
  }

  describe("Execute Transactions", function () {
    let fixture, receiver;

    beforeEach(async function () {
      fixture = await loadFixture(deployFixture);
      receiver = await deployReceiver();
    });

    it("should allow owner to execute a function call with no limits", async function () {
      const { wallet, owner } = fixture;
      await wallet.connect(owner).setLimits(0, 0);

      await wallet.connect(owner).execute(
        await receiver.getAddress(),
        0,
        receiver.interface.encodeFunctionData("setValue", [42])
      );
      expect(await receiver.value()).to.equal(42);
    });

    it("should reject execution when paused", async function () {
      const { wallet, owner } = fixture;
      await wallet.connect(owner).emergencyPause();
      await expect(wallet.connect(owner).execute(await receiver.getAddress(), 0, "0x"))
        .to.be.revertedWithCustomError(wallet, "WalletPausedError");
    });

    it("should enforce per-transaction limit", async function () {
      const { wallet, owner } = fixture;
      await wallet.connect(owner).setLimits(ethers.parseEther("5"), ethers.parseEther("1"));

      await expect(wallet.connect(owner).execute(await receiver.getAddress(), ethers.parseEther("2"), "0x"))
        .to.be.revertedWithCustomError(wallet, "ExceedsPerTransactionLimit");
    });

    it("should enforce daily spend limit", async function () {
      const { wallet, owner } = fixture;
      await wallet.connect(owner).setLimits(ethers.parseEther("5"), ethers.parseEther("5"));

      // Spend 3 ETH (within daily limit)
      await wallet.connect(owner).execute(await receiver.getAddress(), ethers.parseEther("3"), "0x");

      // Try to exceed daily limit (3 + 2.1 = 5.1 > 5)
      await expect(wallet.connect(owner).execute(await receiver.getAddress(), ethers.parseEther("2.1"), "0x"))
        .to.be.revertedWithCustomError(wallet, "ExceedsDailyLimit");
    });

    it("should check recipient whitelist when not empty", async function () {
      const { wallet, owner, recipient } = fixture;
      await wallet.connect(owner).setLimits(0, 0);
      await wallet.connect(owner).addAllowedRecipient(recipient.address);

      // Sending to whitelisted recipient should succeed
      await wallet.connect(owner).execute(recipient.address, 0, "0x");

      // Sending to non-whitelisted address should fail
      await expect(wallet.connect(owner).execute(await receiver.getAddress(), 0, "0x"))
        .to.be.revertedWithCustomError(wallet, "RecipientNotWhitelisted");
    });

    it("should skip whitelist check when list is empty", async function () {
      const { wallet, owner } = fixture;
      await wallet.connect(owner).setLimits(0, 0);
      // No recipients added — whitelist is empty, should allow any recipient
      await wallet.connect(owner).execute(await receiver.getAddress(), 0, "0x");
    });

    it("should reject execution by unauthorized signer", async function () {
      const { wallet, random } = fixture;
      await expect(wallet.connect(random).execute(await receiver.getAddress(), 0, "0x"))
        .to.be.revertedWithCustomError(wallet, "InvalidSigner");
    });

    it("should allow humanController to execute", async function () {
      const { wallet, humanController } = fixture;
      await wallet.connect(humanController).setLimits(0, 0);
      await wallet.connect(humanController).execute(
        await receiver.getAddress(),
        0,
        receiver.interface.encodeFunctionData("setValue", [42])
      );
      expect(await receiver.value()).to.equal(42);
    });

    it("should track daily spending", async function () {
      const { wallet, owner } = fixture;
      await wallet.connect(owner).setLimits(0, 0);
      await wallet.connect(owner).execute(await receiver.getAddress(), ethers.parseEther("0.3"), "0x");
      const spent = await wallet.getDailySpent();
      expect(spent).to.equal(ethers.parseEther("0.3"));
    });

    it("should report remaining daily limit correctly", async function () {
      const { wallet, owner } = fixture;
      await wallet.connect(owner).setLimits(ethers.parseEther("5"), ethers.parseEther("5"));
      await wallet.connect(owner).execute(await receiver.getAddress(), ethers.parseEther("1"), "0x");
      const remaining = await wallet.getRemainingDailyLimit();
      expect(remaining).to.equal(ethers.parseEther("4"));
    });

    it("should return max uint256 when no daily limit set", async function () {
      const { wallet, owner } = fixture;
      await wallet.connect(owner).setLimits(0, 0);
      const remaining = await wallet.getRemainingDailyLimit();
      expect(remaining).to.equal(ethers.MaxUint256);
    });

    it("should return 0 when daily limit fully spent", async function () {
      const { wallet, owner } = fixture;
      await wallet.connect(owner).setLimits(ethers.parseEther("5"), ethers.parseEther("5"));
      await wallet.connect(owner).execute(await receiver.getAddress(), ethers.parseEther("5"), "0x");
      const remaining = await wallet.getRemainingDailyLimit();
      expect(remaining).to.equal(0);
    });
  });
});
