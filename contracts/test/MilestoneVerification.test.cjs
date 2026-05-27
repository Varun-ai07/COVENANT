const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MilestoneVerification", function () {
  let mv, owner, worker, other;

  beforeEach(async function () {
    [owner, worker, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MilestoneVerification");
    mv = await Factory.deploy();
    await mv.waitForDeployment();
    // Set worker for task 1 (owner submits as default)
  });

  it("should submit a milestone from owner", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("deliverable-1"));
    await mv.submitMilestone(1, 0, hash);
    const m = await mv.getMilestone(1, 0);
    expect(m.deliverableHash).to.equal(hash);
    expect(m.verified).to.be.false;
    expect(m.approved).to.be.false;
  });

  it("should submit a milestone from authorized worker", async function () {
    await mv.setTaskWorker(1, worker.address);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("deliverable-1"));
    await mv.connect(worker).submitMilestone(1, 0, hash);
    const m = await mv.getMilestone(1, 0);
    expect(m.deliverableHash).to.equal(hash);
  });

  it("should reject unauthorized submitter", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("deliverable-1"));
    await expect(
      mv.connect(other).submitMilestone(1, 0, hash)
    ).to.be.revertedWith("Not authorized");
  });

  it("should reject duplicate submission for same index", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("d1"));
    await mv.submitMilestone(1, 0, hash);
    await expect(
      mv.submitMilestone(1, 0, hash)
    ).to.be.revertedWith("Already submitted");
  });

  it("should emit MilestoneSubmitted event", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("deliverable-1"));
    await expect(mv.submitMilestone(1, 0, hash))
      .to.emit(mv, "MilestoneSubmitted")
      .withArgs(1, 0, hash);
  });

  it("should track milestone count", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("d1"));
    await mv.submitMilestone(1, 0, hash);
    await mv.submitMilestone(1, 1, hash);
    await mv.submitMilestone(1, 2, hash);
    expect(await mv.getMilestoneCount(1)).to.equal(3);
  });

  it("should verify a submitted milestone", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("d1"));
    await mv.submitMilestone(1, 0, hash);
    await mv.verifyMilestone(1, 0, 85, true);
    const m = await mv.getMilestone(1, 0);
    expect(m.verified).to.be.true;
    expect(m.approved).to.be.true;
    expect(m.score).to.equal(85);
  });

  it("should emit MilestoneVerified event", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("d1"));
    await mv.submitMilestone(1, 0, hash);
    await expect(mv.verifyMilestone(1, 0, 90, true))
      .to.emit(mv, "MilestoneVerified")
      .withArgs(1, 0, 90, true);
  });

  it("should reject verifying a milestone that was not submitted", async function () {
    await expect(mv.verifyMilestone(1, 0, 80, true)).to.be.revertedWith("Not submitted");
  });

  it("should reject double verification", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("d1"));
    await mv.submitMilestone(1, 0, hash);
    await mv.verifyMilestone(1, 0, 80, true);
    await expect(mv.verifyMilestone(1, 0, 90, false)).to.be.revertedWith("Already verified");
  });

  it("should enforce approvalThreshold when approving", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("d1"));
    await mv.submitMilestone(1, 0, hash);
    // Default threshold is 70, score 60 should fail
    await expect(mv.verifyMilestone(1, 0, 60, true)).to.be.revertedWith("Score below threshold");
  });

  it("should allow approval when score meets threshold", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("d1"));
    await mv.submitMilestone(1, 0, hash);
    await mv.verifyMilestone(1, 0, 70, true);
    const m = await mv.getMilestone(1, 0);
    expect(m.approved).to.be.true;
  });

  it("should allow rejection regardless of score", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("d1"));
    await mv.submitMilestone(1, 0, hash);
    // Score below threshold but rejected — should succeed
    await mv.verifyMilestone(1, 0, 30, false);
    const m = await mv.getMilestone(1, 0);
    expect(m.approved).to.be.false;
    expect(m.verified).to.be.true;
  });

  it("should approve allMilestonesApproved when all pass", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("d1"));
    await mv.submitMilestone(1, 0, hash);
    await mv.submitMilestone(1, 1, hash);
    await mv.verifyMilestone(1, 0, 80, true);
    await mv.verifyMilestone(1, 1, 90, true);
    expect(await mv.allMilestonesApproved(1)).to.be.true;
  });

  it("should return false for allMilestonesApproved if one fails", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("d1"));
    await mv.submitMilestone(1, 0, hash);
    await mv.submitMilestone(1, 1, hash);
    await mv.verifyMilestone(1, 0, 80, true);
    await mv.verifyMilestone(1, 1, 50, false);
    expect(await mv.allMilestonesApproved(1)).to.be.false;
  });

  it("should return false for allMilestonesApproved with no milestones", async function () {
    expect(await mv.allMilestonesApproved(1)).to.be.false;
  });

  it("should default approvalThreshold to 70", async function () {
    expect(await mv.approvalThreshold()).to.equal(70);
  });

  it("should allow owner to change approvalThreshold", async function () {
    await mv.setApprovalThreshold(80);
    expect(await mv.approvalThreshold()).to.equal(80);
  });

  it("should emit ApprovalThresholdUpdated event", async function () {
    await expect(mv.setApprovalThreshold(85))
      .to.emit(mv, "ApprovalThresholdUpdated")
      .withArgs(70, 85);
  });

  it("should only allow owner to set threshold", async function () {
    await expect(mv.connect(worker).setApprovalThreshold(80)).to.be.reverted;
  });

  it("should allow owner to set task worker", async function () {
    await mv.setTaskWorker(1, worker.address);
    expect(await mv.taskWorkers(1)).to.equal(worker.address);
  });
});
