const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossChainBridge", function () {
  let bridge, owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CrossChainBridge");
    bridge = await Factory.deploy();
    await bridge.waitForDeployment();
  });

  it("should deploy with supported chains", async function () {
    expect(await bridge.supportedChains(84532)).to.be.true;
    expect(await bridge.supportedChains(8453)).to.be.true;
    expect(await bridge.supportedChains(137)).to.be.true;
    expect(await bridge.supportedChains(42161)).to.be.true;
  });

  it("should set bridge fee", async function () {
    await bridge.setBridgeFee(ethers.parseEther("0.001"));
    expect(await bridge.bridgeFee()).to.equal(ethers.parseEther("0.001"));
  });

  it("should add and remove chains", async function () {
    await bridge.addChain(10);
    expect(await bridge.supportedChains(10)).to.be.true;
    await bridge.removeChain(10);
    expect(await bridge.supportedChains(10)).to.be.false;
  });

  it("should bridge a task", async function () {
    const fee = await bridge.bridgeFee();
    const tx = await bridge.connect(user1).bridgeTask(
      8453, user2.address, ethers.parseEther("0.001"),
      ethers.keccak256(ethers.toUtf8Bytes("task-desc")),
      { value: fee }
    );
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
    expect(await bridge.messageCounter()).to.equal(1);
  });

  it("should reject bridge to unsupported chain", async function () {
    const fee = await bridge.bridgeFee();
    await expect(
      bridge.connect(user1).bridgeTask(999, user2.address, ethers.parseEther("0.001"), ethers.ZeroHash, { value: fee })
    ).to.be.revertedWith("Unsupported chain");
  });

  it("should sync reputation", async function () {
    const tx = await bridge.syncReputation(84532, user1.address, 750, 10, 1, ethers.ZeroHash);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
  });
});
