import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("CapabilityVerifier", function () {
  // Standard Groth16Verifier from Circom — accepts proof components and public signals
  const MOCK_PA = [1n, 2n];
  const MOCK_PB = [[3n, 4n], [5n, 6n]];
  const MOCK_PC = [7n, 8n];
  const MOCK_PUB_SIGNALS = [0n, 0n, 0n, 0n, 0n];

  async function deployFixture() {
    const [owner, agent] = await ethers.getSigners();

    // Deploy the Groth16Verifier (the CapabilityVerifier version with IC1-IC5 for 5 signals)
    const Groth16Verifier = await ethers.getContractFactory("contracts/CapabilityVerifier.sol:Groth16Verifier");
    const groth16 = await Groth16Verifier.deploy();

    // Deploy the wrapper that adds authorization
    const CapabilityVerifier = await ethers.getContractFactory("CapabilityVerifier");
    const verifierContract = await CapabilityVerifier.deploy(await groth16.getAddress());

    return { verifierContract, groth16, owner, agent };
  }

  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      const { verifierContract } = await loadFixture(deployFixture);
      expect(await verifierContract.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("should have correct owner", async function () {
      const { verifierContract, owner } = await loadFixture(deployFixture);
      expect(await verifierContract.owner()).to.equal(owner.address);
    });
  });

  describe("Authorization", function () {
    it("should allow owner to add authorized issuer", async function () {
      const { verifierContract, owner, agent } = await loadFixture(deployFixture);
      await verifierContract.connect(owner).addAuthorizedIssuer(agent.address);
      expect(await verifierContract.authorizedIssuers(agent.address)).to.equal(true);
    });

    it("should reject non-owner adding authorized issuer", async function () {
      const { verifierContract, agent } = await loadFixture(deployFixture);
      await expect(verifierContract.connect(agent).addAuthorizedIssuer(agent.address))
        .to.be.reverted;
    });

    it("should allow owner to remove authorized issuer", async function () {
      const { verifierContract, owner, agent } = await loadFixture(deployFixture);
      await verifierContract.connect(owner).addAuthorizedIssuer(agent.address);
      await verifierContract.connect(owner).removeAuthorizedIssuer(agent.address);
      expect(await verifierContract.authorizedIssuers(agent.address)).to.equal(false);
    });
  });

  describe("Proof Verification", function () {
    it("should reject proof from unauthorized issuer", async function () {
      const { verifierContract, agent } = await loadFixture(deployFixture);
      await expect(
        verifierContract.connect(agent).verifyCapabilityProof(MOCK_PA, MOCK_PB, MOCK_PC, MOCK_PUB_SIGNALS)
      ).to.be.revertedWith("Not authorized");
    });

    it("should return false for invalid/zero proof from authorized issuer", async function () {
      const { verifierContract, owner, agent } = await loadFixture(deployFixture);
      await verifierContract.connect(owner).addAuthorizedIssuer(agent.address);

      // Groth16 verification should fail for dummy proof — returns false, not revert
      const result = await verifierContract.connect(agent).verifyCapabilityProof(
        MOCK_PA, MOCK_PB, MOCK_PC, MOCK_PUB_SIGNALS
      );
      expect(result).to.equal(false);
    });

    it("should reject zero proof as invalid", async function () {
      const { verifierContract, owner } = await loadFixture(deployFixture);
      const zeroSignals = [0n, 0n, 0n, 0n, 0n];
      const result = await verifierContract.verifyProof(
        [0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n], zeroSignals
      );
      expect(result).to.equal(false);
    });

    it("should reject proof with out-of-field values", async function () {
      const { verifierContract, owner } = await loadFixture(deployFixture);
      const largeVal = 21888242871839275222246405745257275088548364400416034343698204186575808495618n;

      const result = await verifierContract.verifyProof(
        [largeVal, largeVal],
        [[largeVal, largeVal], [largeVal, largeVal]],
        [largeVal, largeVal],
        [0n, 0n, 0n, 0n, 0n]
      );
      expect(result).to.equal(false);
    });
  });
});
