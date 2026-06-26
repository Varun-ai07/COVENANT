const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("V5 CovenantIdentity", function () {
  let identity, owner, agent1, agent2, oracle;

  beforeEach(async function () {
    [owner, agent1, agent2, oracle] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CovenantIdentity");
    identity = await upgrades.deployProxy(Factory, [ethers.parseEther("0.001"), oracle.address], { kind: "uups" });
    await identity.waitForDeployment();
  });

  it("should register agent with minimum stake", async function () {
    const root = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
    await identity.connect(agent1).register(0, root, { value: ethers.parseEther("0.001") });
    expect(await identity.isRegistered(agent1.address)).to.be.true;
    expect(await identity.totalAgents()).to.equal(1);
  });

  it("should reject registration below minimum stake", async function () {
    await expect(
      identity.connect(agent1).register(0, ethers.ZeroHash, { value: ethers.parseEther("0.0001") })
    ).to.be.reverted;
  });

  it("should reject double registration", async function () {
    await identity.connect(agent1).register(0, ethers.ZeroHash, { value: ethers.parseEther("0.001") });
    await expect(
      identity.connect(agent1).register(0, ethers.ZeroHash, { value: ethers.parseEther("0.001") })
    ).to.be.reverted;
  });

  it("should store correct agent data", async function () {
    const root = ethers.keccak256(ethers.toUtf8Bytes("test"));
    await identity.connect(agent1).register(0, root, { value: ethers.parseEther("0.01") });
    const agent = await identity.getAgent(agent1.address);
    expect(agent.owner).to.equal(agent1.address);
    expect(agent.stake).to.equal(ethers.parseEther("0.01"));
    expect(agent.active).to.be.true;
    expect(agent.metadataRoot).to.equal(root);
  });

  it("should deactivate agent", async function () {
    await identity.connect(agent1).register(0, ethers.ZeroHash, { value: ethers.parseEther("0.001") });
    await identity.connect(agent1).deactivate();
    expect(await identity.isRegistered(agent1.address)).to.be.false;
  });

  it("should reject deactivation of non-registered agent", async function () {
    await expect(identity.connect(agent1).deactivate()).to.be.reverted;
  });

  it("should reject deactivation by non-owner", async function () {
    await identity.connect(agent1).register(0, ethers.ZeroHash, { value: ethers.parseEther("0.001") });
    await expect(identity.connect(agent2).deactivate()).to.be.reverted;
  });

  it("should increase stake", async function () {
    await identity.connect(agent1).register(0, ethers.ZeroHash, { value: ethers.parseEther("0.001") });
    await identity.connect(agent1).increaseStake({ value: ethers.parseEther("0.005") });
    const agent = await identity.getAgent(agent1.address);
    expect(agent.stake).to.equal(ethers.parseEther("0.006"));
  });

  it("should withdraw stake", async function () {
    await identity.connect(agent1).register(0, ethers.ZeroHash, { value: ethers.parseEther("0.01") });
    const balanceBefore = await ethers.provider.getBalance(agent1.address);
    await identity.connect(agent1).withdrawStake(ethers.parseEther("0.005"));
    const balanceAfter = await ethers.provider.getBalance(agent1.address);
    expect(balanceAfter - balanceBefore).to.be.greaterThan(ethers.parseEther("0.004"));
  });

  it("should reject withdrawal below minimum stake", async function () {
    await identity.connect(agent1).register(0, ethers.ZeroHash, { value: ethers.parseEther("0.001") });
    await expect(
      identity.connect(agent1).withdrawStake(ethers.parseEther("0.001"))
    ).to.be.reverted;
  });

  it("should grant and check capability", async function () {
    await identity.connect(agent1).register(0, ethers.ZeroHash, { value: ethers.parseEther("0.001") });
    const capHash = ethers.keccak256(ethers.toUtf8Bytes("code-review"));
    const expiry = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await identity.connect(agent1).grantCapability(agent1.address, capHash, expiry, 1000);
    expect(await identity.hasCapability(agent1.address, capHash)).to.be.true;
  });

  it("should revoke capability", async function () {
    await identity.connect(agent1).register(0, ethers.ZeroHash, { value: ethers.parseEther("0.001") });
    const capHash = ethers.keccak256(ethers.toUtf8Bytes("code-review"));
    const expiry = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await identity.connect(agent1).grantCapability(agent1.address, capHash, expiry, 1000);
    await identity.connect(agent1).revokeCapability(agent1.address, capHash);
    expect(await identity.hasCapability(agent1.address, capHash)).to.be.false;
  });

  it("should reject capability grant by non-owner", async function () {
    await identity.connect(agent1).register(0, ethers.ZeroHash, { value: ethers.parseEther("0.001") });
    const capHash = ethers.keccak256(ethers.toUtf8Bytes("code-review"));
    const expiry = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await expect(
      identity.connect(agent2).grantCapability(agent1.address, capHash, expiry, 1000)
    ).to.be.reverted;
  });
});

