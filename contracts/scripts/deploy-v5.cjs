// Deploy V5 contracts
// Run: npx hardhat run scripts/deploy-v5.cjs --network baseSepolia

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying V5 contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const deployed = {};

  // 1. CovenantIdentity (upgradeable proxy)
  console.log("\n1. Deploying CovenantIdentity...");
  const Identity = await ethers.getContractFactory("contracts/v5/core/CovenantIdentity.sol:CovenantIdentity");
  const identity = await Identity.deploy();
  await identity.waitForDeployment();
  deployed.CovenantIdentity = await identity.getAddress();
  console.log("   CovenantIdentity:", deployed.CovenantIdentity);

  // Initialize
  await identity.initialize(ethers.parseEther("0.001"), deployer.address);
  console.log("   Initialized with minimumStake=0.001, oracle=deployer");

  // 2. CovenantEscrow (upgradeable proxy)
  console.log("\n2. Deploying CovenantEscrow...");
  const Escrow = await ethers.getContractFactory("contracts/v5/core/CovenantEscrow.sol:CovenantEscrow");
  const escrow = await Escrow.deploy();
  await escrow.waitForDeployment();
  deployed.CovenantEscrow = await escrow.getAddress();
  console.log("   CovenantEscrow:", deployed.CovenantEscrow);

  await escrow.initialize(deployed.CovenantIdentity);

  // 3. CovenantSettlement (upgradeable proxy)
  console.log("\n3. Deploying CovenantSettlement...");
  const Settlement = await ethers.getContractFactory("contracts/v5/core/CovenantSettlement.sol:CovenantSettlement");
  const settlement = await Settlement.deploy();
  await settlement.waitForDeployment();
  deployed.CovenantSettlement = await settlement.getAddress();
  console.log("   CovenantSettlement:", deployed.CovenantSettlement);

  await settlement.initialize(deployed.CovenantIdentity);

  // 4. CovenantArbitration (upgradeable proxy)
  console.log("\n4. Deploying CovenantArbitration...");
  const Arbitration = await ethers.getContractFactory("contracts/v5/core/CovenantArbitration.sol:CovenantArbitration");
  const arbitration = await Arbitration.deploy();
  await arbitration.waitForDeployment();
  deployed.CovenantArbitration = await arbitration.getAddress();
  console.log("   CovenantArbitration:", deployed.CovenantArbitration);

  await arbitration.initialize(deployed.CovenantEscrow, deployer.address);

  // 5. CovenantAttestation (upgradeable proxy)
  console.log("\n5. Deploying CovenantAttestation...");
  const Attestation = await ethers.getContractFactory("contracts/v5/core/CovenantAttestation.sol:CovenantAttestation");
  const attestation = await Attestation.deploy();
  await attestation.waitForDeployment();
  deployed.CovenantAttestation = await attestation.getAddress();
  console.log("   CovenantAttestation:", deployed.CovenantAttestation);

  await attestation.initialize();

  // 6. CovenantGovernance (upgradeable proxy)
  console.log("\n6. Deploying CovenantGovernance...");
  const Governance = await ethers.getContractFactory("contracts/v5/core/CovenantGovernance.sol:CovenantGovernance");
  const governance = await Governance.deploy();
  await governance.waitForDeployment();
  deployed.CovenantGovernance = await governance.getAddress();
  console.log("   CovenantGovernance:", deployed.CovenantGovernance);

  await governance.initialize(deployer.address, deployer.address, 1000);

  // 7. TrainingMarketplace (upgradeable proxy)
  console.log("\n7. Deploying TrainingMarketplace...");
  const Training = await ethers.getContractFactory("contracts/v5/extensions/TrainingMarketplace.sol:TrainingMarketplace");
  const training = await Training.deploy();
  await training.waitForDeployment();
  deployed.TrainingMarketplace = await training.getAddress();
  console.log("   TrainingMarketplace:", deployed.TrainingMarketplace);

  await training.initialize(deployer.address);

  // 8. GrantProgram (upgradeable proxy)
  console.log("\n8. Deploying GrantProgram...");
  const Grant = await ethers.getContractFactory("contracts/v5/extensions/GrantProgram.sol:GrantProgram");
  const grant = await Grant.deploy();
  await grant.waitForDeployment();
  deployed.GrantProgram = await grant.getAddress();
  console.log("   GrantProgram:", deployed.GrantProgram);

  await grant.initialize();

  // 9. InsurancePool (upgradeable proxy)
  console.log("\n9. Deploying InsurancePool...");
  const Insurance = await ethers.getContractFactory("contracts/v5/extensions/InsurancePool.sol:InsurancePool");
  const insurance = await Insurance.deploy();
  await insurance.waitForDeployment();
  deployed.InsurancePool = await insurance.getAddress();
  console.log("   InsurancePool:", deployed.InsurancePool);

  await insurance.initialize();

  // 10. RevisionManager (upgradeable proxy)
  console.log("\n10. Deploying RevisionManager...");
  const Revision = await ethers.getContractFactory("contracts/v5/extensions/RevisionManager.sol:RevisionManager");
  const revision = await Revision.deploy();
  await revision.waitForDeployment();
  deployed.RevisionManager = await revision.getAddress();
  console.log("   RevisionManager:", deployed.RevisionManager);

  await revision.initialize();

  // ═══════════════════════════════════════════════════════════════
  // AUTHORIZATIONS
  // ═══════════════════════════════════════════════════════════════

  console.log("\n═══ AUTHORIZATIONS ═══");

  console.log("Setting authorized settlement on Escrow...");
  await escrow.setAuthorizedSettlement(deployed.CovenantSettlement);

  console.log("Setting authorized arbitration on Escrow...");
  await escrow.setAuthorizedArbitration(deployed.CovenantArbitration);

  // ═══════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════

  const v5Path = path.join(__dirname, "../v5/deployed-addresses.json");
  const v5Dir = path.dirname(v5Path);
  if (!fs.existsSync(v5Dir)) fs.mkdirSync(v5Dir, { recursive: true });

  const v5Data = {
    network: "base-sepolia",
    chainId: 84532,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: deployed,
    note: "V5 contracts - upgradeable, CEI-compliant, with emergency controls",
  };
  fs.writeFileSync(v5Path, JSON.stringify(v5Data, null, 2));

  console.log("\n✅ All V5 contracts deployed!");
  console.log("Saved to v5/deployed-addresses.json");

  console.log("\n=== DEPLOYED ADDRESSES ===");
  for (const [name, addr] of Object.entries(deployed)) {
    console.log(`  ${name}: ${addr}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error(error); process.exit(1); });
