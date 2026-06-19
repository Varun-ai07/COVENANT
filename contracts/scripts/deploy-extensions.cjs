// Deploy remaining V2 extensions
// Run: npx hardhat run scripts/deploy-extensions.cjs --network baseSepolia

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying V2 extensions with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Load existing V2 addresses
  const v2Path = path.join(__dirname, "../v2/deployed-addresses.json");
  const v2 = JSON.parse(fs.readFileSync(v2Path, "utf8"));
  const feeRecipient = v2.deployer; // Use deployer as fee recipient

  const deployed = {};

  // 1. TrainingMarketplace
  console.log("\n1. Deploying TrainingMarketplace...");
  const TrainingMarketplace = await ethers.getContractFactory(
    "contracts/v2/extensions/TrainingMarketplace.sol:TrainingMarketplace"
  );
  const training = await TrainingMarketplace.deploy(feeRecipient);
  await training.waitForDeployment();
  deployed.TrainingMarketplace = await training.getAddress();
  console.log("   TrainingMarketplace:", deployed.TrainingMarketplace);

  // 2. GrantProgram
  console.log("\n2. Deploying GrantProgram...");
  const GrantProgram = await ethers.getContractFactory(
    "contracts/v2/extensions/GrantProgram.sol:GrantProgram"
  );
  const grants = await GrantProgram.deploy(deployer.address); // governance = deployer
  await grants.waitForDeployment();
  deployed.GrantProgram = await grants.getAddress();
  console.log("   GrantProgram:", deployed.GrantProgram);

  // 3. RevisionManager
  console.log("\n3. Deploying RevisionManager...");
  const RevisionManager = await ethers.getContractFactory(
    "contracts/v2/extensions/RevisionManager.sol:RevisionManager"
  );
  const revisions = await RevisionManager.deploy();
  await revisions.waitForDeployment();
  deployed.RevisionManager = await revisions.getAddress();
  console.log("   RevisionManager:", deployed.RevisionManager);

  // 4. AutoVerifier
  console.log("\n4. Deploying AutoVerifier...");
  const AutoVerifier = await ethers.getContractFactory(
    "contracts/v2/extensions/AutoVerifier.sol:AutoVerifier"
  );
  const autoVerifier = await AutoVerifier.deploy();
  await autoVerifier.waitForDeployment();
  deployed.AutoVerifier = await autoVerifier.getAddress();
  console.log("   AutoVerifier:", deployed.AutoVerifier);

  // 5. ClientReputation
  console.log("\n5. Deploying ClientReputation...");
  const ClientReputation = await ethers.getContractFactory(
    "contracts/v2/extensions/ClientReputation.sol:ClientReputation"
  );
  const clientRep = await ClientReputation.deploy();
  await clientRep.waitForDeployment();
  deployed.ClientReputation = await clientRep.getAddress();
  console.log("   ClientReputation:", deployed.ClientReputation);

  // 6. MilestoneVerification
  console.log("\n6. Deploying MilestoneVerification...");
  const MilestoneVerification = await ethers.getContractFactory(
    "contracts/v2/extensions/MilestoneVerification.sol:MilestoneVerification"
  );
  const milestone = await MilestoneVerification.deploy();
  await milestone.waitForDeployment();
  deployed.MilestoneVerification = await milestone.getAddress();
  console.log("   MilestoneVerification:", deployed.MilestoneVerification);

  // 7. MultiPartyReview
  console.log("\n7. Deploying MultiPartyReview...");
  const MultiPartyReview = await ethers.getContractFactory(
    "contracts/v2/extensions/MultiPartyReview.sol:MultiPartyReview"
  );
  const review = await MultiPartyReview.deploy();
  await review.waitForDeployment();
  deployed.MultiPartyReview = await review.getAddress();
  console.log("   MultiPartyReview:", deployed.MultiPartyReview);

  // 8. StakeSlashing
  console.log("\n8. Deploying StakeSlashing...");
  const StakeSlashing = await ethers.getContractFactory(
    "contracts/v2/extensions/StakeSlashing.sol:StakeSlashing"
  );
  const slashing = await StakeSlashing.deploy();
  await slashing.waitForDeployment();
  deployed.StakeSlashing = await slashing.getAddress();
  console.log("   StakeSlashing:", deployed.StakeSlashing);

  // Save deployed addresses
  const updatedV2 = {
    ...v2,
    deployedAt: new Date().toISOString(),
    contracts: { ...v2.contracts, ...deployed },
  };
  fs.writeFileSync(v2Path, JSON.stringify(updatedV2, null, 2));
  console.log("\n✅ All V2 extensions deployed!");
  console.log("Saved to v2/deployed-addresses.json");

  // Print summary
  console.log("\n=== Deployed Addresses ===");
  for (const [name, addr] of Object.entries(deployed)) {
    console.log(`  ${name}: ${addr}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
