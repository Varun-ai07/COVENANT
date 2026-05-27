const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StakeSlashing", function () {
  let ss, owner, worker, client;

  beforeEach(async function () {
    [owner, worker, client] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("StakeSlashing");
    ss = await Factory.deploy();
    await ss.waitForDeployment();
  });

  it("should accept a stake deposit", async function () {
    const taskId = 1;
    const amount = ethers.parseEther("0.01");
    await ss.connect(worker).depositStake(taskId, { value: amount });
    const stakes = await ss.getStakes(taskId);
    expect(stakes.length).to.equal(1);
    expect(stakes[0].party).to.equal(worker.address);
    expect(stakes[0].amount).to.equal(amount);
  });

  it("should reject zero-value stake", async function () {
    await expect(
      ss.connect(worker).depositStake(1, { value: 0 })
    ).to.be.revertedWith("Must stake something");
  });

  it("should record multiple stakes per task", async function () {
    const taskId = 2;
    const amount = ethers.parseEther("0.01");
    await ss.connect(worker).depositStake(taskId, { value: amount });
    await ss.connect(client).depositStake(taskId, { value: amount });
    const stakes = await ss.getStakes(taskId);
    expect(stakes.length).to.equal(2);
  });

  it("should emit StakeDeposited event", async function () {
    const amount = ethers.parseEther("0.01");
    await expect(ss.connect(worker).depositStake(1, { value: amount }))
      .to.emit(ss, "StakeDeposited")
      .withArgs(1, worker.address, amount);
  });

  it("should slash the loser's stake", async function () {
    const taskId = 3;
    const amount = ethers.parseEther("0.01");
    await ss.connect(worker).depositStake(taskId, { value: amount });
    await ss.connect(client).depositStake(taskId, { value: amount });

    await ss.slashLoser(taskId, worker.address);
    expect(await ss.resolved(taskId)).to.be.true;
    expect(await ss.getTotalSlashed()).to.equal(amount);
  });

  it("should emit StakeSlashed event", async function () {
    const taskId = 4;
    const amount = ethers.parseEther("0.01");
    await ss.connect(worker).depositStake(taskId, { value: amount });

    await expect(ss.slashLoser(taskId, worker.address))
      .to.emit(ss, "StakeSlashed")
      .withArgs(taskId, worker.address, amount);
  });

  it("should reject double resolution", async function () {
    const taskId = 5;
    const amount = ethers.parseEther("0.01");
    await ss.connect(worker).depositStake(taskId, { value: amount });
    await ss.slashLoser(taskId, worker.address);
    await expect(ss.slashLoser(taskId, worker.address)).to.be.revertedWith("Already resolved");
  });

  it("should refund all non-slashed stakes", async function () {
    const taskId = 6;
    const amount = ethers.parseEther("0.01");
    await ss.connect(worker).depositStake(taskId, { value: amount });
    await ss.connect(client).depositStake(taskId, { value: amount });

    await ss.refundAll(taskId);
    expect(await ss.resolved(taskId)).to.be.true;
    // Contract should have zero balance after refund
    const contractBal = await ethers.provider.getBalance(await ss.getAddress());
    expect(contractBal).to.equal(0);
  });

  it("should emit StakeRefunded event", async function () {
    const taskId = 7;
    const amount = ethers.parseEther("0.01");
    await ss.connect(worker).depositStake(taskId, { value: amount });

    await expect(ss.refundAll(taskId))
      .to.emit(ss, "StakeRefunded")
      .withArgs(taskId, worker.address, amount);
  });

  it("should reject refund on already resolved task", async function () {
    const taskId = 8;
    const amount = ethers.parseEther("0.01");
    await ss.connect(worker).depositStake(taskId, { value: amount });
    await ss.refundAll(taskId);
    await expect(ss.refundAll(taskId)).to.be.revertedWith("Already resolved");
  });

  it("should only allow owner to slash or refund", async function () {
    const taskId = 9;
    const amount = ethers.parseEther("0.01");
    await ss.connect(worker).depositStake(taskId, { value: amount });
    await expect(ss.connect(worker).slashLoser(taskId, worker.address)).to.be.reverted;
    await expect(ss.connect(worker).refundAll(taskId)).to.be.reverted;
  });

  it("should withdraw slashed funds to owner", async function () {
    const taskId = 10;
    const amount = ethers.parseEther("0.01");
    await ss.connect(worker).depositStake(taskId, { value: amount });
    await ss.connect(client).depositStake(taskId, { value: amount });

    // Slash one party so funds remain in contract
    await ss.slashLoser(taskId, worker.address);

    // Contract holds all deposited ETH (both stakes) after slashing
    const contractAddr = await ss.getAddress();
    const totalBalance = await ethers.provider.getBalance(contractAddr);
    expect(totalBalance).to.equal(amount * 2n);

    // Owner receives all contract balance (changeEtherBalance accounts for gas)
    await expect(ss.withdrawSlashed()).to.changeEtherBalance(owner, totalBalance);

    // Contract balance should now be zero
    expect(await ethers.provider.getBalance(contractAddr)).to.equal(0);
  });

  it("should revert withdraw with no funds", async function () {
    await expect(ss.withdrawSlashed()).to.be.revertedWith("No funds");
  });

  it("should only allow owner to withdraw slashed funds", async function () {
    const taskId = 11;
    const amount = ethers.parseEther("0.01");
    await ss.connect(worker).depositStake(taskId, { value: amount });
    await ss.slashLoser(taskId, worker.address);
    await expect(ss.connect(worker).withdrawSlashed()).to.be.reverted;
  });
});
