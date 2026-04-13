import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("ReceiptVerifier", function () {
  let verifier;
  let owner, issuer, counterparty, unauthorized;

  beforeEach(async function () {
    [owner, issuer, counterparty, unauthorized] = await ethers.getSigners();

    const Verifier = await ethers.getContractFactory("ReceiptVerifier");
    verifier = await Verifier.deploy();

    await verifier.addAuthorizedIssuer(issuer.address);
  });

  describe("Receipt Creation", function () {
    it("should create a receipt", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));

      await verifier
        .connect(issuer)
        .createReceipt(
          issuer.address,
          counterparty.address,
          "task_completion",
          dataHash
        );

      expect(await verifier.receiptCount()).to.equal(1);
    });

    it("should emit ReceiptCreated event", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));

      await expect(
        verifier
          .connect(issuer)
          .createReceipt(
            issuer.address,
            counterparty.address,
            "task_completion",
            dataHash
          )
      ).to.emit(verifier, "ReceiptCreated");
    });

    it("should index receipts by agent", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));

      await verifier
        .connect(issuer)
        .createReceipt(
          issuer.address,
          counterparty.address,
          "task_completion",
          dataHash
        );

      const issuerReceipts = await verifier.getReceiptsByAgent(issuer.address);
      const counterpartyReceipts = await verifier.getReceiptsByAgent(
        counterparty.address
      );

      expect(issuerReceipts).to.have.lengthOf(1);
      expect(counterpartyReceipts).to.have.lengthOf(1);
    });

    it("should reject unauthorized issuers", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));

      await expect(
        verifier
          .connect(unauthorized)
          .createReceipt(
            issuer.address,
            counterparty.address,
            "task_completion",
            dataHash
          )
      ).to.be.revertedWith("Not authorized issuer");
    });
  });

  describe("Receipt Verification", function () {
    it("should verify a valid receipt", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
      await verifier
        .connect(issuer)
        .createReceipt(
          issuer.address,
          counterparty.address,
          "task_completion",
          dataHash
        );

      const agentReceipts = await verifier.getReceiptsByAgent(issuer.address);
      const [isValid] = await verifier.verifyReceipt(agentReceipts[0]);
      expect(isValid).to.be.true;
    });

    it("should track multiple receipts for an agent", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
      await verifier
        .connect(issuer)
        .createReceipt(issuer.address, counterparty.address, "task_completion", dataHash);
      await verifier
        .connect(issuer)
        .createReceipt(issuer.address, counterparty.address, "service_delivery", dataHash);

      const allReceipts = await verifier.getReceiptsByAgent(issuer.address);
      expect(allReceipts.length).to.equal(2);

      // Verify each receipt individually
      const [isValid1] = await verifier.verifyReceipt(allReceipts[0]);
      const [isValid2] = await verifier.verifyReceipt(allReceipts[1]);
      expect(isValid1).to.be.true;
      expect(isValid2).to.be.true;
    });
  });

  describe("Authorization", function () {
    it("should allow owner to add authorized issuers", async function () {
      await verifier.addAuthorizedIssuer(unauthorized.address);
      expect(await verifier.authorizedIssuers(unauthorized.address)).to.be.true;
    });

    it("should allow owner to remove authorized issuers", async function () {
      await verifier.removeAuthorizedIssuer(issuer.address);
      expect(await verifier.authorizedIssuers(issuer.address)).to.be.false;
    });
  });
});
