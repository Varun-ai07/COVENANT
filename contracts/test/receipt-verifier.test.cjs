const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("ReceiptVerifier (v1)", function () {
  async function deployFixture() {
    const [owner, issuer, counterparty, nonIssuer] = await ethers.getSigners();
    const Verifier = await ethers.getContractFactory("contracts/ReceiptVerifier.sol:ReceiptVerifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    return { verifier, owner, issuer, counterparty, nonIssuer };
  }

  async function withIssuerFixture() {
    const base = await deployFixture();
    await base.verifier.addAuthorizedIssuer(base.issuer.address);
    return base;
  }

  async function createReceipt(verifier, signer, issuer, cp, typeStr, dataHash) {
    const tx = await verifier.connect(signer).createReceipt(issuer, cp, typeStr, dataHash);
    await tx.wait();
    const ids = await verifier.getReceiptsByAgent(issuer);
    return ids[ids.length - 1];
  }

  describe("Deployment", function () {
    it("should deploy with correct owner", async function () {
      const { verifier, owner } = await loadFixture(deployFixture);
      expect(await verifier.owner()).to.equal(owner.address);
    });
    it("should start with zero receipts", async function () {
      const { verifier } = await loadFixture(deployFixture);
      expect(await verifier.receiptCount()).to.equal(0);
    });
  });

  describe("Authorized Issuer Management", function () {
    it("owner can add authorized issuer", async function () {
      const { verifier, issuer } = await loadFixture(deployFixture);
      await verifier.addAuthorizedIssuer(issuer.address);
      expect(await verifier.authorizedIssuers(issuer.address)).to.be.true;
    });
    it("owner can remove authorized issuer", async function () {
      const { verifier, issuer } = await loadFixture(deployFixture);
      await verifier.addAuthorizedIssuer(issuer.address);
      await verifier.removeAuthorizedIssuer(issuer.address);
      expect(await verifier.authorizedIssuers(issuer.address)).to.be.false;
    });
    it("rejects add from non-owner", async function () {
      const { verifier, issuer } = await loadFixture(deployFixture);
      await expect(
        verifier.connect(issuer).addAuthorizedIssuer(issuer.address)
      ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
    });
  });

  describe("createReceipt", function () {
    it("creates a valid receipt with correct fields", async function () {
      const { verifier, issuer, counterparty } = await loadFixture(withIssuerFixture);
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("proof"));

      const tx = await verifier.connect(issuer).createReceipt(
        issuer.address, counterparty.address, "task_completion", dataHash
      );
      await expect(tx).to.emit(verifier, "ReceiptCreated");

      expect(await verifier.receiptCount()).to.equal(1);

      const receiptId = (await verifier.getReceiptsByAgent(issuer.address))[0];
      const r = await verifier.getReceipt(receiptId);
      expect(r.issuer).to.equal(issuer.address);
      expect(r.counterparty).to.equal(counterparty.address);
      expect(r.interactionType).to.equal("task_completion");
      expect(r.dataHash).to.equal(dataHash);
      expect(r.isValid).to.be.true;
      expect(r.timestamp).to.be.gt(0);
      expect(r.blockNumber).to.be.gt(0);
    });

    it("indexes receipt for both parties", async function () {
      const { verifier, issuer, counterparty } = await loadFixture(withIssuerFixture);
      const receiptId = await createReceipt(
        verifier, issuer, issuer.address, counterparty.address, "work", ethers.keccak256(ethers.toUtf8Bytes("d"))
      );
      expect(await verifier.getAgentReceiptCount(issuer.address)).to.equal(1);
      expect(await verifier.getAgentReceiptCount(counterparty.address)).to.equal(1);
      const issuerIds = await verifier.getReceiptsByAgent(issuer.address);
      const cpIds = await verifier.getReceiptsByAgent(counterparty.address);
      expect(issuerIds[0]).to.equal(receiptId);
      expect(cpIds[0]).to.equal(receiptId);
    });

    it("rejects from non-authorized issuer", async function () {
      const { verifier, issuer, counterparty } = await loadFixture(deployFixture);
      await expect(
        verifier.connect(issuer).createReceipt(
          issuer.address, counterparty.address, "x", ethers.keccak256(ethers.toUtf8Bytes("d"))
        )
      ).to.be.revertedWith("Not authorized issuer");
    });

    it("rejects zero-address issuer", async function () {
      const { verifier, issuer, counterparty } = await loadFixture(withIssuerFixture);
      await expect(
        verifier.connect(issuer).createReceipt(
          ethers.ZeroAddress, counterparty.address, "x", ethers.keccak256(ethers.toUtf8Bytes("d"))
        )
      ).to.be.revertedWith("Invalid issuer");
    });

    it("rejects zero-address counterparty", async function () {
      const { verifier, issuer } = await loadFixture(withIssuerFixture);
      await expect(
        verifier.connect(issuer).createReceipt(
          issuer.address, ethers.ZeroAddress, "x", ethers.keccak256(ethers.toUtf8Bytes("d"))
        )
      ).to.be.revertedWith("Invalid counterparty");
    });

    it("rejects empty interaction type", async function () {
      const { verifier, issuer, counterparty } = await loadFixture(withIssuerFixture);
      await expect(
        verifier.connect(issuer).createReceipt(
          issuer.address, counterparty.address, "", ethers.keccak256(ethers.toUtf8Bytes("d"))
        )
      ).to.be.revertedWith("Type required");
    });

    it("allows owner to create receipts", async function () {
      const { verifier, owner, issuer, counterparty } = await loadFixture(deployFixture);
      await expect(
        verifier.connect(owner).createReceipt(
          issuer.address, counterparty.address, "admin", ethers.keccak256(ethers.toUtf8Bytes("d"))
        )
      ).to.not.be.reverted;
    });
  });

  describe("verifyReceipt", function () {
    it("returns valid for existing receipt", async function () {
      const { verifier, issuer, counterparty } = await loadFixture(withIssuerFixture);
      const receiptId = await createReceipt(
        verifier, issuer, issuer.address, counterparty.address, "test",
        ethers.keccak256(ethers.toUtf8Bytes("proof"))
      );
      const result = await verifier.verifyReceipt(receiptId);
      expect(result[0]).to.be.true;
    });

    it("returns invalid for non-existent receipt", async function () {
      const { verifier } = await loadFixture(deployFixture);
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      const result = await verifier.verifyReceipt(fakeId);
      expect(result[0]).to.be.false;
    });
  });

  describe("invalidateReceipt", function () {
    it("issuer can invalidate own receipt", async function () {
      const { verifier, issuer, counterparty } = await loadFixture(withIssuerFixture);
      const receiptId = await createReceipt(
        verifier, issuer, issuer.address, counterparty.address, "test",
        ethers.keccak256(ethers.toUtf8Bytes("data"))
      );
      await verifier.connect(issuer).invalidateReceipt(receiptId);
      const result = await verifier.verifyReceipt(receiptId);
      expect(result[0]).to.be.false;
    });

    it("owner can invalidate any receipt", async function () {
      const { verifier, owner, issuer, counterparty } = await loadFixture(withIssuerFixture);
      const receiptId = await createReceipt(
        verifier, issuer, issuer.address, counterparty.address, "test",
        ethers.keccak256(ethers.toUtf8Bytes("data"))
      );
      await verifier.connect(owner).invalidateReceipt(receiptId);
      const result = await verifier.verifyReceipt(receiptId);
      expect(result[0]).to.be.false;
    });

    it("rejects invalidation from non-issuer non-owner", async function () {
      const { verifier, issuer, counterparty, nonIssuer } = await loadFixture(withIssuerFixture);
      const receiptId = await createReceipt(
        verifier, issuer, issuer.address, counterparty.address, "test",
        ethers.keccak256(ethers.toUtf8Bytes("data"))
      );
      await expect(
        verifier.connect(nonIssuer).invalidateReceipt(receiptId)
      ).to.be.revertedWith("Not authorized");
    });

    it("rejects invalidation of non-existent receipt", async function () {
      const { verifier, owner } = await loadFixture(deployFixture);
      await expect(
        verifier.connect(owner).invalidateReceipt(ethers.keccak256(ethers.toUtf8Bytes("fake")))
      ).to.be.revertedWith("Receipt not found");
    });
  });

  describe("batchVerifyReceipts", function () {
    it("verifies multiple valid receipts", async function () {
      const { verifier, issuer, counterparty } = await loadFixture(withIssuerFixture);
      const id1 = await createReceipt(verifier, issuer, issuer.address, counterparty.address, "a", ethers.keccak256(ethers.toUtf8Bytes("a")));
      const id2 = await createReceipt(verifier, issuer, counterparty.address, issuer.address, "b", ethers.keccak256(ethers.toUtf8Bytes("b")));
      const results = await verifier.batchVerifyReceipts([id1, id2]);
      expect(results.length).to.equal(2);
      expect(results[0]).to.be.true;
      expect(results[1]).to.be.true;
    });

    it("returns false for invalid receipts", async function () {
      const { verifier, issuer, counterparty } = await loadFixture(withIssuerFixture);
      const id = await createReceipt(verifier, issuer, issuer.address, counterparty.address, "a", ethers.keccak256(ethers.toUtf8Bytes("a")));
      await verifier.connect(issuer).invalidateReceipt(id);
      const results = await verifier.batchVerifyReceipts([id, ethers.keccak256(ethers.toUtf8Bytes("fake"))]);
      expect(results[0]).to.be.false;
      expect(results[1]).to.be.false;
    });
  });

  describe("Read Functions", function () {
    it("getReceiptsByAgent returns agent's receipt IDs", async function () {
      const { verifier, issuer, counterparty } = await loadFixture(withIssuerFixture);
      const receiptId = await createReceipt(verifier, issuer, issuer.address, counterparty.address, "t", ethers.keccak256(ethers.toUtf8Bytes("d")));
      const ids = await verifier.getReceiptsByAgent(issuer.address);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(receiptId);
    });

    it("getAgentReceiptCount returns correct count", async function () {
      const { verifier, issuer, counterparty } = await loadFixture(withIssuerFixture);
      await createReceipt(verifier, issuer, issuer.address, counterparty.address, "a", ethers.keccak256(ethers.toUtf8Bytes("a")));
      await createReceipt(verifier, issuer, issuer.address, counterparty.address, "b", ethers.keccak256(ethers.toUtf8Bytes("b")));
      expect(await verifier.getAgentReceiptCount(issuer.address)).to.equal(2);
    });
  });
});
