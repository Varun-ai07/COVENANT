import hre from "hardhat";
import fs from "fs";

async function main() {
  // Read existing deployed addresses
  const existingPath = "./deployed-addresses.json";
  let existing = {};
  if (fs.existsSync(existingPath)) {
    existing = JSON.parse(fs.readFileSync(existingPath, "utf8"));
    console.log("Found existing deployment:", existing);
  }

  // Determine which network we're on
  const network = hre.network.name;
  console.log(`\n========== Deploying ZK Integration to ${network} ==========\n`);
  console.log(`Account: ${(await ethers.getSigners())[0].address}`);
  console.log(`Balance: ${(await ethers.provider.getBalance(await (await ethers.getSigners())[0].getAddress())).toString()} wei\n`);

  // Step 1: Deploy Groth16Verifier (CapabilityVerifier)
  console.log("1. Deploying Groth16Verifier (ZK capability verifier)...");
  const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
  const groth16Verifier = await Groth16Verifier.deploy();
  await groth16Verifier.waitForDeployment();
  const groth16Address = await groth16Verifier.getAddress();
  console.log("✓ Groth16Verifier deployed to:", groth16Address);

  // Step 2: Check if AgentRegistry exists and configure it
  if (existing.AgentRegistry && existing.AgentRegistry !== "0x0000000000000000000000000000000000000000") {
    console.log("\n2. AgentRegistry already exists at:", existing.AgentRegistry);
    console.log("   Skipping deployment, will only configure...");

    // We need to call setCapabilityVerifier on the existing AgentRegistry
    const Registry = await ethers.getContractAt("AgentRegistry", existing.AgentRegistry);
    const tx = await Registry.setCapabilityVerifier(groth16Address);
    console.log("   Setting CapabilityVerifier...");
    await tx.wait();
    console.log("✓ AgentRegistry configured with CapabilityVerifier address");
  } else {
    console.log("\n2. Deploying AgentRegistry (fresh)...");
    const Registry = await ethers.getContractFactory("AgentRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log("✓ AgentRegistry deployed to:", registryAddress);

    // Configure
    const setTx = await registry.setCapabilityVerifier(groth16Address);
    await setTx.wait();
    console.log("✓ AgentRegistry configured with CapabilityVerifier");
    existing.AgentRegistry = registryAddress;
  }

  // Step 3: Deploy ReceiptVerifier (if not exists)
  if (existing.ReceiptVerifier && existing.ReceiptVerifier !== "0x0000000000000000000000000000000000000000") {
    console.log("\n3. ReceiptVerifier already exists at:", existing.ReceiptVerifier);
    console.log("   Skipping deployment...");
  } else {
    console.log("\n3. Deploying ReceiptVerifier...");
    const Verifier = await ethers.getContractFactory("ReceiptVerifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("✓ ReceiptVerifier deployed to:", verifierAddress);
    existing.ReceiptVerifier = verifierAddress;
  }

  // Step 4: Deploy TaskEscrow (if not exists)
  if (existing.TaskEscrow && existing.TaskEscrow !== "0x0000000000000000000000000000000000000000") {
    console.log("\n4. TaskEscrow already exists at:", existing.TaskEscrow);
    console.log("   Skipping deployment...");
  } else {
    console.log("\n4. Deploying TaskEscrow...");
    const Escrow = await ethers.getContractFactory("TaskEscrow");
    const escrow = await Escrow.deploy(existing.AgentRegistry, existing.ReceiptVerifier);
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();
    console.log("✓ TaskEscrow deployed to:", escrowAddress);
    existing.TaskEscrow = escrowAddress;
  }

  // Step 5: Configure cross-contract permissions (only for fresh deployments or missing permissions)
  console.log("\n5. Configuring cross-contract permissions...");
  const Registry = await ethers.getContractAt("AgentRegistry", existing.AgentRegistry);
  const verifierObj = await ethers.getContractAt("ReceiptVerifier", existing.ReceiptVerifier);

  // Authorize TaskEscrow in AgentRegistry
  try {
    const isAuthorized = await Registry.authorizedContracts(existing.TaskEscrow);
    if (!isAuthorized) {
      const tx1 = await Registry.addAuthorizedContract(existing.TaskEscrow);
      await tx1.wait();
      console.log("✓ Authorized TaskEscrow in AgentRegistry");
    } else {
      console.log("✓ TaskEscrow already authorized in AgentRegistry");
    }
  } catch (e) {
    console.log("  (could not verify authorization, may need manual check)");
  }

  // Authorize TaskEscrow in ReceiptVerifier
  try {
    const isAuthorized = await verifierObj.authorizedIssuers(existing.TaskEscrow);
    if (!isAuthorized) {
      const tx2 = await verifierObj.authorizedIssuer(existing.TaskEscrow);
      await tx2.wait();
      console.log("✓ Authorized TaskEscrow in ReceiptVerifier");
    } else {
      console.log("✓ TaskEscrow already authorized in ReceiptVerifier");
    }
  } catch (e) {
    console.log("  (could not verify authorization, may need manual check)");
  }

  // Save updated addresses
  existing.CapabilityVerifier = groth16Address;
  existing.network = network;
  existing.chainId = (await ethers.provider.getNetwork()).chainId.toString();
  existing.deployedAt = new Date().toISOString();

  fs.writeFileSync(
    "./deployed-addresses.json",
    JSON.stringify(existing, null, 2)
  );
  console.log("\n✓ Addresses saved to deployed-addresses.json");

  // Summary
  console.log("\n========================================");
  console.log("       ZK INTEGRATION COMPLETE");
  console.log("========================================");
  console.log("Network:           ", network);
  console.log("CapabilityVerifier: ", groth16Address);
  console.log("AgentRegistry:     ", existing.AgentRegistry);
  console.log("ReceiptVerifier:   ", existing.ReceiptVerifier);
  console.log("TaskEscrow:        ", existing.TaskEscrow);
  console.log("========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n✗ Deployment failed:", error);
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.error("\n💡 INSUFFICIENT FUNDS:");
      console.error("   - Get Base Sepolia ETH from: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
      console.error("   - Or use your own funded wallet (update PRIVATE_KEY in .env)");
    }
    process.exit(1);
  });
