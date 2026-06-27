const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

const futureTimestamp = async (offsetSeconds = 86400) => {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp + offsetSeconds;
};

describe("V5 REAL USER FLOWS", function () {
  it("Flow 1: Client hires worker → task completed → payment released", async function () {
    const [owner, client, worker] = await ethers.getSigners();
    const IF = await ethers.getContractFactory("CovenantIdentity");
    const identity = await upgrades.deployProxy(IF, [ethers.parseEther("0.001"), owner.address], { kind: "uups" });
    const EF = await ethers.getContractFactory("CovenantEscrow");
    const escrow = await upgrades.deployProxy(EF, [identity.target], { kind: "uups" });

    const deadline = await futureTimestamp(7 * 86400);
    await escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 });
    await escrow.connect(worker).submitWork(1, ethers.ZeroHash);

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const sig = await client.signMessage(ethers.getBytes(ethers.keccak256(ethers.solidityPacked(["uint256", "uint256", "address"], [1, chainId, await escrow.getAddress()]))));

    const b1 = await ethers.provider.getBalance(worker.address);
    await escrow.connect(client).completeTask(1, sig);
    const b2 = await ethers.provider.getBalance(worker.address);
    expect(b2 - b1).to.equal(1000);
  });

  it("Flow 2: Streaming payment", async function () {
    const [owner, payer, payee] = await ethers.getSigners();
    const IF = await ethers.getContractFactory("CovenantIdentity");
    const identity = await upgrades.deployProxy(IF, [ethers.parseEther("0.001"), owner.address], { kind: "uups" });
    const SF = await ethers.getContractFactory("CovenantSettlement");
    const settlement = await upgrades.deployProxy(SF, [identity.target], { kind: "uups" });

    await settlement.connect(payer).createStream(payee.address, 100, 3600, { value: 360000 });
    await ethers.provider.send("evm_increaseTime", [100]);
    await ethers.provider.send("evm_mine");

    const claimable = await settlement.claimableAmount(1);
    expect(claimable).to.be.greaterThan(9000);
    expect(claimable).to.be.lessThanOrEqual(11000);

    await settlement.connect(payee).withdrawStream(1);
    const s = await settlement.getStream(1);
    expect(s.streamed).to.be.greaterThan(0);

    await settlement.connect(payer).cancelStream(1);
    const s2 = await settlement.getStream(1);
    expect(s2.active).to.be.false;
  });

  it("Flow 3: Dispute resolution", async function () {
    const [owner, client, worker, arbiter] = await ethers.getSigners();
    const IF = await ethers.getContractFactory("CovenantIdentity");
    const identity = await upgrades.deployProxy(IF, [ethers.parseEther("0.001"), owner.address], { kind: "uups" });
    const EF = await ethers.getContractFactory("CovenantEscrow");
    const escrow = await upgrades.deployProxy(EF, [identity.target], { kind: "uups" });
    const AF = await ethers.getContractFactory("CovenantArbitration");
    const arbitration = await upgrades.deployProxy(AF, [escrow.target, arbiter.address], { kind: "uups" });
    await escrow.setAuthorizedArbitration(arbitration.target);

    const deadline = await futureTimestamp(7 * 86400);
    await escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 });
    await escrow.connect(worker).submitWork(1, ethers.ZeroHash);
    await escrow.connect(client).disputeTask(1);
    await arbitration.connect(client).createDispute(1, ethers.ZeroHash);

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const sig = await arbiter.signMessage(ethers.getBytes(ethers.keccak256(ethers.solidityPacked(["uint256", "uint8", "uint8", "uint256", "address"], [1, 1, 0, chainId, await arbitration.getAddress()]))));
    await arbitration.connect(arbiter).submitRuling(1, 1, 0, sig);
    const d = await arbitration.getDispute(1);
    expect(d.ruling).to.equal(1);
  });

  it("Flow 4: Attestation lifecycle", async function () {
    const [owner, issuer, subject] = await ethers.getSigners();
    const AF = await ethers.getContractFactory("CovenantAttestation");
    const att = await upgrades.deployProxy(AF, [], { kind: "uups" });
    await att.registerIssuer(issuer.address, "Academy");
    const schema = ethers.keccak256(ethers.toUtf8Bytes("course"));
    await att.registerSchema(schema, "Course");

    const expiry = await futureTimestamp(365 * 86400);
    await att.connect(issuer).attest(subject.address, schema, ethers.ZeroHash, expiry);
    const ids = await att.getAgentAttestations(subject.address);
    const [valid] = await att.verify(ids[0]);
    expect(valid).to.be.true;

    await att.connect(issuer).revoke(ids[0]);
    const [valid2] = await att.verify(ids[0]);
    expect(valid2).to.be.false;
  });

  it("Flow 5: Governance propose and veto", async function () {
    const [owner, guardian, vetoer] = await ethers.getSigners();
    const GF = await ethers.getContractFactory("CovenantGovernance");
    const gov = await upgrades.deployProxy(GF, [guardian.address, vetoer.address, 100], { kind: "uups" });

    await gov.connect(owner).propose(owner.address, "0x", ethers.ZeroHash, 86400);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const sig = await guardian.signMessage(ethers.getBytes(ethers.keccak256(ethers.solidityPacked(["uint256", "uint256", "uint256", "uint256", "address"], [1, 200, 0, chainId, await gov.getAddress()]))));
    await gov.connect(owner).submitVotes(1, 200, 0, sig);
    const p = await gov.getProposal(1);
    expect(p.forVotes).to.equal(200);

    await gov.connect(vetoer).vetoProposal(1);
    const p2 = await gov.getProposal(1);
    expect(p2.status).to.equal(4);
  });

  it("Flow 6: Insurance claim", async function () {
    const [owner, member] = await ethers.getSigners();
    const IF = await ethers.getContractFactory("InsurancePool");
    const ins = await upgrades.deployProxy(IF, [], { kind: "uups" });
    await ins.connect(member).joinPool({ value: ethers.parseEther("0.01") });
    await ins.connect(member).fileClaim(1, ethers.parseEther("0.005"));
    await ins.connect(owner).voteOnClaim(1, true);
    await ins.connect(owner).approveClaim(1);
    await ins.connect(owner).payClaim(1);
    const m = await ins.members(member.address);
    expect(m.totalClaimsReceived).to.equal(ethers.parseEther("0.0025"));
  });

  it("Flow 7: Training marketplace", async function () {
    const [owner, instructor, student] = await ethers.getSigners();
    const TF = await ethers.getContractFactory("TrainingMarketplace");
    const training = await upgrades.deployProxy(TF, [owner.address], { kind: "uups" });
    await training.connect(instructor).createTraining("Course", ethers.parseEther("0.001"));
    await training.connect(student).enroll(1, { value: ethers.parseEther("0.001") });
    const t = await training.trainings(1);
    expect(t.enrollmentCount).to.equal(1);
  });

  it("Flow 8: Revision tracking", async function () {
    const [owner, client, worker] = await ethers.getSigners();
    const RF = await ethers.getContractFactory("RevisionManager");
    const rev = await upgrades.deployProxy(RF, [], { kind: "uups" });
    await rev.setTaskClient(1, client.address);
    await rev.setRevisionAllowed(1, true);
    await rev.connect(client).requestRevision(1, "feedback");
    await rev.connect(worker).submitRevision(1, ethers.keccak256(ethers.toUtf8Bytes("v2")));
    const r = await rev.getLatestRevision(1);
    expect(r.completed).to.be.true;
  });

  it("Flow 9: Batch settlement", async function () {
    const [owner, client, worker] = await ethers.getSigners();
    const IF = await ethers.getContractFactory("CovenantIdentity");
    const identity = await upgrades.deployProxy(IF, [ethers.parseEther("0.001"), owner.address], { kind: "uups" });
    const EF = await ethers.getContractFactory("CovenantEscrow");
    const escrow = await upgrades.deployProxy(EF, [identity.target], { kind: "uups" });
    const deadline = BigInt(await futureTimestamp(7 * 86400));
    const escrowAddr = await escrow.getAddress();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    for (let i = 0; i < 3; i++) {
      const taskId = BigInt(i + 1);
      const amount = BigInt(100 * (i + 1));
      await escrow.connect(client).createTask(worker.address, amount, deadline, ethers.ZeroHash, { value: amount });
      await escrow.connect(worker).submitWork(taskId, ethers.ZeroHash);
    }
    const sigs = [];
    for (let i = 0; i < 3; i++) {
      const taskId = BigInt(i + 1);
      const addrBytes = ethers.getBytes(escrowAddr).slice(0, 20);
      const packed = ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(taskId), 32),
        ethers.zeroPadValue(ethers.toBeHex(chainId), 32),
        addrBytes,
      ]);
      const hash = ethers.keccak256(packed);
      const sig = await client.signMessage(ethers.getBytes(hash));
      sigs.push(sig);
    }
    const b1 = await ethers.provider.getBalance(worker.address);
    await escrow.batchSettle([1n, 2n, 3n], [100n, 200n, 300n], sigs);
    const b2 = await ethers.provider.getBalance(worker.address);
    expect(b2 - b1).to.equal(600n);
  });

  it("Flow 10: Emergency pause/unpause", async function () {
    const [owner, client, worker] = await ethers.getSigners();
    const IF = await ethers.getContractFactory("CovenantIdentity");
    const identity = await upgrades.deployProxy(IF, [ethers.parseEther("0.001"), owner.address], { kind: "uups" });
    const EF = await ethers.getContractFactory("CovenantEscrow");
    const escrow = await upgrades.deployProxy(EF, [identity.target], { kind: "uups" });
    await escrow.pause();
    const deadline = await futureTimestamp(86400);
    await expect(escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 })).to.be.reverted;
    await escrow.unpause();
    await escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 });
    const t = await escrow.getTask(1);
    expect(t.amount).to.equal(1000);
  });
});
