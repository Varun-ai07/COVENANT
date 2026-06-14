const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CovenantSettlement V4", function () {
  const MIN_STAKE = ethers.parseEther("0.001");
  const RATE_PER_SECOND = ethers.parseEther("0.000001");
  const DURATION = 3600;
  const RECEIPT_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes("Receipt(address payer,address payee,uint128 amount,uint256 nonce,uint256 chainId)")
  );

  async function deploySettlementFixture() {
    const [owner, payer, payee, other] = await ethers.getSigners();

    const Identity = await ethers.getContractFactory("contracts/v4/CovenantIdentity.sol:CovenantIdentity");
    const identity = await Identity.deploy();
    await identity.initialize(MIN_STAKE, owner.address);

    const Settlement = await ethers.getContractFactory("contracts/v4/CovenantSettlement.sol:CovenantSettlement");
    const settlement = await Settlement.deploy();
    await settlement.initialize(identity.target);

    return { settlement, identity, owner, payer, payee, other };
  }

  async function createStream(settlement, payer, payee) {
    const totalCost = RATE_PER_SECOND * BigInt(DURATION);
    await settlement.connect(payer).createStream(
      payee.address,
      RATE_PER_SECOND,
      DURATION,
      ethers.ZeroAddress,
      { value: totalCost }
    );
    return totalCost;
  }

  describe("Stream Creation", function () {
    it("should create a payment stream", async function () {
      const { settlement, payer, payee } = await loadFixture(deploySettlementFixture);

      await createStream(settlement, payer, payee);

      const stream = await settlement.getStream(1);
      expect(stream.payer).to.equal(payer.address);
      expect(stream.payee).to.equal(payee.address);
      expect(stream.ratePerSecond).to.equal(RATE_PER_SECOND);
      expect(stream.active).to.be.true;
    });

    it("should reject zero rate", async function () {
      const { settlement, payer, payee } = await loadFixture(deploySettlementFixture);

      await expect(
        settlement.connect(payer).createStream(
          payee.address,
          0,
          DURATION,
          ethers.ZeroAddress,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWith("rate must be > 0");
    });
  });

  describe("Stream Withdrawal", function () {
    it("should allow payee to withdraw streamed amount", async function () {
      const { settlement, payer, payee } = await loadFixture(deploySettlementFixture);

      await createStream(settlement, payer, payee);
      await time.increase(100);

      const claimable = await settlement.claimableAmount(1);
      expect(claimable).to.be.greaterThan(0);

      const balanceBefore = await ethers.provider.getBalance(payee.address);
      const tx = await settlement.connect(payee).withdrawStream(1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(payee.address);

      expect(balanceAfter - balanceBefore + gasCost).to.be.closeTo(claimable, ethers.parseEther("0.0001"));
    });
  });

  describe("Receipt Settlement", function () {
    it("should settle a signed receipt", async function () {
      const { settlement, payer, payee } = await loadFixture(deploySettlementFixture);

      const amount = ethers.parseEther("0.01");
      const nonce = 0;
      const chainId = 31337;

      const receiptHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "address", "address", "uint128", "uint256", "uint256"],
          [RECEIPT_TYPEHASH, payer.address, payee.address, amount, nonce, chainId]
        )
      );

      const signature = await payer.signMessage(ethers.getBytes(receiptHash));

      const tx = await settlement.connect(payee).settleReceipt(
        payer.address,
        payee.address,
        amount,
        nonce,
        signature,
        { value: amount }
      );
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });

    it("should reject receipt with invalid signature", async function () {
      const { settlement, payer, payee } = await loadFixture(deploySettlementFixture);

      const amount = ethers.parseEther("0.01");
      const nonce = 0;
      const chainId = 31337;

      const receiptHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "address", "address", "uint128", "uint256", "uint256"],
          [RECEIPT_TYPEHASH, payer.address, payee.address, amount, nonce, chainId]
        )
      );

      const wrongSignature = await payee.signMessage(ethers.getBytes(receiptHash));

      await expect(
        settlement.connect(payee).settleReceipt(
          payer.address,
          payee.address,
          amount,
          nonce,
          wrongSignature,
          { value: amount }
        )
      ).to.be.revertedWith("invalid payer signature");
    });
  });
});
