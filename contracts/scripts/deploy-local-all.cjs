// Deploy ALL 16 COVENANT contracts to local Hardhat node
// Run: npx hardhat run scripts/deploy-local-all.cjs --network localhost
// Or:  npx hardhat run scripts/deploy-local-all.cjs (for ephemeral node)

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying all contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  const addresses = {};

  // ===== V1 CORE =====

  // 1. AgentRegistry
  console.log("[1/16] AgentRegistry (v1)...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  addresses.AgentRegistry = await registry.getAddress();
  console.log("       ", addresses.AgentRegistry);

  // 2. ReceiptVerifier
  console.log("[2/16] ReceiptVerifier (v1)...");
  const ReceiptVerifier = await ethers.getContractFactory("ReceiptVerifier");
  const verifier = await ReceiptVerifier.deploy();
  await verifier.waitForDeployment();
  addresses.ReceiptVerifier = await verifier.getAddress();
  console.log("       ", addresses.ReceiptVerifier);

  // 3. TaskEscrow
  console.log("[3/16] TaskEscrow (v1)...");
  const TaskEscrow = await ethers.getContractFactory("TaskEscrow");
  const escrow = await TaskEscrow.deploy(addresses.AgentRegistry, addresses.ReceiptVerifier);
  await escrow.waitForDeployment();
  addresses.TaskEscrow = await escrow.getAddress();
  console.log("       ", addresses.TaskEscrow);

  // Authorize escrow
  await registry.addAuthorizedContract(addresses.TaskEscrow);
  await verifier.addAuthorizedIssuer(addresses.TaskEscrow);
  console.log("       Authorized TaskEscrow on registry + verifier");

  // 4. COVENANTRouter
  console.log("[4/16] COVENANTRouter...");
  const COVENANTRouter = await ethers.getContractFactory("COVENANTRouter");
  const router = await COVENANTRouter.deploy(
    addresses.AgentRegistry,
    addresses.TaskEscrow,
    addresses.ReceiptVerifier
  );
  await router.waitForDeployment();
  addresses.COVENANTRouter = await router.getAddress();
  console.log("       ", addresses.COVENANTRouter);

  // 5. MultiTokenEscrow
  console.log("[5/16] MultiTokenEscrow...");
  const MultiTokenEscrow = await ethers.getContractFactory("MultiTokenEscrow");
  const multiToken = await MultiTokenEscrow.deploy(addresses.AgentRegistry, deployer.address);
  await multiToken.waitForDeployment();
  addresses.MultiTokenEscrow = await multiToken.getAddress();
  console.log("       ", addresses.MultiTokenEscrow);
  await registry.addAuthorizedContract(addresses.MultiTokenEscrow);

  // 6. ParallelTaskBatch
  console.log("[6/16] ParallelTaskBatch...");
  const ParallelTaskBatch = await ethers.getContractFactory("ParallelTaskBatch");
  const batch = await ParallelTaskBatch.deploy(addresses.TaskEscrow, addresses.AgentRegistry);
  await batch.waitForDeployment();
  addresses.ParallelTaskBatch = await batch.getAddress();
  console.log("       ", addresses.ParallelTaskBatch);

  // 7. AgentInsurance
  console.log("[7/16] AgentInsurance...");
  const AgentInsurance = await ethers.getContractFactory("AgentInsurance");
  const insurance = await AgentInsurance.deploy(addresses.AgentRegistry, addresses.TaskEscrow);
  await insurance.waitForDeployment();
  addresses.AgentInsurance = await insurance.getAddress();
  console.log("       ", addresses.AgentInsurance);

  // 8. DisputeArbitration
  console.log("[8/16] DisputeArbitration...");
  const DisputeArbitration = await ethers.getContractFactory("DisputeArbitration");
  const dispute = await DisputeArbitration.deploy(addresses.AgentRegistry, addresses.TaskEscrow);
  await dispute.waitForDeployment();
  addresses.DisputeArbitration = await dispute.getAddress();
  console.log("       ", addresses.DisputeArbitration);

  // ===== V2 CORE =====

  const MOCK_VERIFIER = "0x0000000000000000000000000000000000000001";

  // 9. AgentRegistry v2
  console.log("[9/16] AgentRegistry (v2)...");
  const AgentRegistryV2 = await ethers.getContractFactory("contracts/v2/core/AgentRegistry.sol:AgentRegistry");
  const registryV2 = await AgentRegistryV2.deploy(MOCK_VERIFIER, MOCK_VERIFIER);
  await registryV2.waitForDeployment();
  addresses.AgentRegistryV2 = await registryV2.getAddress();
  console.log("       ", addresses.AgentRegistryV2);

  // 10. ReceiptVerifier v2
  console.log("[10/16] ReceiptVerifier (v2)...");
  const ReceiptVerifierV2 = await ethers.getContractFactory("contracts/v2/core/ReceiptVerifier.sol:ReceiptVerifier");
  const verifierV2 = await ReceiptVerifierV2.deploy();
  await verifierV2.waitForDeployment();
  addresses.ReceiptVerifierV2 = await verifierV2.getAddress();
  console.log("       ", addresses.ReceiptVerifierV2);

  // 11. TaskEscrow v2
  console.log("[11/16] TaskEscrow (v2)...");
  const TaskEscrowV2 = await ethers.getContractFactory("contracts/v2/core/TaskEscrow.sol:TaskEscrow");
  const escrowV2 = await TaskEscrowV2.deploy(
    addresses.AgentRegistryV2,
    addresses.ReceiptVerifierV2,
    deployer.address
  );
  await escrowV2.waitForDeployment();
  addresses.TaskEscrowV2 = await escrowV2.getAddress();
  console.log("       ", addresses.TaskEscrowV2);

  // Authorize escrowV2
  const AUTHORIZED_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUTHORIZED_ROLE"));
  await registryV2.grantRole(AUTHORIZED_ROLE, addresses.TaskEscrowV2);
  await verifierV2.addAuthorizedIssuer(addresses.TaskEscrowV2);
  console.log("       Authorized TaskEscrowV2 on registry + verifier");

  // 12. AgentSmartWallet
  console.log("[12/16] AgentSmartWallet...");
  const AgentSmartWallet = await ethers.getContractFactory("contracts/v2/core/AgentSmartWallet.sol:AgentSmartWallet");
  const wallet = await AgentSmartWallet.deploy();
  await wallet.waitForDeployment();
  addresses.AgentSmartWallet = await wallet.getAddress();
  console.log("       ", addresses.AgentSmartWallet);

  // 13. CovenantPaymaster
  console.log("[13/16] CovenantPaymaster...");
  const CovenantPaymaster = await ethers.getContractFactory("contracts/v2/core/CovenantPaymaster.sol:CovenantPaymaster");
  const paymaster = await CovenantPaymaster.deploy(deployer.address, deployer.address);
  await paymaster.waitForDeployment();
  addresses.CovenantPaymaster = await paymaster.getAddress();
  console.log("       ", addresses.CovenantPaymaster);

  // ===== V2 EXTENSIONS =====

  // 14. StakeSlashing
  console.log("[14/16] StakeSlashing...");
  const StakeSlashing = await ethers.getContractFactory("contracts/v2/extensions/StakeSlashing.sol:StakeSlashing");
  const slashing = await StakeSlashing.deploy();
  await slashing.waitForDeployment();
  addresses.StakeSlashing = await slashing.getAddress();
  console.log("       ", addresses.StakeSlashing);

  // ===== V2 MIGRATION =====

  // 15. Migration
  console.log("[15/16] Migration...");
  const Migration = await ethers.getContractFactory("contracts/v2/migration/Migration.sol:Migration");
  const migration = await Migration.deploy(
    addresses.AgentRegistry,
    addresses.TaskEscrow,
    addresses.ReceiptVerifier,
    addresses.AgentRegistryV2,
    addresses.TaskEscrowV2,
    addresses.ReceiptVerifierV2
  );
  await migration.waitForDeployment();
  addresses.Migration = await migration.getAddress();
  console.log("       ", addresses.Migration);

  // 16. MockERC20 (for multi-token tests)
  console.log("[16/16] MockERC20...");
  const MockERC20 = await ethers.getContractFactory("contracts/test/MockERC20.sol:MockERC20");
  const token = await MockERC20.deploy("COVENANT Test Token", "CVT");
  await token.waitForDeployment();
  addresses.MockERC20 = await token.getAddress();
  console.log("       ", addresses.MockERC20);

  // Save addresses
  const output = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: addresses,
  };

  const outPath = path.resolve(__dirname, "../deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log("\n✅ All 16 contracts deployed! Addresses saved to deployed-addresses.json");

  // Print env vars for offchain coordinator
  console.log("\n=== ENV VARS FOR OFFCHAIN COORDINATOR ===");
  console.log(`RPC_URL=http://127.0.0.1:8545`);
  console.log(`CHAIN_ID=31337`);
  console.log(`REGISTRY_ADDRESS=${addresses.AgentRegistry}`);
  console.log(`ESCROW_ADDRESS=${addresses.TaskEscrow}`);
  console.log(`VERIFIER_ADDRESS=${addresses.ReceiptVerifier}`);
  console.log(`ROUTER_ADDRESS=${addresses.COVENANTRouter}`);
  console.log(`BATCH_ADDRESS=${addresses.ParallelTaskBatch}`);
  console.log(`INSURANCE_ADDRESS=${addresses.AgentInsurance}`);
  console.log(`DISPUTE_ADDRESS=${addresses.DisputeArbitration}`);
  console.log(`MULTI_TOKEN_ADDRESS=${addresses.MultiTokenEscrow}`);
  console.log(`AGENT_REGISTRY_V2=${addresses.AgentRegistryV2}`);
  console.log(`TASK_ESCROW_V2=${addresses.TaskEscrowV2}`);
  console.log(`RECEIPT_VERIFIER_V2=${addresses.ReceiptVerifierV2}`);
  console.log(`STAKESLASHING_ADDRESS=${addresses.StakeSlashing}`);
  console.log(`MOCK_ERC20=${addresses.MockERC20}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