describe("V5 CovenantEscrow", function () {
  let escrow, identity, owner, client, worker;

  beforeEach(async function () {
    [owner, client, worker] = await ethers.getSigners();
    const IdentityFactory = await ethers.getContractFactory("CovenantIdentity");
    identity = await upgrades.deployProxy(IdentityFactory, [ethers.parseEther("0.001"), owner.address], { kind: "uups" });
    await identity.waitForDeployment();

    const EscrowFactory = await ethers.getContractFactory("CovenantEscrow");
    escrow = await upgrades.deployProxy(EscrowFactory, [identity.target], { kind: "uups" });
    await escrow.waitForDeployment();
  });

  it("should create task with ETH", async function () {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    const metaHash = ethers.keccak256(ethers.toUtf8Bytes("task"));
    await escrow.connect(client).createTask(worker.address, 1000, deadline, metaHash, { value: 1000 });
    const task = await escrow.getTask(1);
    expect(task.client).to.equal(client.address);
    expect(task.worker).to.equal(worker.address);
    expect(task.amount).to.equal(1000);
  });

  it("should refund excess ETH", async function () {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    const balanceBefore = await ethers.provider.getBalance(client.address);
    await escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 2000 });
    const balanceAfter = await ethers.provider.getBalance(client.address);
    expect(balanceBefore - balanceAfter).to.be.lessThan(ethers.parseEther("0.002"));
  });

  it("should reject deadline too soon", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 100;
    await expect(
      escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 })
    ).to.be.reverted;
  });

  it("should submit work", async function () {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 });
    const deliverable = ethers.keccak256(ethers.toUtf8Bytes("deliverable"));
    await escrow.connect(worker).submitWork(1, deliverable);
    const task = await escrow.getTask(1);
    expect(task.metaHash).to.equal(deliverable);
  });

  it("should reject submission by non-worker", async function () {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 });
    await expect(escrow.connect(client).submitWork(1, ethers.ZeroHash)).to.be.reverted;
  });

  it("should complete task with client signature", async function () {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 });
    await escrow.connect(worker).submitWork(1, ethers.ZeroHash);

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const message = ethers.solidityPacked(["uint256", "uint256", "address"], [1, chainId, await escrow.getAddress()]);
    const hash = ethers.keccak256(message);
    const signature = await client.signMessage(ethers.getBytes(hash));

    const balanceBefore = await ethers.provider.getBalance(worker.address);
    await escrow.connect(client).completeTask(1, signature);
    const balanceAfter = await ethers.provider.getBalance(worker.address);
    expect(balanceAfter - balanceBefore).to.equal(1000);
  });

  it("should reject invalid signature", async function () {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 });
    await escrow.connect(worker).submitWork(1, ethers.ZeroHash);

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const message = ethers.solidityPacked(["uint256", "uint256", "address"], [1, chainId, await escrow.getAddress()]);
    const hash = ethers.keccak256(message);
    const signature = await worker.signMessage(ethers.getBytes(hash));

    await expect(escrow.connect(client).completeTask(1, signature)).to.be.reverted;
  });

  it("should cancel task and refund", async function () {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await escrow.connect(client).createTask(ethers.ZeroAddress, 1000, deadline, ethers.ZeroHash, { value: 1000 });

    const balanceBefore = await ethers.provider.getBalance(client.address);
    const tx = await escrow.connect(client).cancelTask(1);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(client.address);

    expect(balanceAfter + gasCost - balanceBefore).to.equal(1000);
  });

  it("should create dispute", async function () {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 });
    await escrow.connect(worker).submitWork(1, ethers.ZeroHash);
    await escrow.connect(client).disputeTask(1);
    const task = await escrow.getTask(1);
    expect(task.status).to.equal(4);
  });
});

