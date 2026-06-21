const { expect } = require("chai");
const { ethers } = require("hardhat");

const futureTimestamp = async (offsetSeconds = 86400) => {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp + offsetSeconds;
};

describe("V5 REAL USER FLOWS", function () {
  it("Flow 1: Client hires worker → task completed → payment released", async function () {
    const [owner, client, worker] = await ethers.getSigners();
    const IF = await ethers.getContractFactory("contracts/v5/core/CovenantIdentity.sol:CovenantIdentity");
    const identity = await IF.deploy();
    await identity.initialize(ethers.parseEther("0.001"), owner.address);
    const EF = await ethers.getContractFactory("contracts/v5/core/CovenantEscrow.sol:CovenantEscrow");
    const escrow = await EF.deploy();
    await escrow.initialize(identity.target);

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
    const IF = await ethers.getContractFactory("contracts/v5/core/CovenantIdentity.sol:CovenantIdentity");
    const identity = await IF.deploy();
    await identity.initialize(ethers.parseEther("0.001"), owner.address);
    const SF = await ethers.getContractFactory("contracts/v5/core/CovenantSettlement.sol:CovenantSettlement");
    const settlement = await SF.deploy();
    await settlement.initialize(identity.target);

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
    const IF = await ethers.getContractFactory("contracts/v5/core/CovenantIdentity.sol:CovenantIdentity");
    const identity = await IF.deploy();
    await identity.initialize(ethers.parseEther("0.001"), owner.address);
    const EF = await ethers.getContractFactory("contracts/v5/core/CovenantEscrow.sol:CovenantEscrow");
    const escrow = await EF.deploy();
    await escrow.initialize(identity.target);
    const AF = await ethers.getContractFactory("contracts/v5/core/CovenantArbitration.sol:CovenantArbitration");
    const arbitration = await AF.deploy();
    await arbitration.initialize(escrow.target, arbiter.address);
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
    const AF = await ethers.getContractFactory("contracts/v5/core/CovenantAttestation.sol:CovenantAttestation");
    const att = await AF.deploy();
    await att.initialize();
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
    const GF = await ethers.getContractFactory("contracts/v5/core/CovenantGovernance.sol:CovenantGovernance");
    const gov = await GF.deploy();
    await gov.initialize(guardian.address, vetoer.address, 100);

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
    const IF = await ethers.getContractFactory("contracts/v5/extensions/InsurancePool.sol:InsurancePool");
    const ins = await IF.deploy();
    await ins.initialize();
    await ins.connect(member).joinPool({ value: ethers.parseEther("0.01") });
    await ins.connect(member).fileClaim(1, ethers.parseEther("0.005"));
    await ins.connect(owner).voteOnClaim(1, true);
    await ins.connect(owner).approveClaim(1);
    await ins.connect(owner).payClaim(1);
    const m = await ins.members(member.address);
    expect(m.totalClaimsReceived).to.equal(ethers.parseEther("0.005"));
  });

  it("Flow 7: Training marketplace", async function () {
    const [owner, instructor, student] = await ethers.getSigners();
    const TF = await ethers.getContractFactory("contracts/v5/extensions/TrainingMarketplace.sol:TrainingMarketplace");
    const training = await TF.deploy();
    await training.initialize(owner.address);
    await training.connect(instructor).createTraining("Course", ethers.parseEther("0.001"));
    await training.connect(student).enroll(1, { value: ethers.parseEther("0.001") });
    const t = await training.trainings(1);
    expect(t.enrollmentCount).to.equal(1);
  });

  it("Flow 8: Revision tracking", async function () {
    const [owner, client, worker] = await ethers.getSigners();
    const RF = await ethers.getContractFactory("contracts/v5/extensions/RevisionManager.sol:RevisionManager");
    const rev = await RF.deploy();
    await rev.initialize();
    await rev.setTaskClient(1, client.address);
    await rev.setRevisionAllowed(1, true);
    await rev.connect(client).requestRevision(1, "feedback");
    await rev.connect(worker).submitRevision(1, ethers.keccak256(ethers.toUtf8Bytes("v2")));
    const r = await rev.getLatestRevision(1);
    expect(r.completed).to.be.true;
  });

  it("Flow 9: Batch settlement", async function () {
    const [owner, client, worker] = await ethers.getSigners();
    const IF = await ethers.getContractFactory("contracts/v5/core/CovenantIdentity.sol:CovenantIdentity");
    const identity = await IF.deploy();
    await identity.initialize(ethers.parseEther("0.001"), owner.address);
    const EF = await ethers.getContractFactory("contracts/v5/core/CovenantEscrow.sol:CovenantEscrow");
    const escrow = await EF.deploy();
    await escrow.initialize(identity.target);
    const deadline = await futureTimestamp(7 * 86400);
    for (let i = 0; i < 3; i++) {
      await escrow.connect(client).createTask(worker.address, 100 * (i + 1), deadline, ethers.ZeroHash, { value: 100 * (i + 1) });
      await escrow.connect(worker).submitWork(i + 1, ethers.ZeroHash);
    }
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const sigs = [];
    for (let i = 0; i < 3; i++) {
      sigs.push(await client.signMessage(ethers.getBytes(ethers.keccak256(ethers.solidityPacked(["uint256", "uint256", "address"], [i + 1, chainId, await escrow.getAddress()])))));
    }
    const b1 = await ethers.provider.getBalance(worker.address);
    await escrow.batchSettle([1, 2, 3], [100, 200, 300], sigs);
    const b2 = await ethers.provider.getBalance(worker.address);
    expect(b2 - b1).to.equal(600);
  });

  it("Flow 10: Emergency pause/unpause", async function () {
    const [owner, client, worker] = await ethers.getSigners();
    const IF = await ethers.getContractFactory("contracts/v5/core/CovenantIdentity.sol:CovenantIdentity");
    const identity = await IF.deploy();
    await identity.initialize(ethers.parseEther("0.001"), owner.address);
    const EF = await ethers.getContractFactory("contracts/v5/core/CovenantEscrow.sol:CovenantEscrow");
    const escrow = await EF.deploy();
    await escrow.initialize(identity.target);
    await escrow.pause();
    const deadline = await futureTimestamp(86400);
    await expect(escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 })).to.be.reverted;
    await escrow.unpause();
    await escrow.connect(client).createTask(worker.address, 1000, deadline, ethers.ZeroHash, { value: 1000 });
    const t = await escrow.getTask(1);
    expect(t.amount).to.equal(1000);
  });
});
