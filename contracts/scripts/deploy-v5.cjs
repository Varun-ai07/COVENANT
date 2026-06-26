// Deploy V5 contracts via UUPS Proxies
// Run: npx hardhat run scripts/deploy-v5.cjs --network baseSepolia
//
// PROXY DEPLOYMENT: Addresses are PERMANENT. Upgrades happen in-place.
// Never redeploy — use upgrades.upgradeProxy() instead.

const hre = require("hardhat");
const { ethers, upgrades } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying V5 UUPS Proxies with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const deployed = {};

  // ═══════════════════════════════════════════════════════════════
  // 1. CovenantIdentity — root of trust, no dependencies
  // ═══════════════════════════════════════════════════════════════
  console.log("\n1. Deploying CovenantIdentity proxy...");
  const Identity = await ethers.getContractFactory("CovenantIdentity");
  const identity = await upgrades.deployProxy(
    Identity,
    [ethers.parseEther("0.001"), deployer.address],
    { kind: "uups" }
  );
  await identity.waitForDeployment();
  deployed.CovenantIdentity = await identity.getAddress();
  console.log("   Proxy:", deployed.CovenantIdentity);

  // ═══════════════════════════════════════════════════════════════
  // 2. CovenantEscrow — depends on Identity
  // ═══════════════════════════════════════════════════════════════
  console.log("\n2. Deploying CovenantEscrow proxy...");
  const Escrow = await ethers.getContractFactory("CovenantEscrow");
  const escrow = await upgrades.deployProxy(
    Escrow,
    [deployed.CovenantIdentity],
    { kind: "uups" }
  );
  await escrow.waitForDeployment();
  deployed.CovenantEscrow = await escrow.getAddress();
  console.log("   Proxy:", deployed.CovenantEscrow);

  // ═══════════════════════════════════════════════════════════════
  // 3. CovenantSettlement — depends on Identity
  // ═══════════════════════════════════════════════════════════════
  console.log("\n3. Deploying CovenantSettlement proxy...");
  const Settlement = await ethers.getContractFactory("CovenantSettlement");
  const settlement = await upgrades.deployProxy(
    Settlement,
    [deployed.CovenantIdentity],
    { kind: "uups" }
  );
  await settlement.waitForDeployment();
  deployed.CovenantSettlement = await settlement.getAddress();
  console.log("   Proxy:", deployed.CovenantSettlement);

  // ═══════════════════════════════════════════════════════════════
  // 4. CovenantArbitration — depends on Escrow
  // ═══════════════════════════════════════════════════════════════
  console.log("\n4. Deploying CovenantArbitration proxy...");
  const Arbitration = await ethers.getContractFactory("CovenantArbitration");
  const arbitration = await upgrades.deployProxy(
    Arbitration,
    [deployed.CovenantEscrow, deployer.address],
    { kind: "uups" }
  );
  await arbitration.waitForDeployment();
  deployed.CovenantArbitration = await arbitration.getAddress();
  console.log("   Proxy:", deployed.CovenantArbitration);

  // ═══════════════════════════════════════════════════════════════
  // 5. CovenantAttestation — no dependencies
  // ═══════════════════════════════════════════════════════════════
  console.log("\n5. Deploying CovenantAttestation proxy...");
  const Attestation = await ethers.getContractFactory("CovenantAttestation");
  const attestation = await upgrades.deployProxy(
    Attestation,
    [],
    { kind: "uups" }
  );
  await attestation.waitForDeployment();
  deployed.CovenantAttestation = await attestation.getAddress();
  console.log("   Proxy:", deployed.CovenantAttestation);

  // ═══════════════════════════════════════════════════════════════
  // 6. CovenantGovernance — no dependencies
  // ═══════════════════════════════════════════════════════════════
  console.log("\n6. Deploying CovenantGovernance proxy...");
  const Governance = await ethers.getContractFactory("CovenantGovernance");
  const governance = await upgrades.deployProxy(
    Governance,
    [deployer.address, deployer.address, 1000],
    { kind: "uups" }
  );
  await governance.waitForDeployment();
  deployed.CovenantGovernance = await governance.getAddress();
  console.log("   Proxy:", deployed.CovenantGovernance);

  // ═══════════════════════════════════════════════════════════════
  // 7. TrainingMarketplace — no dependencies
  // ═══════════════════════════════════════════════════════════════
  console.log("\n7. Deploying TrainingMarketplace proxy...");
  const Training = await ethers.getContractFactory("TrainingMarketplace");
  const training = await upgrades.deployProxy(
    Training,
    [deployer.address],
    { kind: "uups" }
  );
  await training.waitForDeployment();
  deployed.TrainingMarketplace = await training.getAddress();
  console.log("   Proxy:", deployed.TrainingMarketplace);

  // ═══════════════════════════════════════════════════════════════
  // 8. GrantProgram — no dependencies
  // ═══════════════════════════════════════════════════════════════
  console.log("\n8. Deploying GrantProgram proxy...");
  const Grant = await ethers.getContractFactory("GrantProgram");
  const grant = await upgrades.deployProxy(
    Grant,
    [],
    { kind: "uups" }
  );
  await grant.waitForDeployment();
  deployed.GrantProgram = await grant.getAddress();
  console.log("   Proxy:", deployed.GrantProgram);

  // ═══════════════════════════════════════════════════════════════
  // 9. InsurancePool — no dependencies
  // ═══════════════════════════════════════════════════════════════
  console.log("\n9. Deploying InsurancePool proxy...");
  const Insurance = await ethers.getContractFactory("InsurancePool");
  const insurance = await upgrades.deployProxy(
    Insurance,
    [],
    { kind: "uups" }
  );
  await insurance.waitForDeployment();
  deployed.InsurancePool = await insurance.getAddress();
  console.log("   Proxy:", deployed.InsurancePool);

  // ═══════════════════════════════════════════════════════════════
  // 10. RevisionManager — no dependencies
  // ═══════════════════════════════════════════════════════════════
  console.log("\n10. Deploying RevisionManager proxy...");
  const Revision = await ethers.getContractFactory("RevisionManager");
  const revision = await upgrades.deployProxy(
    Revision,
    [],
    { kind: "uups" }
  );
  await revision.waitForDeployment();
  deployed.RevisionManager = await revision.getAddress();
  console.log("   Proxy:", deployed.RevisionManager);

  // ═══════════════════════════════════════════════════════════════
  // AUTHORIZATIONS
  // ═══════════════════════════════════════════════════════════════

  console.log("\n═══ AUTHORIZATIONS ═══");

  console.log("Setting authorized settlement on Escrow...");
  await escrow.setAuthorizedSettlement(deployed.CovenantSettlement);

  console.log("Setting authorized arbitration on Escrow...");
  await escrow.setAuthorizedArbitration(deployed.CovenantArbitration);

  // ═══════════════════════════════════════════════════════════════
  // SAVE ADDRESSES
  // ═══════════════════════════════════════════════════════════════

  const v5Path = path.join(__dirname, "../v5/deployed-addresses.json");
  const v5Dir = path.dirname(v5Path);
  if (!fs.existsSync(v5Dir)) fs.mkdirSync(v5Dir, { recursive: true });

  const v5Data = {
    network: "base-sepolia",
    chainId: 84532,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    deploymentType: "UUPS Proxy",
    contracts: deployed,
    note: "V5 UUPS proxies — addresses are PERMANENT. Use upgrades.upgradeProxy() for logic upgrades.",
  };
  fs.writeFileSync(v5Path, JSON.stringify(v5Data, null, 2));

  console.log("\n✅ All V5 UUPS Proxies deployed!");
  console.log("Saved to v5/deployed-addresses.json");

  console.log("\n=== DEPLOYED PROXY ADDRESSES (PERMANENT) ===");
  for (const [name, addr] of Object.entries(deployed)) {
    console.log(`  ${name}: ${addr}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error(error); process.exit(1); });
