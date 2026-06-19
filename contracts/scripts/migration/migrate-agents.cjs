// Migration script: v1 AgentRegistry → v2 AgentRegistry
// Run: npx hardhat run scripts/migration/migrate-agents.cjs --network baseSepolia

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");

const V1_REGISTRY = "0x0003072b15d2c299d46bC5FfE7785E803895E614";
const V2_REGISTRY = "0x773d1954997b6A91e917e0c2326ABCcAf36e21E1";
const PROGRESS_FILE = __dirname + "/migration-progress.json";
const BATCH_SIZE = 50;

// v1 AgentRegistry ABI (minimal)
const V1_ABI = [
  "function getAllAgents() view returns (address[])",
  "function getAgent(address) view returns (tuple(bytes32 did, string name, string[] capabilities, uint16 reputation, uint96 stakedAmount, bool isActive, uint32 tasksCompleted, uint32 tasksFailed, uint96 totalValueTransacted, uint48 registeredAt))",
];

// v2 AgentRegistry ABI (minimal)
const V2_ABI = [
  "function register(string name, string[] capabilities) payable",
  "function getAgent(address) view returns (bytes32 did, address wallet, uint16 reputation, uint8 isActive, uint32 tasksCompleted, uint16 tasksFailed, uint96 stakedAmount, uint48 registeredAt, uint128 totalValueTransacted)",
  "function hasCapability(address, bytes32) view returns (bool)",
];

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
  }
  return { migrated: [], lastBatch: 0, totalMigrated: 0 };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Migrating agents with:", deployer.address);

  const v1 = new ethers.Contract(V1_REGISTRY, V1_ABI, deployer);
  const v2 = new ethers.Contract(V2_REGISTRY, V2_ABI, deployer);

  // Get all agents from v1
  const allAgents = await v1.getAllAgents();
  console.log(`Found ${allAgents.length} agents in v1 registry`);

  const progress = loadProgress();
  const alreadyMigrated = new Set(progress.migrated);
  const toMigrate = allAgents.filter(a => !alreadyMigrated.has(a.toLowerCase()));

  console.log(`${toMigrate.length} agents remaining to migrate`);
  console.log(`${alreadyMigrated.size} already migrated`);

  if (toMigrate.length === 0) {
    console.log("All agents already migrated!");
    return;
  }

  // Process in batches
  for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
    const batch = toMigrate.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} agents`);

    for (const agentAddr of batch) {
      try {
        const agent = await v1.getAgent(agentAddr);
        if (!agent.isActive) {
          console.log(`  ${agentAddr} - inactive, skipping`);
          progress.migrated.push(agentAddr.toLowerCase());
          continue;
        }

        // Register on v2 with same name and capabilities
        const name = agent.name;
        const capabilities = agent.capabilities;

        const tx = await v2.register(name, capabilities, {
          value: ethers.parseEther("0.001"), // minimum stake
        });
        await tx.wait();

        console.log(`  ${agentAddr} - migrated (${name}, ${capabilities.length} capabilities)`);
        progress.migrated.push(agentAddr.toLowerCase());
        progress.totalMigrated++;
        saveProgress(progress);
      } catch (e) {
        console.log(`  ${agentAddr} - ERROR: ${e.message.substring(0, 100)}`);
      }
    }

    progress.lastBatch++;
    saveProgress(progress);
  }

  console.log(`\n=== Migration complete ===`);
  console.log(`Total migrated: ${progress.totalMigrated}`);
  console.log(`Progress saved to: ${PROGRESS_FILE}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