describe("V5 CovenantSettlement", function () {
  let settlement, owner, payer, payee;

  beforeEach(async function () {
    [owner, payer, payee] = await ethers.getSigners();
    const IdentityFactory = await ethers.getContractFactory("CovenantIdentity");
    const identity = await upgrades.deployProxy(IdentityFactory, [ethers.parseEther("0.001"), owner.address], { kind: "uups" });
    await identity.waitForDeployment();

    const SettlementFactory = await ethers.getContractFactory("CovenantSettlement");
    settlement = await upgrades.deployProxy(SettlementFactory, [identity.target], { kind: "uups" });
    await settlement.waitForDeployment();
  });

  it("should create streaming payment", async function () {
    const rate = 100;
    const duration = 3600;
    await settlement.connect(payer).createStream(payee.address, rate, duration, { value: rate * duration });
    const stream = await settlement.getStream(1);
    expect(stream.payer).to.equal(payer.address);
    expect(stream.payee).to.equal(payee.address);
    expect(stream.active).to.be.true;
  });

  it("should withdraw claimable amount", async function () {
    await settlement.connect(payer).createStream(payee.address, 100, 3600, { value: 360000 });
    await ethers.provider.send("evm_increaseTime", [100]);
    await ethers.provider.send("evm_mine");

    const claimable = await settlement.claimableAmount(1);
    expect(claimable).to.be.greaterThan(0);
  });

  it("should cancel stream", async function () {
    await settlement.connect(payer).createStream(payee.address, 100, 3600, { value: 360000 });
    await settlement.connect(payer).cancelStream(1);
    const stream = await settlement.getStream(1);
    expect(stream.active).to.be.false;
  });
});

describe("V5 CovenantArbitration", function () {
  let arbitration, escrow, identity, owner, client, worker, arbiter;

  beforeEach(async function () {
    [owner, client, worker, arbiter] = await ethers.getSigners();
    const IdentityFactory = await ethers.getContractFactory("CovenantIdentity");
    identity = await upgrades.deployProxy(IdentityFactory, [ethers.parseEther("0.001"), owner.address], { kind: "uups" });
    await identity.waitForDeployment();

    const EscrowFactory = await ethers.getContractFactory("CovenantEscrow");
    escrow = await upgrades.deployProxy(EscrowFactory, [identity.target], { kind: "uups" });
    await escrow.waitForDeployment();

    const ArbitrationFactory = await ethers.getContractFactory("CovenantArbitration");
    arbitration = await upgrades.deployProxy(ArbitrationFactory, [escrow.target, arbiter.address], { kind: "uups" });
    await arbitration.waitForDeployment();
    await escrow.setAuthorizedArbitration(arbitration.target);
  });

  it("should create dispute", async function () {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 });
    await escrow.connect(worker).submitWork(1, ethers.ZeroHash);
    await arbitration.connect(client).createDispute(1, ethers.ZeroHash);
    expect(await arbitration.disputeCount()).to.equal(1);
  });

  it("should stake for dispute", async function () {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 });
    await escrow.connect(worker).submitWork(1, ethers.ZeroHash);
    await arbitration.connect(client).createDispute(1, ethers.ZeroHash);
    await arbitration.connect(client).stakeForDispute(1, { value: ethers.parseEther("0.01") });
    const dispute = await arbitration.getDispute(1);
    expect(dispute.clientStake).to.equal(ethers.parseEther("0.01"));
  });

  it("should submit ruling", async function () {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 });
    await escrow.connect(worker).submitWork(1, ethers.ZeroHash);
    await arbitration.connect(client).createDispute(1, ethers.ZeroHash);

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const message = ethers.solidityPacked(["uint256", "uint8", "uint8", "uint256", "address"], [1, 2, 0, chainId, await arbitration.getAddress()]);
    const hash = ethers.keccak256(message);
    const signature = await arbiter.signMessage(ethers.getBytes(hash));
    await arbitration.connect(arbiter).submitRuling(1, 2, 0, signature);
    const dispute = await arbitration.getDispute(1);
    expect(dispute.ruling).to.equal(2);
  });
});

