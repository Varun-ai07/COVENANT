const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ClientReputation", function () {
  let rep, owner, client, worker, authorizedCaller;

  beforeEach(async function () {
    [owner, client, worker, authorizedCaller] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ClientReputation");
    rep = await Factory.deploy();
    await rep.waitForDeployment();
    // Authorize a caller for testing
    await rep.setAuthorizedCaller(authorizedCaller.address, true);
  });

  it("should record an approval decision from authorized caller", async function () {
    const tx = await rep.connect(authorizedCaller).recordDecision(client.address, true);
    await tx.wait();
    const stats = await rep.getClientStats(client.address);
    expect(stats.totalDecisions).to.equal(1);
    expect(stats.approvals).to.equal(1);
    expect(stats.rejections).to.equal(0);
    expect(stats.approvalRate).to.equal(10000); // 100%
  });

  it("should record a rejection decision from owner", async function () {
    const tx = await rep.connect(owner).recordDecision(client.address, false);
    await tx.wait();
    const stats = await rep.getClientStats(client.address);
    expect(stats.totalDecisions).to.equal(1);
    expect(stats.rejections).to.equal(1);
    expect(stats.approvalRate).to.equal(0); // 0%
  });

  it("should compute approval rate correctly over multiple decisions", async function () {
    await rep.connect(authorizedCaller).recordDecision(client.address, true);
    await rep.connect(authorizedCaller).recordDecision(client.address, false);
    await rep.connect(authorizedCaller).recordDecision(client.address, true);
    // 2 approvals / 3 total = 6666 bps
    const stats = await rep.getClientStats(client.address);
    expect(stats.totalDecisions).to.equal(3);
    expect(stats.approvals).to.equal(2);
    expect(stats.approvalRate).to.equal(6666);
  });

  it("should return approvalRate via getApprovalRate", async function () {
    await rep.connect(authorizedCaller).recordDecision(client.address, true);
    await rep.connect(authorizedCaller).recordDecision(client.address, true);
    expect(await rep.getApprovalRate(client.address)).to.equal(10000);
  });

  it("should not flag as bad faith with fewer than 10 decisions", async function () {
    // 9 decisions, all rejections -> 0% rate but < 10 decisions
    for (let i = 0; i < 9; i++) {
      await rep.connect(authorizedCaller).recordDecision(client.address, false);
    }
    expect(await rep.isBadFaith(client.address)).to.be.false;
  });

  it("should flag as bad faith with >= 10 decisions and < 30% approval", async function () {
    // 10 decisions, 2 approvals (20%) -> bad faith
    for (let i = 0; i < 8; i++) {
      await rep.connect(authorizedCaller).recordDecision(client.address, false);
    }
    for (let i = 0; i < 2; i++) {
      await rep.connect(authorizedCaller).recordDecision(client.address, true);
    }
    expect(await rep.isBadFaith(client.address)).to.be.true;
  });

  it("should not flag as bad faith with >= 30% approval rate", async function () {
    // 10 decisions, 3 approvals (30%) -> not bad faith
    for (let i = 0; i < 7; i++) {
      await rep.connect(authorizedCaller).recordDecision(client.address, false);
    }
    for (let i = 0; i < 3; i++) {
      await rep.connect(authorizedCaller).recordDecision(client.address, true);
    }
    expect(await rep.isBadFaith(client.address)).to.be.false;
  });

  it("should emit DecisionRecorded event", async function () {
    await expect(rep.connect(authorizedCaller).recordDecision(client.address, true))
      .to.emit(rep, "DecisionRecorded")
      .withArgs(client.address, true);
  });

  it("should track lastDecision timestamp", async function () {
    const tx = await rep.connect(authorizedCaller).recordDecision(client.address, true);
    await tx.wait();
    const stats = await rep.getClientStats(client.address);
    expect(stats.lastDecision).to.be.gt(0);
  });

  it("should reject unauthorized callers", async function () {
    await expect(
      rep.connect(worker).recordDecision(client.address, true)
    ).to.be.revertedWith("Not authorized");
  });

  it("should allow owner to record decisions", async function () {
    await rep.connect(owner).recordDecision(client.address, true);
    const stats = await rep.getClientStats(client.address);
    expect(stats.totalDecisions).to.equal(1);
  });

  it("should allow owner to set authorized callers", async function () {
    await rep.setAuthorizedCaller(worker.address, true);
    expect(await rep.authorizedCallers(worker.address)).to.be.true;
  });

  it("should emit AuthorizedCallerUpdated event", async function () {
    await expect(rep.setAuthorizedCaller(worker.address, true))
      .to.emit(rep, "AuthorizedCallerUpdated")
      .withArgs(worker.address, true);
  });

  it("should reject non-owner from setting authorized callers", async function () {
    await expect(
      rep.connect(worker).setAuthorizedCaller(worker.address, true)
    ).to.be.reverted;
  });
});
