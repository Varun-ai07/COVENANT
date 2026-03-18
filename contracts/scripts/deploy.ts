import hre from "hardhat";
const { ethers } = hre;
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("═══════════════════════════════════");
  console.log("    COVENANT DEPLOYMENT SCRIPT     ");
  console.log("═══════════════════════════════════");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.003")) {
    throw new Error("Need at least 0.003 ETH to deploy");
  }

  // 1. Deploy AgentRegistry
  console.log("\nDeploying AgentRegistry...");
  const Registry = await ethers.getContractFactory("AgentRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`✓ AgentRegistry: ${registryAddr}`);

  // 2. Deploy ReceiptVerifier
  console.log("Deploying ReceiptVerifier...");
  const Verifier = await ethers.getContractFactory("ReceiptVerifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log(`✓ ReceiptVerifier: ${verifierAddr}`);

  // 3. Deploy TaskEscrow
  console.log("Deploying TaskEscrow...");
  const Escrow = await ethers.getContractFactory("TaskEscrow");
  const escrow = await Escrow.deploy(registryAddr, verifierAddr);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log(`✓ TaskEscrow: ${escrowAddr}`);

  // 4. Configure permissions
  console.log("\nConfiguring permissions...");
  await registry.addAuthorizedContract(escrowAddr);
  console.log("  ✓ Authorized TaskEscrow in AgentRegistry");
  await verifier.addAuthorizedIssuer(escrowAddr);
  console.log("  ✓ Authorized TaskEscrow in ReceiptVerifier");

  // Save addresses
  const deployment = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      AgentRegistry: registryAddr,
      TaskEscrow: escrowAddr,
      ReceiptVerifier: verifierAddr,
    },
  };

  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(
    path.join("deployments", `${hre.network.name}.json`),
    JSON.stringify(deployment, null, 2)
  );
  console.log(`\n✓ Deployment saved to deployments/${hre.network.name}.json`);

  // Auto-update agents/.env
  const agentsEnvPath = path.join("..", "agents", ".env");
  if (fs.existsSync(agentsEnvPath)) {
    let env = fs.readFileSync(agentsEnvPath, "utf8");
    env = env
      .replace(/REGISTRY_ADDRESS=.*/, `REGISTRY_ADDRESS=${registryAddr}`)
      .replace(/ESCROW_ADDRESS=.*/, `ESCROW_ADDRESS=${escrowAddr}`)
      .replace(/VERIFIER_ADDRESS=.*/, `VERIFIER_ADDRESS=${verifierAddr}`);
    fs.writeFileSync(agentsEnvPath, env);
    console.log("✓ agents/.env updated automatically");
  }

  // Auto-update frontend/.env.local
  const frontendEnvPath = path.join("..", "frontend", ".env.local");
  if (fs.existsSync(frontendEnvPath)) {
    let env = fs.readFileSync(frontendEnvPath, "utf8");
    env = env
      .replace(/NEXT_PUBLIC_REGISTRY_ADDRESS=.*/, `NEXT_PUBLIC_REGISTRY_ADDRESS=${registryAddr}`)
      .replace(/NEXT_PUBLIC_ESCROW_ADDRESS=.*/, `NEXT_PUBLIC_ESCROW_ADDRESS=${escrowAddr}`)
      .replace(/NEXT_PUBLIC_VERIFIER_ADDRESS=.*/, `NEXT_PUBLIC_VERIFIER_ADDRESS=${verifierAddr}`);
    fs.writeFileSync(frontendEnvPath, env);
    console.log("✓ frontend/.env.local updated automatically");
  }

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  const spent = balance - finalBalance;

  console.log("\n═══════════════════════════════════");
  console.log("         DEPLOYMENT COMPLETE       ");
  console.log("═══════════════════════════════════");
  console.log(`Gas spent:  ${ethers.formatEther(spent)} ETH`);
  console.log(`Remaining:  ${ethers.formatEther(finalBalance)} ETH`);
  console.log("\nBasescan links:");
  console.log(`  https://sepolia.basescan.org/address/${registryAddr}`);
  console.log(`  https://sepolia.basescan.org/address/${escrowAddr}`);
  console.log(`  https://sepolia.basescan.org/address/${verifierAddr}`);
  console.log("\nNext step: cd agents && npx tsx demo.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
