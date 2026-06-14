// Deployment script for COVENANT v2 contracts
// Run: npx hardhat run scripts/deploy-v2.cjs --network baseSepolia

const hre = require("hardhat");
const { ethers } = hre;



async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying v2 contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 1. AgentRegistry
  console.log("\n1. Deploying AgentRegistry v2...");
  const AgentRegistry = await ethers.getContractFactory("contracts/v2/core/AgentRegistry.sol:AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("   AgentRegistry v2:", registryAddr);

  // 2. ReceiptVerifier
  console.log("\n2. Deploying ReceiptVerifier v2...");
  const ReceiptVerifier = await ethers.getContractFactory("contracts/v2/core/ReceiptVerifier.sol:ReceiptVerifier");
  const verifier = await ReceiptVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log("   ReceiptVerifier v2:", verifierAddr);

  // 3. TaskEscrow
  console.log("\n3. Deploying TaskEscrow v2...");
  const TaskEscrow = await ethers.getContractFactory("contracts/v2/core/TaskEscrow.sol:TaskEscrow");
  const escrow = await TaskEscrow.deploy(registryAddr, verifierAddr, deployer.address);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("   TaskEscrow v2:", escrowAddr);

  // 4. AgentSmartWallet
  console.log("\n4. Deploying AgentSmartWallet...");
  const AgentSmartWallet = await ethers.getContractFactory("contracts/v2/core/AgentSmartWallet.sol:AgentSmartWallet");
  const wallet = await AgentSmartWallet.deploy(deployer.address, ethers.parseEther("1"), ethers.parseEther("0.1"));
  await wallet.waitForDeployment();
  const walletAddr = await wallet.getAddress();
  console.log("   AgentSmartWallet:", walletAddr);

  // 5. CovenantPaymaster
  console.log("\n5. Deploying CovenantPaymaster...");
  const CovenantPaymaster = await ethers.getContractFactory("contracts/v2/core/CovenantPaymaster.sol:CovenantPaymaster");
  const paymaster = await CovenantPaymaster.deploy();
  await paymaster.waitForDeployment();
  const paymasterAddr = await paymaster.getAddress();
  console.log("   CovenantPaymaster:", paymasterAddr);

  // 6. StakeSlashing
  console.log("\n6. Deploying StakeSlashing...");
  const StakeSlashing = await ethers.getContractFactory("contracts/v2/extensions/StakeSlashing.sol:StakeSlashing");
  const slashing = await StakeSlashing.deploy();
  await slashing.waitForDeployment();
  const slashingAddr = await slashing.getAddress();
  console.log("   StakeSlashing:", slashingAddr);

  // 7. Authorize escrow on registry + receipt verifier
  console.log("\n7. Authorizing TaskEscrow on AgentRegistry...");
  await registry.addAuthorizedContract(escrowAddr);
  console.log("   Done.");

  console.log("\n8. Authorizing TaskEscrow as receipt issuer on ReceiptVerifier...");
  await verifier.addAuthorizedIssuer(escrowAddr);
  console.log("   Done.");

  // Save addresses
  const addresses = {
    network: "base-sepolia",
    chainId: 84532,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      AgentRegistry: registryAddr,
      TaskEscrow: escrowAddr,
      ReceiptVerifier: verifierAddr,
      AgentSmartWallet: walletAddr,
      CovenantPaymaster: paymasterAddr,
      StakeSlashing: slashingAddr,
    },
  };

  const fs = require("fs");
  const outDir = __dirname + "/../v2";
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    outDir + "/deployed-addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n✅ All v2 contracts deployed! Addresses saved to v2/deployed-addresses.json");

  // Print summary
  console.log("\n=== DEPLOYED ADDRESSES ===");
  console.log("AgentRegistry v2:   ", registryAddr);
  console.log("TaskEscrow v2:      ", escrowAddr);
  console.log("ReceiptVerifier v2: ", verifierAddr);
  console.log("AgentSmartWallet:   ", walletAddr);
  console.log("CovenantPaymaster:  ", paymasterAddr);
  console.log("StakeSlashing:      ", slashingAddr);

  console.log("\n=== ENV VARS FOR MCP ===");
  console.log(`CONTRACT_VERSION=v2`);
  console.log(`AGENT_REGISTRY_V2=${registryAddr}`);
  console.log(`TASK_ESCROW_V2=${escrowAddr}`);
  console.log(`RECEIPT_VERIFIER_V2=${verifierAddr}`);
  console.log(`AGENT_SMART_WALLET=${walletAddr}`);
  console.log(`COVENANT_PAYMASTER=${paymasterAddr}`);
  console.log(`STAKE_SLASHING=${slashingAddr}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
