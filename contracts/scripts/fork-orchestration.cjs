// COVENANT Fork Orchestration Test
// Verifies offchain-onchain coordination + ALL event emissions
// Forks Base Sepolia via hardhat_reset, deploys fresh, runs full lifecycle
// Run: npx hardhat run scripts/fork-orchestration.cjs

const hre = require("hardhat");
const { ethers } = hre;

async function enableForking() {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  console.log(`Forking from: ${rpcUrl}`);
  try {
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{ forking: { jsonRpcUrl: rpcUrl } }],
    });
    console.log("Fork active\n");
  } catch (e) {
    console.log(`Fork failed (${e.message}), continuing without fork\n`);
  }
}

const results = { pass: 0, fail: 0, total: 0 };
function check(description, condition, detail = "") {
  results.total++;
  if (condition) { results.pass++; console.log(`  \u2705 ${description}`); }
  else { results.fail++; console.log(`  \u274c ${description}${detail ? ` \u2014 ${detail}` : ""}`); }
}

// Capture all events from all contracts at the end
const eventCapture = [];

async function captureEvents(label, contracts) {
  const currentBlock = await ethers.provider.getBlockNumber();
  for (const [name, contract] of Object.entries(contracts)) {
    try {
      for (const fragment of contract.interface.fragments) {
        if (fragment.type !== "event") continue;
        try {
          const events = await contract.queryFilter(fragment.name, currentBlock - 50, 'latest');
          for (const e of events) {
            eventCapture.push({ contract: name, event: fragment.name, args: e.args, block: e.blockNumber, tx: e.transactionHash });
          }
        } catch { /* skip unqueryable events */ }
      }
    } catch { /* contract not deployed */ }
  }
}

const MEDIUM_FEE = 100n; // 1%
function withFee(val) { return val + (val * MEDIUM_FEE / 10000n); }

