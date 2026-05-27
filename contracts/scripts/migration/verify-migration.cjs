// Verify migration completeness
// Run: npx hardhat run scripts/migration/verify-migration.cjs --network baseSepolia

const hre = require("hardhat");
const { ethers } = hre;

const V1_REGISTRY = "0xB215589dA259A98eEE8BF39739F6255131ac33A1";
const V2_REGISTRY = "0x773d1954997b6A91e917e0c2326ABCcAf36e21E1";
const V1_RECEIPT = "0xa47D15099be6aC516B53a6859D468E9004eEf76b";
const V2_RECEIPT = "0x05cC13692755015FCb11e95d609187b214197edF";

const REGISTRY_ABI = [
  "function getAllAgents() view returns (address[])",
  "function getAgent(address) view returns (tuple)",
  "function agentCount() view returns (uint256)",
  "function isActive(address) view returns (bool)",
];

const RECEIPT_ABI = [
  "function receiptCount() view returns (uint256)",
  "function getAgentReceiptCount(address) view returns (uint256)",
  "function getReceiptsByAgent(address) view returns (bytes32[])",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Verifying migration with:", deployer.address);
  console.log("");

  // === AgentRegistry ===
  console.log("=== AgentRegistry ===");
  const v1Reg = new ethers.Contract(V1_REGISTRY, REGISTRY_ABI, deployer);
  const v2Reg = new ethers.Contract(V2_REGISTRY, REGISTRY_ABI, deployer);

  const v1Agents = await v1Reg.getAllAgents();
  const v2Count = await v2Reg.agentCount();

  console.log(`V1 agents: ${v1Agents.length}`);
  console.log(`V2 agent count: ${v2Count}`);

  // Check each v1 agent exists in v2
  let migrated = 0;
  let missing = 0;
  let inactive = 0;

  for (const addr of v1Agents) {
    try {
      const v1Agent = await v1Reg.getAgent(addr);
      if (!v1Agent.isActive) {
        inactive++;
        continue;
      }

      const v2Agent = await v2Reg.getAgent(addr);
      if (v2Agent.isActive === 1) {
        migrated++;
      } else {
        missing++;
        console.log(`  MISSING: ${addr} (${v1Agent.name})`);
      }
    } catch (e) {
      missing++;
      console.log(`  ERROR: ${addr} - ${e.message.substring(0, 80)}`);
    }
  }

  console.log(`\nResults:`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Inactive (skipped): ${inactive}`);
  console.log(`  Missing: ${missing}`);

  // === ReceiptVerifier ===
  console.log("\n=== ReceiptVerifier ===");
  const v1Rec = new ethers.Contract(V1_RECEIPT, RECEIPT_ABI, deployer);
  const v2Rec = new ethers.Contract(V2_RECEIPT, RECEIPT_ABI, deployer);

  const v1ReceiptCount = await v1Rec.receiptCount();
  const v2ReceiptCount = await v2Rec.receiptCount();

  console.log(`V1 receipts: ${v1ReceiptCount}`);
  console.log(`V2 receipts: ${v2ReceiptCount}`);

  // === Summary ===
  console.log("\n=== Migration Summary ===");
  const agentOk = missing === 0;
  console.log(`AgentRegistry: ${agentOk ? "PASS" : "FAIL"} (${migrated}/${migrated + missing} active agents migrated)`);
  console.log(`ReceiptVerifier: ${v2ReceiptCount > 0 ? "PASS" : "WARN"} (${v2ReceiptCount} receipts in v2)`);

  if (agentOk && v2ReceiptCount > 0) {
    console.log("\n✅ Migration verified successfully!");
  } else if (missing > 0) {
    console.log(`\n⚠️  ${missing} agents not yet migrated. Run migrate-agents.cjs`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
