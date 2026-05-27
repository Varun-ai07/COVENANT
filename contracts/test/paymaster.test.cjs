const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CovenantPaymaster", function () {
  let owner, admin, user1, user2, targetContract, recipient;
  let paymaster;

  before(async function () {
    [owner, admin, user1, user2, targetContract, recipient] =
      await ethers.getSigners();

    const CovenantPaymaster = await ethers.getContractFactory(
      "contracts/v2/core/CovenantPaymaster.sol:CovenantPaymaster"
    );
    paymaster = await CovenantPaymaster.deploy();
    await paymaster.waitForDeployment();
  });

  // ─── Funding ──────────────────────────────────────────────────

  describe("Depositing ETH", function () {
    it("should accept deposits via deposit()", async function () {
      const tx = await paymaster.connect(owner).deposit({
        value: ethers.parseEther("0.5"),
      });
      await tx.wait();

      const balance = await paymaster.getPaymasterBalance();
      expect(balance).to.equal(ethers.parseEther("0.5"));
    });

    it("should track totalDeposited", async function () {
      expect(await paymaster.totalDeposited()).to.equal(
        ethers.parseEther("0.5")
      );
    });

    it("should accept deposits via receive()", async function () {
      const tx = await owner.sendTransaction({
        to: await paymaster.getAddress(),
        value: ethers.parseEther("0.1"),
      });
      await tx.wait();

      const balance = await paymaster.getPaymasterBalance();
      expect(balance).to.equal(ethers.parseEther("0.6"));
    });

    it("should emit PaymasterFunded event", async function () {
      await expect(
        paymaster.connect(user1).deposit({ value: ethers.parseEther("0.01") })
      )
        .to.emit(paymaster, "PaymasterFunded")
        .withArgs(user1.address, ethers.parseEther("0.01"));
    });

    it("should reject zero-value deposit", async function () {
      await expect(
        paymaster.connect(owner).deposit({ value: 0 })
      ).to.be.revertedWith("Must deposit > 0");
    });
  });

  // ─── Withdrawal ───────────────────────────────────────────────

  describe("Withdrawing ETH", function () {
    it("should allow admin to withdraw", async function () {
      const balanceBefore = await ethers.provider.getBalance(
        recipient.address
      );
      await paymaster
        .connect(owner)
        .withdraw(recipient.address, ethers.parseEther("0.05"));
      const balanceAfter = await ethers.provider.getBalance(
        recipient.address
      );

      expect(balanceAfter - balanceBefore).to.equal(
        ethers.parseEther("0.05")
      );
    });

    it("should update totalDeposited after withdraw", async function () {
      // Deposited: 0.5 + 0.1 + 0.01 = 0.61, withdrew 0.05 => 0.56
      expect(await paymaster.totalDeposited()).to.equal(
        ethers.parseEther("0.56")
      );
    });

    it("should reject withdraw to zero address", async function () {
      await expect(
        paymaster
          .connect(owner)
          .withdraw(ethers.ZeroAddress, ethers.parseEther("0.01"))
      ).to.be.revertedWith("Invalid recipient");
    });

    it("should reject withdraw exceeding balance", async function () {
      await expect(
        paymaster
          .connect(owner)
          .withdraw(recipient.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("should reject withdraw from non-admin", async function () {
      await expect(
        paymaster
          .connect(user1)
          .withdraw(recipient.address, ethers.parseEther("0.01"))
      ).to.be.reverted;
    });
  });

  // ─── Gas Limits ───────────────────────────────────────────────

  describe("Setting gas limits", function () {
    it("should have default maxGasPerOp of 500000 wei", async function () {
      expect(await paymaster.maxGasPerOp()).to.equal(500_000);
    });

    it("should have default user budget of 0.01 ETH", async function () {
      expect(await paymaster.defaultUserBudget()).to.equal(
        ethers.parseEther("0.01")
      );
    });

    it("should allow admin to update maxGasPerOp", async function () {
      await paymaster.connect(owner).setMaxGasPerOp(1_000_000);
      expect(await paymaster.maxGasPerOp()).to.equal(1_000_000);
    });

    it("should emit MaxGasPerOpSet event", async function () {
      await expect(paymaster.connect(owner).setMaxGasPerOp(750_000))
        .to.emit(paymaster, "MaxGasPerOpSet")
        .withArgs(1_000_000, 750_000);
    });

    it("should reject setting maxGasPerOp to 0", async function () {
      await expect(
        paymaster.connect(owner).setMaxGasPerOp(0)
      ).to.be.revertedWith("Must be > 0");
    });

    it("should allow admin to update defaultUserBudget", async function () {
      await paymaster
        .connect(owner)
        .setDefaultUserBudget(ethers.parseEther("0.02"));
      expect(await paymaster.defaultUserBudget()).to.equal(
        ethers.parseEther("0.02")
      );
    });

    it("should emit DefaultUserBudgetSet event", async function () {
      await expect(
        paymaster
          .connect(owner)
          .setDefaultUserBudget(ethers.parseEther("0.01"))
      )
        .to.emit(paymaster, "DefaultUserBudgetSet")
        .withArgs(ethers.parseEther("0.02"), ethers.parseEther("0.01"));
    });

    it("should reject gas limit changes from non-admin", async function () {
      await expect(
        paymaster.connect(user1).setMaxGasPerOp(200_000)
      ).to.be.reverted;
    });
  });

  // ─── Allowed Targets ──────────────────────────────────────────

  describe("Allowed targets", function () {
    it("should allow admin to set allowed target", async function () {
      await paymaster
        .connect(owner)
        .setAllowedTarget(targetContract.address, true);
      expect(await paymaster.allowedTargets(targetContract.address)).to.be
        .true;
    });

    it("should emit AllowedTargetSet event", async function () {
      await expect(
        paymaster.connect(owner).setAllowedTarget(user2.address, true)
      )
        .to.emit(paymaster, "AllowedTargetSet")
        .withArgs(user2.address, true);
    });

    it("should allow removing a target", async function () {
      await paymaster
        .connect(owner)
        .setAllowedTarget(user2.address, false);
      expect(await paymaster.allowedTargets(user2.address)).to.be.false;
    });

    it("should reject zero address as target", async function () {
      await expect(
        paymaster.connect(owner).setAllowedTarget(ethers.ZeroAddress, true)
      ).to.be.revertedWith("Invalid target");
    });
  });

  // ─── Per-User Budget Tracking ─────────────────────────────────

  describe("Per-user sponsorship budgets", function () {
    it("should return full default budget for new user", async function () {
      const remaining = await paymaster.getRemainingBudget(user1.address);
      expect(remaining).to.equal(ethers.parseEther("0.01"));
    });

    it("should allow admin to set custom user budget", async function () {
      await paymaster
        .connect(owner)
        .setUserBudget(user1.address, ethers.parseEther("0.05"));
      expect(await paymaster.userBudget(user1.address)).to.equal(
        ethers.parseEther("0.05")
      );
    });

    it("should return custom budget when set", async function () {
      const remaining = await paymaster.getRemainingBudget(user1.address);
      expect(remaining).to.equal(ethers.parseEther("0.05"));
    });

    it("should emit UserBudgetSet event", async function () {
      await expect(
        paymaster
          .connect(owner)
          .setUserBudget(user2.address, ethers.parseEther("0.03"))
      )
        .to.emit(paymaster, "UserBudgetSet")
        .withArgs(user2.address, ethers.parseEther("0.03"));
    });

    it("should track gasSpent after postOp", async function () {
      // Simulate a postOp call with encoded context
      // user1 spent 0.001 ETH worth of gas
      const context = abiEncodeContext(user1.address, ethers.parseEther("0.01"));

      await paymaster.connect(owner).postOp(0, context, ethers.parseEther("0.001"));

      const spent = await paymaster.userGasSpent(user1.address);
      expect(spent).to.equal(ethers.parseEther("0.001"));
    });

    it("should report correct remaining budget after spending", async function () {
      // user1 has custom budget of 0.05, spent 0.001 => remaining = 0.049
      const remaining = await paymaster.getRemainingBudget(user1.address);
      expect(remaining).to.equal(ethers.parseEther("0.049"));
    });

    it("should cap gasSpent to sponsorAmount", async function () {
      // actualGasCost (0.08) > sponsorAmount (0.01), should cap to sponsorAmount
      const context = abiEncodeContext(user2.address, ethers.parseEther("0.01"));
      await paymaster.connect(owner).postOp(0, context, ethers.parseEther("0.08"));

      const spent = await paymaster.userGasSpent(user2.address);
      // postOp caps: cost = min(actualGasCost, sponsorAmount) = min(0.08, 0.01) = 0.01
      expect(spent).to.equal(ethers.parseEther("0.01"));
    });

    it("should return 0 remaining when budget exhausted", async function () {
      // user2 has custom budget of 0.03, spent 0.01 from cap test
      // Spend more to exhaust: postOp with sponsorAmount=0.03, actualGasCost=0.03
      const context = abiEncodeContext(user2.address, ethers.parseEther("0.03"));
      await paymaster.connect(owner).postOp(0, context, ethers.parseEther("0.03"));

      const remaining = await paymaster.getRemainingBudget(user2.address);
      expect(remaining).to.equal(0);
    });

    it("should reject setUserBudget for zero address", async function () {
      await expect(
        paymaster
          .connect(owner)
          .setUserBudget(ethers.ZeroAddress, ethers.parseEther("0.01"))
      ).to.be.revertedWith("Invalid user");
    });
  });

  // ─── Activation ───────────────────────────────────────────────

  describe("Activation", function () {
    it("should be active by default", async function () {
      expect(await paymaster.isActive()).to.be.true;
    });

    it("should allow admin to deactivate", async function () {
      await paymaster.connect(owner).setActive(false);
      expect(await paymaster.isActive()).to.be.false;
    });

    it("should emit PaymasterActivated event", async function () {
      await expect(paymaster.connect(owner).setActive(true))
        .to.emit(paymaster, "PaymasterActivated")
        .withArgs(true);
    });
  });

  // ─── wouldSponsor view ───────────────────────────────────────

  describe("wouldSponsor", function () {
    it("should return true for allowed target + sponsored selector", async function () {
      // Set up: allow the target first
      await paymaster.connect(owner).setAllowedTarget(targetContract.address, true);
      // register(string,string[]) selector = 0xaeeb4032
      const registerSelector = "0xaeeb4032";
      const result = await paymaster.wouldSponsor(
        targetContract.address,
        registerSelector
      );
      expect(result).to.be.true;
    });

    it("should return false for disallowed target", async function () {
      const registerSelector = "0x97a0286c";
      const result = await paymaster.wouldSponsor(
        user2.address,
        registerSelector
      );
      expect(result).to.be.false;
    });

    it("should return false when paymaster is deactivated", async function () {
      await paymaster.connect(owner).setActive(false);
      const registerSelector = "0x97a0286c";
      const result = await paymaster.wouldSponsor(
        targetContract.address,
        registerSelector
      );
      expect(result).to.be.false;

      // Re-activate
      await paymaster.connect(owner).setActive(true);
    });
  });

  // ─── AccessControl ────────────────────────────────────────────

  describe("AccessControl", function () {
    it("should grant ADMIN_ROLE to deployer", async function () {
      const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
      expect(await paymaster.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should allow admin to grant ADMIN_ROLE to others", async function () {
      const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
      await paymaster.connect(owner).grantRole(ADMIN_ROLE, admin.address);
      expect(await paymaster.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("should allow granted admin to perform admin operations", async function () {
      await paymaster.connect(admin).setMaxGasPerOp(600_000);
      expect(await paymaster.maxGasPerOp()).to.equal(600_000);
    });
  });
});

// ─── Helper ────────────────────────────────────────────────────

/**
 * Encode context as the paymaster does: abi.encode(sender, sponsorAmount)
 */
function abiEncodeContext(sender, sponsorAmount) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256"],
    [sender, sponsorAmount]
  );
}