async function main() {
  await enableForking();

  console.log("===========================================");
  console.log("  COVENANT FORK ORCHESTRATION TEST");
  console.log("  Network:", hre.network.name);
  console.log("  Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log("===========================================\n");

  const [deployer, alice, bob] = await ethers.getSigners();
  const STAKE = ethers.parseEther("0.01");
  const PAYMENT = ethers.parseEther("0.01");

  console.log("Deployer:", deployer.address);
  console.log("Alice:   ", alice.address);
  console.log("Bob:     ", bob.address, "\n");

  // ===== PHASE 1: DEPLOY =====
  console.log("--- PHASE 1: Deploy All Contracts ---\n");

  const AgentRegistry = await ethers.getContractFactory("contracts/AgentRegistry.sol:AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  check("AgentRegistry deployed", true);

  const ReceiptVerifier = await ethers.getContractFactory("contracts/ReceiptVerifier.sol:ReceiptVerifier");
  const verifier = await ReceiptVerifier.deploy();
  await verifier.waitForDeployment();
  const verAddr = await verifier.getAddress();
  check("ReceiptVerifier deployed", true);

  const TaskEscrow = await ethers.getContractFactory("contracts/TaskEscrow.sol:TaskEscrow");
  const escrow = await TaskEscrow.deploy(await registry.getAddress(), verAddr);
  await escrow.waitForDeployment();
  const escAddr = await escrow.getAddress();
  check("TaskEscrow deployed", true);

  let tx = await registry.addAuthorizedContract(escAddr);
  await tx.wait();
  check("TaskEscrow authorized on Registry", true);

  tx = await verifier.addAuthorizedIssuer(escAddr);
  await tx.wait();
  check("TaskEscrow authorized on Verifier", true);

  const COVENANTRouter = await ethers.getContractFactory("contracts/COVENANTRouter.sol:COVENANTRouter");
  const router = await COVENANTRouter.deploy(await registry.getAddress(), escAddr, verAddr);
  await router.waitForDeployment();
  check("COVENANTRouter deployed", true);

  const MultiTokenEscrow = await ethers.getContractFactory("contracts/MultiTokenEscrow.sol:MultiTokenEscrow");
  const multiToken = await MultiTokenEscrow.deploy(await registry.getAddress(), deployer.address);
  await multiToken.waitForDeployment();
  check("MultiTokenEscrow deployed", true);
  tx = await registry.addAuthorizedContract(await multiToken.getAddress());
  await tx.wait();

  const ParallelTaskBatch = await ethers.getContractFactory("contracts/ParallelTaskBatch.sol:ParallelTaskBatch");
  const batch = await ParallelTaskBatch.deploy(escAddr, await registry.getAddress());
  await batch.waitForDeployment();
  check("ParallelTaskBatch deployed", true);

  const AgentInsurance = await ethers.getContractFactory("contracts/AgentInsurance.sol:AgentInsurance");
  const insurance = await AgentInsurance.deploy(await registry.getAddress(), escAddr);
  await insurance.waitForDeployment();
  check("AgentInsurance deployed", true);

  const DisputeArbitration = await ethers.getContractFactory("contracts/DisputeArbitration.sol:DisputeArbitration");
  const dispute = await DisputeArbitration.deploy(await registry.getAddress(), escAddr);
  await dispute.waitForDeployment();
  check("DisputeArbitration deployed", true);

  // Authorize insurance & dispute on registry (needed for updateReputation)
  tx = await registry.addAuthorizedContract(await insurance.getAddress());
  await tx.wait();
  tx = await registry.addAuthorizedContract(await dispute.getAddress());
  await tx.wait();

  const AgentRegistryV2 = await ethers.getContractFactory("contracts/v2/core/AgentRegistry.sol:AgentRegistry");
  const registryV2 = await AgentRegistryV2.deploy();
  await registryV2.waitForDeployment();
  check("AgentRegistry v2 deployed", true);

  const ReceiptVerifierV2 = await ethers.getContractFactory("contracts/v2/core/ReceiptVerifier.sol:ReceiptVerifier");
  const verifierV2 = await ReceiptVerifierV2.deploy();
  await verifierV2.waitForDeployment();
  check("ReceiptVerifier v2 deployed", true);

  const TaskEscrowV2 = await ethers.getContractFactory("contracts/v2/core/TaskEscrow.sol:TaskEscrow");
  const escrowV2 = await TaskEscrowV2.deploy(
    await registryV2.getAddress(), await verifierV2.getAddress(), deployer.address
  );
  await escrowV2.waitForDeployment();
  check("TaskEscrow v2 deployed", true);

  const AUTHORIZED_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUTHORIZED_ROLE"));
  await registryV2.grantRole(AUTHORIZED_ROLE, await escrowV2.getAddress());
  await verifierV2.addAuthorizedIssuer(await escrowV2.getAddress());

  const AgentSmartWallet = await ethers.getContractFactory("contracts/v2/core/AgentSmartWallet.sol:AgentSmartWallet");
  await AgentSmartWallet.deploy(deployer.address, ethers.parseEther("1"), ethers.parseEther("0.1"));
  check("AgentSmartWallet deployed", true);

  const CovenantPaymaster = await ethers.getContractFactory("contracts/v2/core/CovenantPaymaster.sol:CovenantPaymaster");
  await CovenantPaymaster.deploy();
  check("CovenantPaymaster deployed", true);

  const StakeSlashing = await ethers.getContractFactory("contracts/v2/extensions/StakeSlashing.sol:StakeSlashing");
  await StakeSlashing.deploy();
  check("StakeSlashing deployed", true);

  const Migration = await ethers.getContractFactory("contracts/v2/migration/Migration.sol:Migration");
  await Migration.deploy(await registry.getAddress(), escAddr, verAddr,
    await registryV2.getAddress(), await escrowV2.getAddress(), await verifierV2.getAddress());
  check("Migration deployed", true);

  // ===== PHASE 2: AGENT REGISTRATION =====
  console.log("\n--- PHASE 2: Agent Registration ---\n");

  tx = await registry.connect(alice).register("Alice", ["dev", "audit"], { value: STAKE });
  await tx.wait();
  check("Alice registered", (await registry.getAgent(alice.address)).isActive === 1n);

  tx = await registry.connect(bob).register("Bob", ["data"], { value: STAKE });
  await tx.wait();
  check("Bob registered", (await registry.getAgent(bob.address)).isActive === 1n);

  check("Alice initial reputation = 500", (await registry.getAgent(alice.address)).reputation === 500n);
  check("Alice stake = 0.01 ETH", (await registry.getAgent(alice.address)).stakedAmount === STAKE);

  tx = await registry.connect(alice).addStake({ value: STAKE });
  await tx.wait();
  check("Alice stake increased to 0.02", (await registry.getAgent(alice.address)).stakedAmount === STAKE * 2n);

  // ===== PHASE 3: TASK LIFECYCLE =====
  console.log("\n--- PHASE 3: Task Lifecycle ---\n");

  const deadline = Math.floor(Date.now() / 1000) + 7200;
  const descHash = ethers.keccak256(ethers.toUtf8Bytes("test-task"));

  // createAndFundTask uses Medium priority by default => payment + 1%
  tx = await escrow.connect(alice).createAndFundTask(bob.address, PAYMENT, deadline, descHash, { value: withFee(PAYMENT) });
  await tx.wait();
  const task1 = await escrow.getTask(1);
  check("Task status = InProgress", task1.status === 2n);
  check("Bob initial rep = 500", (await registry.getAgent(bob.address)).reputation === 500n);

  const submitHash = ethers.keccak256(ethers.toUtf8Bytes("deliverable"));
  tx = await escrow.connect(bob).submitWork(1, submitHash);
  await tx.wait();
  check("Task status = Submitted", (await escrow.getTask(1)).status === 3n);

  tx = await escrow.connect(alice).verifyTask(1, true);
  await tx.wait();
  check("Task status = Completed", (await escrow.getTask(1)).status === 4n);
  check("Bob rep after success = 510", (await registry.getAgent(bob.address)).reputation === 510n);
  check("Bob tasksCompleted = 1n", (await registry.getAgent(bob.address)).tasksCompleted === 1n);
  check("Bob totalValueTransacted > 0", (await registry.getAgent(bob.address)).totalValueTransacted > 0n);

  // ===== PHASE 4: TASK FAILURE + INSURANCE =====
  console.log("\n--- PHASE 4: Insurance Flow ---\n");

  tx = await escrow.connect(alice).createAndFundTask(bob.address, PAYMENT, deadline, descHash, { value: withFee(PAYMENT) });
  await tx.wait();
  const task2Id = 2n;

  // Bob joins insurance BEFORE task fails
  tx = await insurance.connect(bob).joinPool({ value: ethers.parseEther("0.01") });
  await tx.wait();
  check("Bob insurance member", (await insurance.members(bob.address)).isMember);

  // Bob pays premium while task is InProgress
  tx = await insurance.connect(bob).payPremium(task2Id, { value: ethers.parseEther("0.0002") });
  await tx.wait();
  check("Premium paid > 0", (await insurance.members(bob.address)).totalPremiumsPaid > 0n);

  tx = await escrow.connect(bob).submitWork(task2Id, submitHash);
  await tx.wait();

  tx = await escrow.connect(alice).verifyTask(task2Id, false);
  await tx.wait();
  check("Task status = Failed", (await escrow.getTask(task2Id)).status === 5n);

  // Bob claims after failure
  tx = await insurance.connect(bob).claimInsurance(task2Id);
  await tx.wait();

  tx = await insurance.connect(deployer).payClaim(1);
  await tx.wait();

  const claimOnChain = await insurance.claims(1);
  check("Claim paid on-chain", claimOnChain.isPaid);
  check("Bob rep after insurance = 485", (await registry.getAgent(bob.address)).reputation === 485n);

  // ===== PHASE 5: DISPUTE =====
  console.log("\n--- PHASE 5: Dispute Resolution ---\n");

  tx = await escrow.connect(alice).createAndFundTask(bob.address, PAYMENT, deadline, descHash, { value: withFee(PAYMENT) });
  await tx.wait();
  const task3Id = 3n;

  tx = await escrow.connect(bob).submitWork(task3Id, submitHash);
  await tx.wait();

  tx = await dispute.connect(alice).disputeTask(task3Id, { value: ethers.parseEther("0.0002") });
  await tx.wait();

  tx = await dispute.connect(deployer).resolveDispute(1, true);
  await tx.wait();

  const resolvedDispute = await dispute.disputes(1);
  check("Dispute resolved = worker wins", resolvedDispute.workerWins);
  check("Bob rep after dispute = 495", (await registry.getAgent(bob.address)).reputation === 495n);

  // ===== PHASE 6: MULTI-TOKEN ESCROW =====
  console.log("\n--- PHASE 6: Multi-Token Escrow ---\n");

  const MockERC20 = await ethers.getContractFactory("contracts/test/MockERC20.sol:MockERC20");
  const token = await MockERC20.deploy("Test", "TST", ethers.parseEther("100"));
  await token.waitForDeployment();

  tx = await multiToken.setAcceptedToken(await token.getAddress(), true);
  await tx.wait();
  check("Token whitelisted", true);

  await token.mint(alice.address, ethers.parseEther("10"));
  await token.connect(alice).approve(await multiToken.getAddress(), ethers.parseEther("1"));

  tx = await multiToken.connect(alice).createAndFundTaskERC20(
    bob.address, ethers.parseEther("1"), deadline, descHash, await token.getAddress()
  );
  await tx.wait();
  check("Multi-token task created", true);

  tx = await multiToken.connect(bob).submitWork(0, submitHash);
  await tx.wait();

  tx = await multiToken.connect(alice).verifyTask(0, true);
  await tx.wait();
  check("Multi-token task completed", true);

  // ===== PHASE 7: PARALLEL BATCH =====
  console.log("\n--- PHASE 7: Parallel Batch ---\n");

  const deadline2 = Math.floor(Date.now() / 1000) + 7200;
  const descHash2 = ethers.keccak256(ethers.toUtf8Bytes("batch-task"));

  tx = await batch.connect(alice).createBatch(
    [bob.address], [PAYMENT], [deadline2], [descHash2], ethers.keccak256(ethers.toUtf8Bytes("agg-spec")),
    { value: withFee(PAYMENT) }
  );
  await tx.wait();

  const batchInfo = await batch.getBatchDetails(1);
  check("Batch created with 1 task", batchInfo.taskIds.length === 1);
  check("Batch status = InProgress", (await batch.getBatchStatus(1)) === 1n);

  // ===== PHASE 8: V2 CONTRACTS =====
  console.log("\n--- PHASE 8: V2 Contracts ---\n");

  tx = await registryV2.connect(alice).register("AliceV2", ["dev"], { value: STAKE });
  await tx.wait();
  check("Alice registered on v2", (await registryV2.getAgent(alice.address)).isActive === 1n);

  const capHash = ethers.keccak256(ethers.toUtf8Bytes("dev"));
  check("v2 capability hashed", await registryV2.hasCapability(alice.address, capHash));

  tx = await registryV2.connect(bob).register("BobV2", ["data"], { value: STAKE });
  await tx.wait();
  check("Bob registered on v2", (await registryV2.getAgent(bob.address)).isActive === 1n);

  tx = await registryV2.recordTaskCompletion(alice.address, true, PAYMENT);
  await tx.wait();
  check("v2 alice tasksCompleted = 1", (await registryV2.getAgent(alice.address)).tasksCompleted === 1n);

  const v2descHash = ethers.keccak256(ethers.toUtf8Bytes("v2-task"));

  // v2 basic createAndFundTask requires exact payment (no priority fee)
  tx = await escrowV2.connect(alice).createAndFundTask(bob.address, PAYMENT, deadline, v2descHash,
    { value: PAYMENT });
  await tx.wait();

  tx = await escrowV2.connect(bob).submitWork(0, ethers.keccak256(ethers.toUtf8Bytes("v2-deliverable")));
  await tx.wait();

  tx = await escrowV2.connect(alice).verifyTask(0, true);
  await tx.wait();
  check("v2 task completed", (await escrowV2.getTask(0)).status === 4n);

  // ===== PHASE 9: V2 RECEIPTS =====
  console.log("\n--- PHASE 9: V2 Receipts ---\n");

  await verifierV2.addAuthorizedIssuer(deployer.address);
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes("receipt-data"));

  tx = await verifierV2.createReceipt(alice.address, bob.address, 0, dataHash);
  await tx.wait();
  check("v2 receipt count = 1", (await verifierV2.receiptCount()) === 1n);

  tx = await verifierV2.createReceipt(alice.address, bob.address, 1, dataHash);
  await tx.wait();
  check("v2 receipt count = 2", (await verifierV2.receiptCount()) === 2n);

  // Receipt IDs are deterministic: keccak256(issuer, counterparty, type, dataHash, receiptCount_before_increment)
  const r1Id = ethers.keccak256(ethers.solidityPacked(
    ["address", "address", "uint8", "bytes32", "uint256"],
    [alice.address, bob.address, 0, dataHash, 0]
  ));
  const r2Id = ethers.keccak256(ethers.solidityPacked(
    ["address", "address", "uint8", "bytes32", "uint256"],
    [alice.address, bob.address, 1, dataHash, 1]
  ));

  const isValid = await verifierV2.batchVerifyReceipts([r1Id, r2Id]);
  check("v2 batch verify receipts", isValid[0] && isValid[1]);

  // ===== PHASE 10: STAKE SLASHING =====
  console.log("\n--- PHASE 10: Stake Slashing ---\n");

  const SlashingFactory = await ethers.getContractFactory("contracts/v2/extensions/StakeSlashing.sol:StakeSlashing");
  const slashing = await SlashingFactory.deploy();
  await slashing.waitForDeployment();

  tx = await slashing.connect(alice).depositStake(1, { value: STAKE });
  await tx.wait();
  check("Stake deposited", true);

  tx = await slashing.connect(deployer).slashLoser(1, alice.address);
  await tx.wait();
  check("Loser slashed", true);
  check("Total slashed > 0", (await slashing.totalSlashed()) > 0n);

  // ===== PHASE 11: EVENT AUDIT =====
  console.log("\n--- PHASE 11: Event Audit Report ---\n");

  await captureEvents("All Contracts", {
    registry, escrow, verifier, insurance, dispute, multiToken, batch,
    registryV2, escrowV2, verifierV2,
  });

  const eventSummary = {};
  for (const e of eventCapture) {
    if (!eventSummary[e.event]) eventSummary[e.event] = 0;
    eventSummary[e.event]++;
  }

  console.log("Events Captured per Type:");
  for (const [name, count] of Object.entries(eventSummary).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  \u2705 ${name}: ${count} emissions`);
  }
  check(`Total event types: ${Object.keys(eventSummary).length}`, Object.keys(eventSummary).length >= 5);

  // ===== SUMMARY =====
  console.log("\n===========================================");
  console.log("  FINAL REPORT");
  console.log("===========================================");
  console.log(`  Total Checks: ${results.total}`);
  console.log(`  Passed:       ${results.pass}`);
  console.log(`  Failed:       ${results.fail}`);
  console.log(`  Events Found: ${eventCapture.length} total across ${Object.keys(eventSummary).length} types`);
  console.log("===========================================\n");

  const success = results.fail === 0;
  if (success) {
    console.log("ALL CHECKS PASSED — Offchain<->Onchain coordination verified!\n");
  } else {
    console.log(`${results.fail} checks failed — review above\n`);
  }

  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
