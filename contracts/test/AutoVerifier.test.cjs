const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AutoVerifier", function () {
  let verifier, owner, authVerifier, unauthorized;

  const EvidenceHash = "0x" + "ab".repeat(32);
  const EvidenceHash2 = "0x" + "cd".repeat(32);

  beforeEach(async function () {
    [owner, authVerifier, unauthorized] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AutoVerifier");
    verifier = await Factory.deploy();
    await verifier.waitForDeployment();
  });

  it("should deploy with owner as authorized verifier", async function () {
    expect(await verifier.authorizedVerifiers(owner.address)).to.be.true;
    expect(await verifier.passThreshold()).to.equal(70);
  });

  it("should authorize and deauthorize verifiers", async function () {
    await verifier.authorizeVerifier(authVerifier.address, true);
    expect(await verifier.authorizedVerifiers(authVerifier.address)).to.be.true;

    await verifier.authorizeVerifier(authVerifier.address, false);
    expect(await verifier.authorizedVerifiers(authVerifier.address)).to.be.false;
  });

  it("should reject address(0) in authorizeVerifier", async function () {
    await expect(
      verifier.authorizeVerifier(ethers.ZeroAddress, true)
    ).to.be.revertedWith("Invalid address");
  });

  it("should submit a single verification with auto-calculated verdict", async function () {
    // score 85 >= 70 threshold → Pass (2)
    const tx = await verifier.submitVerification(1, 85, EvidenceHash);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);

    const v = await verifier.getVerification(1);
    expect(v.taskId).to.equal(1);
    expect(v.score).to.equal(85);
    expect(v.verdict).to.equal(2); // Pass
    expect(v.evidenceHash).to.equal(EvidenceHash);
    expect(v.verifier).to.equal(owner.address);
    expect(v.exists).to.be.true;

    expect(await verifier.isVerified(1)).to.be.true;
    expect(await verifier.getScore(1)).to.equal(85);
    expect(await verifier.getVerdict(1)).to.equal(2);
    expect(await verifier.verificationCount(1)).to.equal(1);
  });

  it("should auto-calculate Partial verdict for mid-range scores", async function () {
    // score 50: 50 < 70, 50 >= 35 (70/2) → Partial (1)
    await verifier.submitVerification(1, 50, EvidenceHash);
    expect(await verifier.getVerdict(1)).to.equal(1); // Partial
    expect(await verifier.isVerified(1)).to.be.false;
  });

  it("should auto-calculate Fail verdict for low scores", async function () {
    // score 20: 20 < 70, 20 < 35 (70/2) → Fail (0)
    await verifier.submitVerification(1, 20, EvidenceHash);
    expect(await verifier.getVerdict(1)).to.equal(0); // Fail
    expect(await verifier.isVerified(1)).to.be.false;
  });

  it("should reject unauthorized verifier", async function () {
    await expect(
      verifier.connect(unauthorized).submitVerification(1, 85, EvidenceHash)
    ).to.be.revertedWith("Not authorized");
  });

  it("should reject score > 100", async function () {
    await expect(
      verifier.submitVerification(1, 101, EvidenceHash)
    ).to.be.revertedWith("Score must be 0-100");
  });

  it("should handle batch verification", async function () {
    const taskIds = [10, 20, 30];
    const scores = [90, 60, 75];
    const verdicts = [2, 0, 1]; // Pass, Fail, Partial
    const hashes = [EvidenceHash, EvidenceHash2, EvidenceHash];

    const tx = await verifier.batchVerify(taskIds, scores, verdicts, hashes);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);

    expect(await verifier.getScore(10)).to.equal(90);
    expect(await verifier.getVerdict(10)).to.equal(2);
    expect(await verifier.isVerified(10)).to.be.true;

    expect(await verifier.getScore(20)).to.equal(60);
    expect(await verifier.getVerdict(20)).to.equal(0);
    expect(await verifier.isVerified(20)).to.be.false;

    expect(await verifier.getScore(30)).to.equal(75);
    expect(await verifier.getVerdict(30)).to.equal(1);
    expect(await verifier.isVerified(30)).to.be.false;
  });

  it("should reject empty batch", async function () {
    await expect(
      verifier.batchVerify([], [], [], [])
    ).to.be.revertedWith("Empty batch");
  });

  it("should reject batch with duplicate taskId", async function () {
    await verifier.batchVerify([10], [80], [2], [EvidenceHash]);
    await expect(
      verifier.batchVerify([10], [90], [2], [EvidenceHash2])
    ).to.be.revertedWith("Duplicate taskId");
  });

  it("should reject batch with mismatched lengths", async function () {
    await expect(
      verifier.batchVerify([1, 2], [80], [2], [EvidenceHash])
    ).to.be.revertedWith("Length mismatch");
  });

  it("should reject batch with score > 100", async function () {
    await expect(
      verifier.batchVerify([1], [101], [2], [EvidenceHash])
    ).to.be.revertedWith("Score must be 0-100");
  });

  it("should update threshold", async function () {
    const tx = await verifier.setThreshold(80);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
    expect(await verifier.passThreshold()).to.equal(80);
  });

  it("should reject non-owner threshold update", async function () {
    await expect(
      verifier.connect(unauthorized).setThreshold(80)
    ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
  });

  it("should overwrite previous verification for same taskId via submitVerification", async function () {
    await verifier.submitVerification(1, 50, EvidenceHash);
    expect(await verifier.getScore(1)).to.equal(50);

    await verifier.submitVerification(1, 95, EvidenceHash2);
    expect(await verifier.getScore(1)).to.equal(95);
    expect(await verifier.getVerdict(1)).to.equal(2); // 95 >= 70 → Pass
    expect(await verifier.verificationCount(1)).to.equal(2);
  });

  it("should return default values for unverified task", async function () {
    const v = await verifier.getVerification(999);
    expect(v.taskId).to.equal(0);
    expect(v.score).to.equal(0);
    expect(v.verdict).to.equal(0);
    expect(v.exists).to.be.false;
    expect(await verifier.isVerified(999)).to.be.false;
  });

  it("should emit Verified event", async function () {
    await expect(verifier.submitVerification(1, 85, EvidenceHash))
      .to.emit(verifier, "Verified")
      .withArgs(1, 85, 2, EvidenceHash, owner.address);
  });

  it("should emit ThresholdUpdated event", async function () {
    await expect(verifier.setThreshold(80))
      .to.emit(verifier, "ThresholdUpdated")
      .withArgs(70, 80);
  });

  it("should emit VerifierAuthorized event", async function () {
    await expect(verifier.authorizeVerifier(authVerifier.address, true))
      .to.emit(verifier, "VerifierAuthorized")
      .withArgs(authVerifier.address, true);
  });
});
