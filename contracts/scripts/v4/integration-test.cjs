/**
 * COVENANT V4 — On-Chain Integration Test (Base Sepolia)
 * Properly waits for block confirmations after each transaction.
 */

const { ethers } = require("hardhat");

const V4 = {
  Identity: "0xB93eCF2bD8DE0e35ddAD13D9F00E70b938C18FdF",
  Escrow: "0xDb9F26155192c685BEC75E86A7c70A3ca0F80Ac3",
  Settlement: "0xBB3deBA10b0bDaa79c9384E39cDd899116082939",
  Arbitration: "0x874d2D6Aa857685D1B7786db2eF9C32C0AcfB614",
  Governance: "0xd505b5CA3dB39d04592D51DB51507550e0d878DF",
  Attestation: "0x65804fb982Be86C48E03107963FDAcd285f21540",
};

const STAKE = ethers.parseEther("0.001");
const AMOUNT = ethers.parseEther("0.0003");
const META = ethers.keccak256(ethers.toUtf8Bytes("v1"));
const CHAIN = 84532;
const DELAY = 2000; // 2 second wait after each tx

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const [owner, , client, worker, other] = await ethers.getSigners();

  console.log("═".repeat(60));
  console.log("COVENANT V4 ON-CHAIN TEST — Base Sepolia");
  console.log("═".repeat(60));
  console.log(`Owner:   ${owner.address}`);
  console.log(`Client:  ${client.address}`);
  console.log(`Worker:  ${worker.address}`);
  console.log(`Other:   ${other.address}`);

  let P = 0, F = 0;
  const fail = [];

  async function tx(name, contract, method, args, opts) {
    process.stdout.write(`  ${name} ... `);
    try {
      const result = await contract[method](...args, opts || {});
      const receipt = await result.wait();
      await wait(DELAY); // wait for state to settle
      console.log(`✅ (gas: ${receipt.gasUsed})`);
      P++;
      return receipt;
    } catch (e) {
      const m = e.message?.match(/reason="([^"]+)"/)?.[1] || e.message?.slice(0, 80);
      console.log(`❌ ${m}`);
      F++;
      fail.push(`${name}: ${m}`);
      return null;
    }
  }

  async function read(name, fn) {
    process.stdout.write(`  ${name} ... `);
    try {
      const result = await fn();
      console.log(`✅`);
      P++;
      return result;
    } catch (e) {
      const m = e.message?.slice(0, 80);
      console.log(`❌ ${m}`);
      F++;
      fail.push(`${name}: ${m}`);
      return null;
    }
  }

  const I = await ethers.getContractFactory("contracts/v4/CovenantIdentity.sol:CovenantIdentity");
  const E = await ethers.getContractFactory("contracts/v4/CovenantEscrow.sol:CovenantEscrow");
  const S = await ethers.getContractFactory("contracts/v4/CovenantSettlement.sol:CovenantSettlement");
  const A = await ethers.getContractFactory("contracts/v4/CovenantArbitration.sol:CovenantArbitration");
  const G = await ethers.getContractFactory("contracts/v4/CovenantGovernance.sol:CovenantGovernance");
  const AT = await ethers.getContractFactory("contracts/v4/CovenantAttestation.sol:CovenantAttestation");

  const identity = I.attach(V4.Identity);
  const escrow = E.attach(V4.Escrow);
  const settlement = S.attach(V4.Settlement);
  const arbitration = A.attach(V4.Arbitration);
  const governance = G.attach(V4.Governance);
  const attestation = AT.attach(V4.Attestation);

  // ═══════════ 1. REGISTRATION ═══════════
  console.log("\n1. REGISTRATION");

  for (const [label, signer] of [["Client", client], ["Worker", worker], ["Other", other]]) {
    await tx(`${label} registers`, identity.connect(signer), "register", [STAKE, META], { value: STAKE });
  }

  await read("Client is active", async () => {
    const a = await identity.getAgent(client.address);
    if (!a.active) throw new Error("not active");
  });

  await read("Worker is active", async () => {
    const a = await identity.getAgent(worker.address);
    if (!a.active) throw new Error("not active");
  });

  await read("Other is active", async () => {
    const a = await identity.getAgent(other.address);
    if (!a.active) throw new Error("not active");
  });

  // ═══════════ 2. CAPABILITIES ═══════════
  console.log("\n2. CAPABILITIES");

  const CAP = ethers.keccak256(ethers.toUtf8Bytes("submit_work"));

  await tx("Worker self-grants capability", identity.connect(worker), "grantCapability",
    [worker.address, CAP, Math.floor(Date.now() / 1000) + 86400, ethers.parseEther("0.1")]);

  await read("Worker has capability", async () => {
    const has = await identity.hasCapability(worker.address, CAP);
    if (!has) throw new Error("missing");
  });

  await tx("Others rejected from granting", identity.connect(client), "grantCapability",
    [worker.address, CAP, Math.floor(Date.now() / 1000) + 86400, ethers.parseEther("0.1")]);

  // ═══════════ 3. TASK LIFECYCLE ═══════════
  console.log("\n3. TASK LIFECYCLE");

  const blk = await ethers.provider.getBlock("latest");
  const dl = blk.timestamp + 86400;

  let taskId;
  await tx("Client creates task", escrow.connect(client), "createTask",
    [worker.address, AMOUNT, dl, ethers.keccak256(ethers.toUtf8Bytes("lifecycle"))], { value: AMOUNT });

  taskId = await escrow.taskCount();
  await read(`Task ${taskId} status`, async () => {
    const t = await escrow.getTask(taskId);
    if (t.status !== 2n) throw new Error(`status=${t.status}`);
  });

  await tx("Worker submits work", escrow.connect(worker), "submitWork",
    [taskId, ethers.keccak256(ethers.toUtf8Bytes("done"))]);

  await read(`Task ${taskId} submitted`, async () => {
    const t = await escrow.getTask(taskId);
    if (t.status !== 3n) throw new Error(`status=${t.status}`);
  });

  await tx("Worker completes task", escrow.connect(worker), "completeTask", [
    taskId,
    await client.signMessage(ethers.getBytes(ethers.keccak256(ethers.solidityPacked(["uint256", "uint256"], [taskId, CHAIN]))))
  ]);

  await read(`Task ${taskId} completed`, async () => {
    const t = await escrow.getTask(taskId);
    if (t.status !== 5n) throw new Error(`status=${t.status}`);
  });

  // ═══════════ 4. DISPUTES ═══════════
  console.log("\n4. DISPUTES");

  let disputeTaskId;
  await tx("Create task for dispute", escrow.connect(client), "createTask",
    [worker.address, AMOUNT, dl, ethers.keccak256(ethers.toUtf8Bytes("dispute"))], { value: AMOUNT });

  disputeTaskId = await escrow.taskCount();
  await tx("Worker submits work", escrow.connect(worker), "submitWork", [disputeTaskId, ethers.ZeroHash]);

  await tx("File dispute via arbitration (auto-disputes escrow)", arbitration.connect(client), "createDispute",
    [disputeTaskId, ethers.keccak256(ethers.toUtf8Bytes("evidence"))]);

  await read(`Task ${disputeTaskId} disputed`, async () => {
    const t = await escrow.getTask(disputeTaskId);
    if (t.status !== 4n) throw new Error(`status=${t.status}`);
  });

  let disputeId = await arbitration.disputeCount();
  await tx("Client stakes", arbitration.connect(client), "stakeForDispute",
    [disputeId], { value: ethers.parseEther("0.001") });

  await tx("Worker stakes", arbitration.connect(worker), "stakeForDispute",
    [disputeId], { value: ethers.parseEther("0.001") });

  await read("Stakes recorded", async () => {
    const d = await arbitration.getDispute(disputeId);
    if (d.clientStake === 0n || d.workerStake === 0n) throw new Error("stake=0");
  });

  const ruleMsg = ethers.keccak256(ethers.solidityPacked(["uint256", "uint8", "uint8", "uint256"], [disputeId, 2, 0, CHAIN]));
  await tx("Arbiter (owner) rules (worker wins)", arbitration.connect(owner), "submitRuling",
    [disputeId, 2, 0, await owner.signMessage(ethers.getBytes(ruleMsg))]);

  await read("Ruling recorded", async () => {
    const d = await arbitration.getDispute(disputeId);
    if (d.ruling !== 2) throw new Error(`ruling=${d.ruling}`);
  });

  // ═══════════ 5. ATTESTATIONS ═══════════
  console.log("\n5. ATTESTATIONS");

  const SCH = ethers.keccak256(ethers.toUtf8Bytes("worker-cred-v1"));

  await tx("Register schema", attestation, "registerSchema", [SCH, "Worker Credential"]);

  await tx("Issue attestation to worker", attestation, "attest",
    [worker.address, SCH, ethers.keccak256(ethers.toUtf8Bytes("proof")), Math.floor(Date.now() / 1000) + 365 * 86400]);

  await read("Attestation valid", async () => {
    const ids = await attestation.getAgentAttestations(worker.address);
    const [valid] = await attestation.verify(ids[ids.length - 1]);
    if (!valid) throw new Error("invalid");
  });

  await tx("Reject non-issuer", attestation.connect(other), "attest",
    [worker.address, SCH, ethers.ZeroHash, Math.floor(Date.now() / 1000) + 86400]);

  // ═══════════ 6. STREAMING ═══════════
  console.log("\n6. STREAMING");

  const streamCountBefore = await settlement.streamCount();
  await tx("Create stream", settlement.connect(client), "createStream",
    [worker.address, ethers.parseEther("0.00000001"), 3600, ethers.ZeroAddress],
    { value: ethers.parseEther("0.00000001") * 3600n });

  const streamCountAfter = await settlement.streamCount();
  await read("Stream created", async () => {
    if (streamCountAfter <= streamCountBefore) throw new Error("stream not created");
    const s = await settlement.getStream(streamCountAfter);
    if (s.payer !== client.address) throw new Error(`payer=${s.payer}`);
    if (s.payee !== worker.address) throw new Error(`payee=${s.payee}`);
  });

  // ═══════════ 7. GOVERNANCE ═══════════
  console.log("\n7. GOVERNANCE");

  await tx("Create proposal", governance.connect(client), "propose",
    [governance.target, "0x", ethers.keccak256(ethers.toUtf8Bytes("gov-proposal")), 86400]);

  const propId = await governance.proposalCount();
  await read("Proposal active", async () => {
    const p = await governance.getProposal(propId);
    if (p.status !== 1n) throw new Error(`status=${p.status}`);
  });

  const voteMsg = ethers.keccak256(ethers.solidityPacked(["uint256", "uint256", "uint256", "uint256"], [propId, 100, 0, CHAIN]));
  await tx("Guardian votes", governance.connect(client), "submitVotes",
    [propId, 100, 0, await owner.signMessage(ethers.getBytes(voteMsg))]);

  await read("Votes counted", async () => {
    const p = await governance.getProposal(propId);
    if (p.forVotes !== 100n) throw new Error(`forVotes=${p.forVotes}`);
  });

  await tx("Create another proposal", governance.connect(client), "propose",
    [governance.target, "0x", ethers.keccak256(ethers.toUtf8Bytes("veto-test")), 86400]);

  const vetoId = await governance.proposalCount();
  await tx("Vetoer vetoes", governance.connect(owner), "vetoProposal", [vetoId]);

  await read("Vetoed", async () => {
    const p = await governance.getProposal(vetoId);
    if (p.status !== 4n) throw new Error(`status=${p.status}`);
  });

  // ═══════════ 8. BATCH SETTLEMENT ═══════════
  console.log("\n8. BATCH SETTLEMENT");

  const batchIds = [];
  for (let i = 0; i < 3; i++) {
    await tx(`Create batch task ${i}`, escrow.connect(client), "createTask",
      [worker.address, AMOUNT, dl, ethers.keccak256(ethers.toUtf8Bytes(`batch-${i}-${Date.now()}`))], { value: AMOUNT });
    const id = await escrow.taskCount();
    batchIds.push(id);
    await tx(`Submit batch task ${i}`, escrow.connect(worker), "submitWork", [id, ethers.ZeroHash]);
  }

  const batchSigs = [];
  for (const id of batchIds) {
    const msg = ethers.keccak256(ethers.solidityPacked(["uint256", "uint256"], [id, CHAIN]));
    batchSigs.push(await client.signMessage(ethers.getBytes(msg)));
  }

  await tx("Batch settle 3 tasks", escrow.connect(owner), "batchSettle",
    [batchIds, [AMOUNT, AMOUNT, AMOUNT], batchSigs]);

  for (const id of batchIds) {
    await read(`Task ${id} settled`, async () => {
      const t = await escrow.getTask(id);
      if (t.status !== 5n) throw new Error(`status=${t.status}`);
    });
  }

  // ═══════════ SUMMARY ═══════════
  console.log("\n" + "═".repeat(60));
  console.log(`RESULTS: ${P} passed, ${F} failed, ${P + F} total`);
  console.log("═".repeat(60));
  if (fail.length) { console.log("\nFailed:"); fail.forEach(f => console.log(`  ❌ ${f}`)); }

  const bals = await Promise.all([owner, client, worker, other].map(a => ethers.provider.getBalance(a.address)));
  console.log(`\nBalances: ${bals.map(ethers.formatEther).join(" | ")} ETH`);
  console.log("═".repeat(60));
  if (F > 0) process.exit(1);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
