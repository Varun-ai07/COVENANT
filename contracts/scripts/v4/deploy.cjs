const { ethers, upgrades, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

const DEPLOYMENT_DIR = path.join(__dirname, "..", "..");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("COVENANT V4 DEPLOYMENT");
  console.log("=".repeat(60));
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("=".repeat(60));

  const addresses = {};
  const MIN_STAKE = ethers.parseEther("0.001");
  const LIFETIME_BUDGET = ethers.parseEther("0.01");
  const COOLDOWN_PERIOD = 3600;
  const COVERAGE_MULTIPLIER = 80;
  const CLAIM_COOLDOWN = 7 * 24 * 60 * 60;
  const QUORUM = ethers.parseEther("100");

  // 1. Deploy CovenantIdentity
  console.log("\n[1/6] Deploying CovenantIdentity...");
  const Identity = await ethers.getContractFactory("contracts/v4/CovenantIdentity.sol:CovenantIdentity");
  const identity = await Identity.deploy();
  await identity.waitForDeployment();
  const identityAddr = await identity.getAddress();
  addresses.CovenantIdentity = identityAddr;
  console.log(`  -> CovenantIdentity: ${identityAddr}`);

  // 2. Deploy CovenantEscrow
  console.log("\n[2/6] Deploying CovenantEscrow...");
  const Escrow = await ethers.getContractFactory("contracts/v4/CovenantEscrow.sol:CovenantEscrow");
  const escrow = await Escrow.deploy();
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  addresses.CovenantEscrow = escrowAddr;
  console.log(`  -> CovenantEscrow: ${escrowAddr}`);

  // 3. Deploy CovenantSettlement
  console.log("\n[3/6] Deploying CovenantSettlement...");
  const Settlement = await ethers.getContractFactory("contracts/v4/CovenantSettlement.sol:CovenantSettlement");
  const settlement = await Settlement.deploy();
  await settlement.waitForDeployment();
  const settlementAddr = await settlement.getAddress();
  addresses.CovenantSettlement = settlementAddr;
  console.log(`  -> CovenantSettlement: ${settlementAddr}`);

  // 4. Deploy CovenantArbitration
  console.log("\n[4/6] Deploying CovenantArbitration...");
  const Arbitration = await ethers.getContractFactory("contracts/v4/CovenantArbitration.sol:CovenantArbitration");
  const arbitration = await Arbitration.deploy();
  await arbitration.waitForDeployment();
  const arbitrationAddr = await arbitration.getAddress();
  addresses.CovenantArbitration = arbitrationAddr;
  console.log(`  -> CovenantArbitration: ${arbitrationAddr}`);

  // 5. Deploy CovenantGovernance
  console.log("\n[5/6] Deploying CovenantGovernance...");
  const Governance = await ethers.getContractFactory("contracts/v4/CovenantGovernance.sol:CovenantGovernance");
  const governance = await Governance.deploy();
  await governance.waitForDeployment();
  const governanceAddr = await governance.getAddress();
  addresses.CovenantGovernance = governanceAddr;
  console.log(`  -> CovenantGovernance: ${governanceAddr}`);

  // 6. Deploy CovenantAttestation
  console.log("\n[6/6] Deploying CovenantAttestation...");
  const Attestation = await ethers.getContractFactory("contracts/v4/CovenantAttestation.sol:CovenantAttestation");
  const attestation = await Attestation.deploy();
  await attestation.waitForDeployment();
  const attestationAddr = await attestation.getAddress();
  addresses.CovenantAttestation = attestationAddr;
  console.log(`  -> CovenantAttestation: ${attestationAddr}`);

  // Initialize contracts
  console.log("\n" + "=".repeat(60));
  console.log("INITIALIZING CONTRACTS");
  console.log("=".repeat(60));

  console.log("\n[Init] CovenantIdentity...");
  await identity.initialize(MIN_STAKE, deployer.address);
  console.log("  -> Initialized with minimumStake, reputationOracle=deployer");

  console.log("\n[Init] CovenantEscrow...");
  await escrow.initialize(identityAddr);
  console.log(`  -> Initialized with identity=${identityAddr}`);

  console.log("\n[Init] CovenantSettlement...");
  await settlement.initialize(identityAddr);
  console.log(`  -> Initialized with identity=${identityAddr}`);

  console.log("\n[Init] CovenantArbitration...");
  await arbitration.initialize(escrowAddr, deployer.address);
  console.log(`  -> Initialized with escrow=${escrowAddr}, arbiter=deployer`);

  console.log("\n[Init] CovenantGovernance...");
  await governance.initialize(deployer.address, deployer.address, QUORUM);
  console.log(`  -> Initialized with guardian=deployer, vetoer=deployer, quorum=${QUORUM}`);

  console.log("\n[Init] CovenantAttestation...");
  await attestation.initialize();
  console.log("  -> Initialized");

  // Wire contracts together
  console.log("\n" + "=".repeat(60));
  console.log("WIRING CONTRACTS");
  console.log("=".repeat(60));

  console.log("\n[Wiring] Escrow -> Arbitration...");
  await escrow.setAuthorizedArbitration(arbitrationAddr);
  console.log(`  -> Authorized Arbitration: ${arbitrationAddr}`);

  console.log("\n[Wiring] Escrow -> Settlement...");
  await escrow.setAuthorizedSettlement(settlementAddr);
  console.log(`  -> Authorized Settlement: ${settlementAddr}`);

  // Register deployer as attestation issuer
  console.log("\n[Setup] Registering deployer as attestation issuer...");
  await attestation.registerIssuer(deployer.address, "Deployer");
  console.log("  -> Deployer registered as issuer");

  // Save deployment addresses
  console.log("\n" + "=".repeat(60));
  console.log("SAVING DEPLOYMENT ADDRESSES");
  console.log("=".repeat(60));

  const deploymentData = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: addresses,
  };

  const outputPath = path.join(DEPLOYMENT_DIR, "deployed-addresses.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
  console.log(`  -> Saved to ${outputPath}`);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  for (const [name, addr] of Object.entries(addresses)) {
    console.log(`  ${name}: ${addr}`);
  }
  console.log("=".repeat(60));

  // Verify contracts on Basescan
  if (network.chainId === 84532n || network.chainId === 8453n) {
    console.log("\n" + "=".repeat(60));
    console.log("VERIFYING ON BASESCAN");
    console.log("=".repeat(60));

    for (const [name, addr] of Object.entries(addresses)) {
      console.log(`\n  Verifying ${name}...`);
      try {
        await run("verify:verify", {
          address: addr,
          constructorArguments: [],
        });
        console.log(`  -> ${name} verified!`);
      } catch (e) {
        if (e.message.includes("Already Verified")) {
          console.log(`  -> ${name} already verified`);
        } else {
          console.log(`  -> ${name} verification failed: ${e.message}`);
        }
      }
    }
    console.log("=".repeat(60));
  }

  console.log("\nDeployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
