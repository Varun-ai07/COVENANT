const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const MIN_STAKE = ethers.parseEther("0.001");
  const LIFETIME_BUDGET = ethers.parseEther("0.01");
  const COOLDOWN_PERIOD = 3600;
  const COVERAGE_MULTIPLIER = 80;
  const CLAIM_COOLDOWN = 7 * 24 * 60 * 60;
  const QUORUM = ethers.parseEther("100");

  console.log("\n--- Deploying CovenantIdentity ---");
  const Identity = await ethers.getContractFactory("CovenantIdentity");
  const identity = await Identity.deploy();
  await identity.waitForDeployment();
  const identityAddr = await identity.getAddress();
  console.log("CovenantIdentity:", identityAddr);

  console.log("\n--- Deploying CovenantEscrow ---");
  const Escrow = await ethers.getContractFactory("CovenantEscrow");
  const escrow = await Escrow.deploy();
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("CovenantEscrow:", escrowAddr);

  console.log("\n--- Deploying CovenantSettlement ---");
  const Settlement = await ethers.getContractFactory("CovenantSettlement");
  const settlement = await Settlement.deploy();
  await settlement.waitForDeployment();
  const settlementAddr = await settlement.getAddress();
  console.log("CovenantSettlement:", settlementAddr);

  console.log("\n--- Deploying CovenantArbitration ---");
  const Arbitration = await ethers.getContractFactory("CovenantArbitration");
  const arbitration = await Arbitration.deploy();
  await arbitration.waitForDeployment();
  const arbitrationAddr = await arbitration.getAddress();
  console.log("CovenantArbitration:", arbitrationAddr);

  console.log("\n--- Deploying CovenantGovernance ---");
  const Governance = await ethers.getContractFactory("CovenantGovernance");
  const governance = await Governance.deploy();
  await governance.waitForDeployment();
  const governanceAddr = await governance.getAddress();
  console.log("CovenantGovernance:", governanceAddr);

  console.log("\n--- Deploying CovenantAttestation ---");
  const Attestation = await ethers.getContractFactory("CovenantAttestation");
  const attestation = await Attestation.deploy();
  await attestation.waitForDeployment();
  const attestationAddr = await attestation.getAddress();
  console.log("CovenantAttestation:", attestationAddr);

  console.log("\n--- Initializing Contracts ---");
  await identity.initialize(MIN_STAKE, deployer.address);
  console.log("Identity initialized");

  await escrow.initialize(identityAddr);
  console.log("Escrow initialized");

  await settlement.initialize(identityAddr);
  console.log("Settlement initialized");

  await arbitration.initialize(escrowAddr, deployer.address);
  console.log("Arbitration initialized");

  await governance.initialize(deployer.address, QUORUM);
  console.log("Governance initialized");

  await attestation.initialize();
  console.log("Attestation initialized");

  console.log("\n--- Setting Authorized Addresses ---");
  await escrow.setAuthorizedArbitration(arbitrationAddr);
  console.log("Escrow authorized arbitration");

  console.log("\n--- Deploying Periphery ---");
  const Paymaster = await ethers.getContractFactory("CovenantPaymaster");
  const paymaster = await Paymaster.deploy();
  await paymaster.waitForDeployment();
  const paymasterAddr = await paymaster.getAddress();
  await paymaster.initialize(identityAddr, LIFETIME_BUDGET, COOLDOWN_PERIOD);
  console.log("CovenantPaymaster:", paymasterAddr);

  const Router = await ethers.getContractFactory("CovenantRouter");
  const router = await Router.deploy();
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  await router.initialize(identityAddr, escrowAddr, settlementAddr, attestationAddr);
  console.log("CovenantRouter:", routerAddr);

  const Insurance = await ethers.getContractFactory("CovenantInsurance");
  const insurance = await Insurance.deploy();
  await insurance.waitForDeployment();
  const insuranceAddr = await insurance.getAddress();
  await insurance.initialize(identityAddr, COVERAGE_MULTIPLIER, CLAIM_COOLDOWN);
  console.log("CovenantInsurance:", insuranceAddr);

  const Collective = await ethers.getContractFactory("CovenantCollective");
  const collective = await Collective.deploy();
  await collective.waitForDeployment();
  const collectiveAddr = await collective.getAddress();
  await collective.initialize(identityAddr);
  console.log("CovenantCollective:", collectiveAddr);

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log(JSON.stringify({
    CovenantIdentity: identityAddr,
    CovenantEscrow: escrowAddr,
    CovenantSettlement: settlementAddr,
    CovenantArbitration: arbitrationAddr,
    CovenantGovernance: governanceAddr,
    CovenantAttestation: attestationAddr,
    CovenantPaymaster: paymasterAddr,
    CovenantRouter: routerAddr,
    CovenantInsurance: insuranceAddr,
    CovenantCollective: collectiveAddr,
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