describe("V5 CovenantAttestation", function () {
  let attestation, owner, issuer, subject;

  beforeEach(async function () {
    [owner, issuer, subject] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CovenantAttestation");
    attestation = await upgrades.deployProxy(Factory, [], { kind: "uups" });
    await attestation.waitForDeployment();
    await attestation.registerIssuer(issuer.address, "Test");
    const schemaHash = ethers.keccak256(ethers.toUtf8Bytes("task-completion"));
    await attestation.registerSchema(schemaHash, "Task");
  });

  it("should create attestation", async function () {
    const schemaHash = ethers.keccak256(ethers.toUtf8Bytes("task-completion"));
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("data"));
    const expiresAt = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await attestation.connect(issuer).attest(subject.address, schemaHash, dataHash, expiresAt);
    expect(await attestation.attestationCount()).to.equal(1);
  });

  it("should batch attest", async function () {
    const schemaHash = ethers.keccak256(ethers.toUtf8Bytes("task-completion"));
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("data"));
    const expiresAt = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await attestation.connect(issuer).attestBatch([subject.address, owner.address], schemaHash, [dataHash, dataHash], expiresAt);
    expect(await attestation.attestationCount()).to.equal(2);
  });

  it("should revoke and verify", async function () {
    const schemaHash = ethers.keccak256(ethers.toUtf8Bytes("task-completion"));
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("data"));
    const expiresAt = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await attestation.connect(issuer).attest(subject.address, schemaHash, dataHash, expiresAt);
    const attIds = await attestation.getAgentAttestations(subject.address);
    await attestation.connect(issuer).revoke(attIds[0]);
    const [valid] = await attestation.verify(attIds[0]);
    expect(valid).to.be.false;
  });
});

describe("V5 CovenantGovernance", function () {
  let governance, owner, guardian, vetoer;

  beforeEach(async function () {
    [owner, guardian, vetoer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CovenantGovernance");
    governance = await upgrades.deployProxy(Factory, [guardian.address, vetoer.address, 100], { kind: "uups" });
    await governance.waitForDeployment();
  });

  it("should create proposal", async function () {
    await governance.connect(owner).propose(owner.address, "0x", ethers.ZeroHash, 86400);
    expect(await governance.proposalCount()).to.equal(1);
  });

  it("should submit votes", async function () {
    await governance.connect(owner).propose(owner.address, "0x", ethers.ZeroHash, 86400);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const message = ethers.solidityPacked(["uint256", "uint256", "uint256", "uint256", "address"], [1, 100, 0, chainId, await governance.getAddress()]);
    const hash = ethers.keccak256(message);
    const signature = await guardian.signMessage(ethers.getBytes(hash));
    await governance.connect(owner).submitVotes(1, 100, 0, signature);
    const proposal = await governance.getProposal(1);
    expect(proposal.forVotes).to.equal(100);
  });

  it("should allow vetoer to veto", async function () {
    await governance.connect(owner).propose(owner.address, "0x", ethers.ZeroHash, 86400);
    await governance.connect(vetoer).vetoProposal(1);
    const proposal = await governance.getProposal(1);
    expect(proposal.status).to.equal(4);
  });
});
