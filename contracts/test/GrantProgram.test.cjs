const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GrantProgram", function () {
  let grantProgram, owner, applicant, voter;

  beforeEach(async function () {
    [owner, applicant, voter] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("GrantProgram");
    grantProgram = await Factory.deploy(owner.address);
    await grantProgram.waitForDeployment();
    // Fund treasury
    await owner.sendTransaction({ to: await grantProgram.getAddress(), value: ethers.parseEther("1") });
  });

  it("should create a grant", async function () {
    const tx = await grantProgram.connect(applicant).createGrant(
      "Ecosystem Fund", "Build tools", 0, ethers.parseEther("0.1")
    );
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
    expect(await grantProgram.getGrantCount()).to.equal(1);
  });

  it("should vote on grant", async function () {
    await grantProgram.connect(applicant).createGrant(
      "Ecosystem Fund", "Build tools", 0, ethers.parseEther("0.1")
    );
    await grantProgram.connect(voter).voteOnGrant(0, true);
    const grant = await grantProgram.getGrant(0);
    expect(grant.votesFor).to.equal(1);
  });

  it("should finalize grant as approved", async function () {
    await grantProgram.connect(applicant).createGrant(
      "Ecosystem Fund", "Build tools", 0, ethers.parseEther("0.1")
    );
    await grantProgram.connect(voter).voteOnGrant(0, true);
    // Fast forward past voting period
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine");
    await grantProgram.finalizeGrant(0);
    const grant = await grantProgram.getGrant(0);
    expect(grant.status).to.equal(2); // Approved
  });

  it("should fund approved grant", async function () {
    await grantProgram.connect(applicant).createGrant(
      "Ecosystem Fund", "Build tools", 0, ethers.parseEther("0.1")
    );
    await grantProgram.connect(voter).voteOnGrant(0, true);
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine");
    await grantProgram.finalizeGrant(0);
    await grantProgram.fundGrant(0);
    const grant = await grantProgram.getGrant(0);
    expect(grant.status).to.equal(4); // Funded
  });

  it("should track treasury", async function () {
    const treasury = await grantProgram.getTreasury();
    expect(treasury).to.equal(ethers.parseEther("1"));
  });
});
