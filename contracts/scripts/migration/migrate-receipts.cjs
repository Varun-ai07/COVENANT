// Migration script: v1 ReceiptVerifier → v2 ReceiptVerifier
// Run: npx hardhat run scripts/migration/migrate-receipts.cjs --network baseSepolia

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");

const V1_RECEIPT = "0xa47D15099be6aC516B53a6859D468E9004eEf76b";
const V2_RECEIPT = "0x05cC13692755015FCb11e95d609187b214197edF";
const PROGRESS_FILE = __dirname + "/receipt-migration-progress.json";
const BATCH_SIZE = 50;

// v1 ReceiptVerifier ABI (minimal)
const V1_ABI = [
  "function getAgentReceiptCount(address) view returns (uint256)",
  "function getReceiptsByAgent(address) view returns (bytes32[])",
  "function getReceipt(bytes32) view returns (tuple(bytes32 receiptId, address issuer, address counterparty, string interactionType, bytes32 dataHash, uint256 timestamp, bool isValid))",
];

// v2 ReceiptVerifier ABI (minimal)
const V2_ABI = [
  "function createReceipt(address issuer, address counterparty, uint8 receiptType, bytes32 dataHash) returns (bytes32)",
  "function addAuthorizedIssuer(address)",
  "function authorizedIssuers(address) view returns (bool)",
];

// Map v1 string interactionType to v2 enum
const RECEIPT_TYPE_MAP = {
  "TaskCompletion": 0,
  "AgentVerified": 1,
  "CapabilityProven": 2,
  "ReputationVerified": 3,
  "DisputeResolved": 4,
  "InsuranceClaimed": 5,
};

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
  }
  return { migrated: [], totalMigrated: 0 };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Migrating receipts with:", deployer.address);

  const v1 = new ethers.Contract(V1_RECEIPT, V1_ABI, deployer);
  const v2 = new ethers.Contract(V2_RECEIPT, V2_ABI, deployer);

  // First, authorize deployer as issuer on v2
  const isAuthorized = await v2.authorizedIssuers(deployer.address);
  if (!isAuthorized) {
    console.log("Authorizing deployer as receipt issuer...");
    const tx = await v2.addAuthorizedIssuer(deployer.address);
    await tx.wait();
    console.log("Done.");
  }

  // Get all receipts from v1 events
  const filter = v1.filters.ReceiptCreated();
  const events = await v1.queryFilter(filter, 0, "latest");
  console.log(`Found ${events.length} receipt events in v1`);

  const progress = loadProgress();
  const alreadyMigrated = new Set(progress.migrated);

  const toMigrate = events.filter(e => {
    const receiptId = e.args[0];
    return !alreadyMigrated.has(receiptId);
  });

  console.log(`${toMigrate.length} receipts remaining to migrate`);

  if (toMigrate.length === 0) {
    console.log("All receipts already migrated!");
    return;
  }

  // Process in batches
  for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
    const batch = toMigrate.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} receipts`);

    for (const event of batch) {
      try {
        const receiptId = event.args[0];
        const receipt = await v1.getReceipt(receiptId);

        if (!receipt.isValid) {
          console.log(`  ${receiptId.slice(0, 18)}... - invalid, skipping`);
          progress.migrated.push(receiptId);
          continue;
        }

        const receiptType = RECEIPT_TYPE_MAP[receipt.interactionType] ?? 0;

        const tx = await v2.createReceipt(
          receipt.issuer,
          receipt.counterparty,
          receiptType,
          receipt.dataHash
        );
        await tx.wait();

        console.log(`  ${receiptId.slice(0, 18)}... - migrated (${receipt.interactionType} → ${receiptType})`);
        progress.migrated.push(receiptId);
        progress.totalMigrated++;
        saveProgress(progress);
      } catch (e) {
        console.log(`  ERROR: ${e.message.substring(0, 100)}`);
      }
    }
  }

  console.log(`\n=== Receipt migration complete ===`);
  console.log(`Total migrated: ${progress.totalMigrated}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
