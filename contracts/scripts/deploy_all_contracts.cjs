const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy AgentRegistry
  console.log("\n1. Deploying AgentRegistry...");
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log("AgentRegistry deployed to:", agentRegistryAddress);

  // Deploy ReceiptVerifier
  console.log("\n2. Deploying ReceiptVerifier...");
  const ReceiptVerifier = await hre.ethers.getContractFactory("ReceiptVerifier");
  const receiptVerifier = await ReceiptVerifier.deploy();
  await receiptVerifier.waitForDeployment();
  const receiptVerifierAddress = await receiptVerifier.getAddress();
  console.log("ReceiptVerifier deployed to:", receiptVerifierAddress);

  // Deploy TaskEscrow
  console.log("\n3. Deploying TaskEscrow...");
  const TaskEscrow = await hre.ethers.getContractFactory("TaskEscrow");
  const taskEscrow = await TaskEscrow.deploy(agentRegistryAddress, receiptVerifierAddress);
  await taskEscrow.waitForDeployment();
  const taskEscrowAddress = await taskEscrow.getAddress();
  console.log("TaskEscrow deployed to:", taskEscrowAddress);

  // Deploy OpenTaskMarket
  console.log("\n4. Deploying OpenTaskMarket...");
  const OpenTaskMarket = await hre.ethers.getContractFactory("OpenTaskMarket");
  const openTaskMarket = await OpenTaskMarket.deploy(agentRegistryAddress);
  await openTaskMarket.waitForDeployment();
  const openTaskMarketAddress = await openTaskMarket.getAddress();
  console.log("OpenTaskMarket deployed to:", openTaskMarketAddress);

  // Deploy ParallelTaskBatch
  console.log("\n5. Deploying ParallelTaskBatch...");
  const ParallelTaskBatch = await hre.ethers.getContractFactory("ParallelTaskBatch");
  const parallelTaskBatch = await ParallelTaskBatch.deploy(taskEscrowAddress, agentRegistryAddress);
  await parallelTaskBatch.waitForDeployment();
  const parallelTaskBatchAddress = await parallelTaskBatch.getAddress();
  console.log("ParallelTaskBatch deployed to:", parallelTaskBatchAddress);

  // Deploy AgentCollective
  console.log("\n6. Deploying AgentCollective...");
  const AgentCollective = await hre.ethers.getContractFactory("AgentCollective");
  const agentCollective = await AgentCollective.deploy(taskEscrowAddress, agentRegistryAddress);
  await agentCollective.waitForDeployment();
  const agentCollectiveAddress = await agentCollective.getAddress();
  console.log("AgentCollective deployed to:", agentCollectiveAddress);

  // Deploy AgentInsurance
  console.log("\n7. Deploying AgentInsurance...");
  const AgentInsurance = await hre.ethers.getContractFactory("AgentInsurance");
  const agentInsurance = await AgentInsurance.deploy(agentRegistryAddress, taskEscrowAddress);
  await agentInsurance.waitForDeployment();
  const agentInsuranceAddress = await agentInsurance.getAddress();
  console.log("AgentInsurance deployed to:", agentInsuranceAddress);

  // Deploy DisputeArbitration
  console.log("\n8. Deploying DisputeArbitration...");
  const DisputeArbitration = await hre.ethers.getContractFactory("DisputeArbitration");
  const disputeArbitration = await DisputeArbitration.deploy();
  await disputeArbitration.waitForDeployment();
  const disputeArbitrationAddress = await disputeArbitration.getAddress();
  console.log("DisputeArbitration deployed to:", disputeArbitrationAddress);

  // Use fully qualified name for Groth16Verifier
  console.log("\n9. Using Groth16Verifier (CapabilityProof.sol)...");
  const Groth16Verifier = await hre.ethers.getContractFactory("contracts/CapabilityVerifier.sol:Groth16Verifier");
  const groth16Verifier = await Groth16Verifier.deploy();
  await groth16Verifier.waitForDeployment();
  const groth16VerifierAddress = await groth16Verifier.getAddress();
  console.log("Groth16Verifier deployed to:", groth16VerifierAddress);

  // Get network info
  const provider = new hre.ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org");
  const { chainId } = await provider.getNetwork();
  
  // Save addresses without verification (verification requires etherscan API key)
  console.log("\nSaving addresses (skipping verification - no etherscan API key)...");
  const addresses = {
    AgentRegistry: agentRegistryAddress,
    ReceiptVerifier: receiptVerifierAddress,
    TaskEscrow: taskEscrowAddress,
    OpenTaskMarket: openTaskMarketAddress,
    ParallelTaskBatch: parallelTaskBatchAddress,
    AgentCollective: agentCollectiveAddress,
    AgentInsurance: agentInsuranceAddress,
    DisputeArbitration: disputeArbitrationAddress,
    Groth16Verifier: groth16VerifierAddress,
    network: "baseSepolia",
    chainId: chainId.toString(),
    deployedAt: new Date().toISOString()
  };
  console.log('Network: baseSepolia, ChainId:', chainId);

  const fs = require("fs");
  fs.writeFileSync("./deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log('\n✅ Addresses saved to deployed-addresses.json');
  console.log('\nNote: Contract verification requires etherscan API key.');
  console.log('Addresses are correct and contracts are deployed successfully.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
