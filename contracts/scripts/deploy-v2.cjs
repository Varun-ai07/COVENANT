// Deployment script for COVENANT v2 contracts
// Run: npx hardhat run scripts/deploy-v2.cjs --network baseSepolia

const hre = require("hardhat");
const { ethers } = hre;

// Existing deployed contract addresses (Base Sepolia)
const EXISTING = {
  groth16Verifier: "0xd7108ed5C8577B30f6FC024319ebE8B380DaAb85",
  capabilityVerifier: "0x628CB2cA13f6FeAc48e0f24f45C3AF2Dbb1c02Fb",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying v2 contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 1. AgentRegistry
  console.log("\n1. Deploying AgentRegistry v2...");
  const AgentRegistry = await ethers.getContractFactory("contracts/v2/core/AgentRegistry.sol:AgentRegistry");
  const registry = await AgentRegistry.deploy(EXISTING.groth16Verifier, EXISTING.capabilityVerifier);
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

  // 4. InsurancePool
  console.log("\n4. Deploying InsurancePool...");
  const InsurancePool = await ethers.getContractFactory("contracts/v2/extensions/InsurancePool.sol:InsurancePool");
  const insurance = await InsurancePool.deploy();
  await insurance.waitForDeployment();
  const insuranceAddr = await insurance.getAddress();
  console.log("   InsurancePool:", insuranceAddr);

  // 5. DisputeResolution
  console.log("\n5. Deploying DisputeResolution...");
  const DisputeResolution = await ethers.getContractFactory("contracts/v2/extensions/DisputeResolution.sol:DisputeResolution");
  const dispute = await DisputeResolution.deploy();
  await dispute.waitForDeployment();
  const disputeAddr = await dispute.getAddress();
  console.log("   DisputeResolution:", disputeAddr);

  // 6. Authorize escrow on registry + receipt verifier
  console.log("\n6. Authorizing TaskEscrow on AgentRegistry...");
  await registry.addAuthorizedContract(escrowAddr);
  console.log("   Done.");

  console.log("\n7. Authorizing TaskEscrow as receipt issuer on ReceiptVerifier...");
  await verifier.addAuthorizedIssuer(escrowAddr);
  console.log("   Done.");

  // 8. MultiTokenEscrow
  console.log("\n8. Deploying MultiTokenEscrow...");
  const MultiTokenEscrow = await ethers.getContractFactory("contracts/MultiTokenEscrow.sol:MultiTokenEscrow");
  const multiToken = await MultiTokenEscrow.deploy(registryAddr, deployer.address);
  await multiToken.waitForDeployment();
  const multiTokenAddr = await multiToken.getAddress();
  console.log("   MultiTokenEscrow:", multiTokenAddr);

  console.log("\n9. Authorizing MultiTokenEscrow on AgentRegistry...");
  await (await registry.addAuthorizedContract(multiTokenAddr)).wait();
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
      InsurancePool: insuranceAddr,
      DisputeResolution: disputeAddr,
      MultiTokenEscrow: multiTokenAddr,
    },
    existing: EXISTING,
  };

  const fs = require("fs");
  fs.writeFileSync(
    __dirname + "/../v2/deployed-addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n✅ All v2 contracts deployed! Addresses saved to v2/deployed-addresses.json");

  // Print summary
  console.log("\n=== DEPLOYED ADDRESSES ===");
  console.log("AgentRegistry v2:   ", registryAddr);
  console.log("TaskEscrow v2:      ", escrowAddr);
  console.log("ReceiptVerifier v2: ", verifierAddr);
  console.log("InsurancePool:      ", insuranceAddr);
  console.log("DisputeResolution:  ", disputeAddr);
  console.log("MultiTokenEscrow:   ", multiTokenAddr);

  console.log("\n=== ENV VARS FOR MCP ===");
  console.log(`CONTRACT_VERSION=v2`);
  console.log(`AGENT_REGISTRY_V2=${registryAddr}`);
  console.log(`TASK_ESCROW_V2=${escrowAddr}`);
  console.log(`RECEIPT_VERIFIER_V2=${verifierAddr}`);
  console.log(`INSURANCE_POOL=${insuranceAddr}`);
  console.log(`DISPUTE_RESOLUTION=${disputeAddr}`);
  console.log(`MULTI_TOKEN_ESCROW=${multiTokenAddr}`);

  // Verify on Basescan (skip for localhost/hardhat)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for block confirmations...");
    for (const contract of [registry, verifier, escrow, insurance, dispute, multiToken]) {
      await contract.deploymentTransaction().wait(5);
    }

    console.log("\nVerifying on Basescan...");
    const contracts = [
      ["AgentRegistry", registryAddr, [EXISTING.groth16Verifier, EXISTING.capabilityVerifier]],
      ["ReceiptVerifier", verifierAddr, []],
      ["TaskEscrow", escrowAddr, [registryAddr, verifierAddr, deployer.address]],
      ["InsurancePool", insuranceAddr, []],
      ["DisputeResolution", disputeAddr, []],
      ["MultiTokenEscrow", multiTokenAddr, [registryAddr, deployer.address]],
    ];
    const contractPaths = [
      "contracts/v2/core/AgentRegistry.sol:AgentRegistry",
      "contracts/v2/core/ReceiptVerifier.sol:ReceiptVerifier",
      "contracts/v2/core/TaskEscrow.sol:TaskEscrow",
      "contracts/v2/extensions/InsurancePool.sol:InsurancePool",
      "contracts/v2/extensions/DisputeResolution.sol:DisputeResolution",
      "contracts/MultiTokenEscrow.sol:MultiTokenEscrow",
    ];
    for (let i = 0; i < contracts.length; i++) {
      const [name, address, args] = contracts[i];
      try {
        await hre.run("verify:verify", {
          address,
          constructorArguments: args,
          contract: contractPaths[i],
        });
        console.log("  " + name + " verified!");
      } catch (e) {
        console.log("  " + name + " verification: " + e.message.substring(0, 120));
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
