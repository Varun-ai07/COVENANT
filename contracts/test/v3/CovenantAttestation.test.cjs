const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CovenantAttestation V3", function () {
  const SCHEMA_HASH = ethers.keccak256(ethers.toUtf8Bytes("reputation"));
  const DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("score:800"));

  async function deployAttestationFixture() {
    const [owner, issuer, subject, other] = await ethers.getSigners();

    const Attestation = await ethers.getContractFactory("contracts/v3/CovenantAttestation.sol:CovenantAttestation");
    const attestation = await Attestation.deploy();
    await attestation.initialize();

    await attestation.registerSchema(SCHEMA_HASH, "reputation");
    await attestation.registerIssuer(issuer.address, "trusted-oracle");

    return { attestation, owner, issuer, subject, other };
  }

  describe("Attestation Issuance", function () {
    it("should issue an attestation", async function () {
      const { attestation, issuer, subject } = await loadFixture(deployAttestationFixture);
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;

      const tx = await attestation.connect(issuer).attest(
        subject.address,
        SCHEMA_HASH,
        DATA_HASH,
        expiresAt
      );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      const attestationId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "bytes32", "bytes32", "uint256", "uint256"],
        [issuer.address, subject.address, SCHEMA_HASH, DATA_HASH, receipt.blockNumber, 1]
      ));
    });

    it("should reject attestation from non-issuer", async function () {
      const { attestation, other, subject } = await loadFixture(deployAttestationFixture);
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;

      await expect(
        attestation.connect(other).attest(
          subject.address,
          SCHEMA_HASH,
          DATA_HASH,
          expiresAt
        )
      ).to.be.revertedWith("not authorized issuer");
    });

    it("should reject attestation with unregistered schema", async function () {
      const { attestation, issuer, subject } = await loadFixture(deployAttestationFixture);
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;
      const unknownSchema = ethers.keccak256(ethers.toUtf8Bytes("unknown"));

      await expect(
        attestation.connect(issuer).attest(
          subject.address,
          unknownSchema,
          DATA_HASH,
          expiresAt
        )
      ).to.be.revertedWith("schema not registered");
    });
  });

  describe("Batch Attestation", function () {
    it("should issue batch attestations", async function () {
      const { attestation, issuer, subject } = await loadFixture(deployAttestationFixture);
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;

      const subjects = [subject.address, subject.address];
      const dataHashes = [DATA_HASH, ethers.keccak256(ethers.toUtf8Bytes("score:900"))];

      const tx = await attestation.connect(issuer).attestBatch(
        subjects,
        SCHEMA_HASH,
        dataHashes,
        expiresAt
      );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });
  });

  describe("Revocation", function () {
    it("should allow issuer to revoke attestation", async function () {
      const { attestation, issuer, subject } = await loadFixture(deployAttestationFixture);
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;

      await attestation.connect(issuer).attest(
        subject.address,
        SCHEMA_HASH,
        DATA_HASH,
        expiresAt
      );

      const attestationIds = await attestation.getAgentAttestations(subject.address);
      await attestation.connect(issuer).revoke(attestationIds[0]);

      const [valid] = await attestation.verify(attestationIds[0]);
      expect(valid).to.be.false;
    });

    it("should allow owner to revoke any attestation", async function () {
      const { attestation, issuer, subject, owner } = await loadFixture(deployAttestationFixture);
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;

      await attestation.connect(issuer).attest(
        subject.address,
        SCHEMA_HASH,
        DATA_HASH,
        expiresAt
      );

      const attestationIds = await attestation.getAgentAttestations(subject.address);
      await attestation.connect(owner).revoke(attestationIds[0]);

      const [valid] = await attestation.verify(attestationIds[0]);
      expect(valid).to.be.false;
    });
  });

  describe("Verification", function () {
    it("should verify valid attestation", async function () {
      const { attestation, issuer, subject } = await loadFixture(deployAttestationFixture);
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;

      await attestation.connect(issuer).attest(
        subject.address,
        SCHEMA_HASH,
        DATA_HASH,
        expiresAt
      );

      const attestationIds = await attestation.getAgentAttestations(subject.address);
      const [valid, att] = await attestation.verify(attestationIds[0]);

      expect(valid).to.be.true;
      expect(att.issuer).to.equal(issuer.address);
      expect(att.subject).to.equal(subject.address);
    });
  });

  describe("Agent Attestations", function () {
    it("should return all attestations for an agent", async function () {
      const { attestation, issuer, subject } = await loadFixture(deployAttestationFixture);
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;

      await attestation.connect(issuer).attest(subject.address, SCHEMA_HASH, DATA_HASH, expiresAt);
      await attestation.connect(issuer).attest(subject.address, SCHEMA_HASH, DATA_HASH, expiresAt);

      const attestations = await attestation.getAgentAttestations(subject.address);
      expect(attestations.length).to.equal(2);
    });
  });
});
