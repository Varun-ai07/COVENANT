const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RevisionManager", function () {
  let revisionManager, owner, client, worker;

  beforeEach(async function () {
    [owner, client, worker] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RevisionManager");
    revisionManager = await Factory.deploy();
    await revisionManager.waitForDeployment();
  });

  it("should have default max revisions of 3", async function () {
    expect(await revisionManager.defaultMaxRevisions()).to.equal(3);
  });

  it("should allow owner to set default max revisions", async function () {
    await revisionManager.setDefaultMaxRevisions(5);
    expect(await revisionManager.defaultMaxRevisions()).to.equal(5);
  });

  it("should allow owner to enable revisions for a task", async function () {
    const tx = await revisionManager.setRevisionAllowed(1, true);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
    expect(await revisionManager.revisionAllowed(1)).to.equal(true);
  });

  it("should allow owner to set per-task max revisions", async function () {
    await revisionManager.setMaxRevisions(1, 5);
    expect(await revisionManager.maxRevisions(1)).to.equal(5);
  });

  it("should reject revision request when not allowed", async function () {
    await expect(
      revisionManager.connect(client).requestRevision(1, "QmFeedback1")
    ).to.be.revertedWith("Revisions not allowed for this task");
  });

  it("should allow revision request when enabled", async function () {
    await revisionManager.setRevisionAllowed(1, true);
    const tx = await revisionManager.connect(client).requestRevision(1, "QmFeedback1");
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
    expect(await revisionManager.getRevisionCount(1)).to.equal(1);
  });

  it("should emit RevisionRequested event", async function () {
    await revisionManager.setRevisionAllowed(1, true);
    await expect(revisionManager.connect(client).requestRevision(1, "QmFeedback1"))
      .to.emit(revisionManager, "RevisionRequested")
      .withArgs(1, 1, client.address, "QmFeedback1");
  });

  it("should allow up to default max revisions (3)", async function () {
    await revisionManager.setRevisionAllowed(1, true);
    for (let i = 0; i < 3; i++) {
      await revisionManager.connect(client).requestRevision(1, `QmFeedback${i}`);
    }
    expect(await revisionManager.getRevisionCount(1)).to.equal(3);
    // 4th should fail
    await expect(
      revisionManager.connect(client).requestRevision(1, "QmFeedback3")
    ).to.be.revertedWith("Max revisions reached");
  });

  it("should allow up to per-task max revisions", async function () {
    await revisionManager.setRevisionAllowed(1, true);
    await revisionManager.setMaxRevisions(1, 2);
    await revisionManager.connect(client).requestRevision(1, "QmFeedback1");
    await revisionManager.connect(client).requestRevision(1, "QmFeedback2");
    await expect(
      revisionManager.connect(client).requestRevision(1, "QmFeedback3")
    ).to.be.revertedWith("Max revisions reached");
  });

  it("should allow worker to submit revision", async function () {
    await revisionManager.setRevisionAllowed(1, true);
    await revisionManager.connect(client).requestRevision(1, "QmFeedback1");

    const tx = await revisionManager.connect(worker).submitRevision(
      1,
      ethers.encodeBytes32String("QmRevised1")
    );
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);

    const rev = await revisionManager.getLatestRevision(1);
    expect(rev.completed).to.equal(true);
    expect(rev.deliverableHash).to.equal(ethers.encodeBytes32String("QmRevised1"));
  });

  it("should emit RevisionCompleted event", async function () {
    await revisionManager.setRevisionAllowed(1, true);
    await revisionManager.connect(client).requestRevision(1, "QmFeedback1");

    const newHash = ethers.encodeBytes32String("QmRevised1");
    await expect(revisionManager.connect(worker).submitRevision(1, newHash))
      .to.emit(revisionManager, "RevisionCompleted")
      .withArgs(1, 1, newHash);
  });

  it("should prevent requester from submitting their own revision", async function () {
    await revisionManager.setRevisionAllowed(1, true);
    await revisionManager.connect(client).requestRevision(1, "QmFeedback1");

    await expect(
      revisionManager.connect(client).submitRevision(1, ethers.encodeBytes32String("QmRevised1"))
    ).to.be.revertedWith("Cannot revise your own request");
  });

  it("should prevent double-submitting same revision", async function () {
    await revisionManager.setRevisionAllowed(1, true);
    await revisionManager.connect(client).requestRevision(1, "QmFeedback1");
    await revisionManager.connect(worker).submitRevision(1, ethers.encodeBytes32String("QmRevised1"));

    await expect(
      revisionManager.connect(worker).submitRevision(1, ethers.encodeBytes32String("QmRevised2"))
    ).to.be.revertedWith("Already completed");
  });

  it("should return correct revision count", async function () {
    await revisionManager.setRevisionAllowed(1, true);
    expect(await revisionManager.getRevisionCount(1)).to.equal(0);

    await revisionManager.connect(client).requestRevision(1, "QmFeedback1");
    expect(await revisionManager.getRevisionCount(1)).to.equal(1);

    await revisionManager.connect(client).requestRevision(1, "QmFeedback2");
    expect(await revisionManager.getRevisionCount(1)).to.equal(2);
  });

  it("should track canRevise correctly", async function () {
    // Not allowed
    expect(await revisionManager.canRevise(1)).to.equal(false);

    // Allowed, no revisions yet
    await revisionManager.setRevisionAllowed(1, true);
    expect(await revisionManager.canRevise(1)).to.equal(true);

    // Max reached
    await revisionManager.setMaxRevisions(1, 1);
    await revisionManager.connect(client).requestRevision(1, "QmFeedback1");
    expect(await revisionManager.canRevise(1)).to.equal(false);
  });

  it("should return revision history", async function () {
    await revisionManager.setRevisionAllowed(1, true);
    await revisionManager.connect(client).requestRevision(1, "QmFeedback1");
    await revisionManager.connect(client).requestRevision(1, "QmFeedback2");

    const revisions = await revisionManager.getRevisions(1);
    expect(revisions.length).to.equal(2);
    expect(revisions[0].feedbackHash).to.equal("QmFeedback1");
    expect(revisions[1].feedbackHash).to.equal("QmFeedback2");
    expect(revisions[0].revisionNumber).to.equal(1);
    expect(revisions[1].revisionNumber).to.equal(2);
  });

  it("should revert getLatestRevision when no revisions exist", async function () {
    await expect(
      revisionManager.getLatestRevision(1)
    ).to.be.revertedWith("No revisions");
  });

  it("should revert submitRevision when no revision requested", async function () {
    await expect(
      revisionManager.connect(worker).submitRevision(1, ethers.encodeBytes32String("QmRevised1"))
    ).to.be.revertedWith("No revision requested");
  });

  it("should allow non-owner to use revision features", async function () {
    // setRevisionAllowed requires owner
    await expect(
      revisionManager.connect(client).setRevisionAllowed(1, true)
    ).to.be.revertedWithCustomError(revisionManager, "OwnableUnauthorizedAccount");

    // But requestRevision and submitRevision are open to anyone
    await revisionManager.setRevisionAllowed(1, true);
    await revisionManager.connect(client).requestRevision(1, "QmFeedback1");
    await revisionManager.connect(worker).submitRevision(1, ethers.encodeBytes32String("QmRevised1"));
  });

  it("should handle multiple tasks independently", async function () {
    await revisionManager.setRevisionAllowed(1, true);
    await revisionManager.setRevisionAllowed(2, true);

    await revisionManager.connect(client).requestRevision(1, "Task1Feedback");
    await revisionManager.connect(client).requestRevision(2, "Task2Feedback");

    expect(await revisionManager.getRevisionCount(1)).to.equal(1);
    expect(await revisionManager.getRevisionCount(2)).to.equal(1);

    const rev1 = await revisionManager.getLatestRevision(1);
    expect(rev1.feedbackHash).to.equal("Task1Feedback");

    const rev2 = await revisionManager.getLatestRevision(2);
    expect(rev2.feedbackHash).to.equal("Task2Feedback");
  });

  it("should support full revision cycle: request -> submit -> request -> submit", async function () {
    await revisionManager.setRevisionAllowed(1, true);

    // First revision cycle
    await revisionManager.connect(client).requestRevision(1, "QmFeedback1");
    await revisionManager.connect(worker).submitRevision(1, ethers.encodeBytes32String("QmRevised1"));

    // Second revision cycle
    await revisionManager.connect(client).requestRevision(1, "QmFeedback2");
    await revisionManager.connect(worker).submitRevision(1, ethers.encodeBytes32String("QmRevised2"));

    expect(await revisionManager.getRevisionCount(1)).to.equal(2);
    const latest = await revisionManager.getLatestRevision(1);
    expect(latest.completed).to.equal(true);
    expect(latest.deliverableHash).to.equal(ethers.encodeBytes32String("QmRevised2"));
  });
});
