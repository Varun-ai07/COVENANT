const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");

// Base Sepolia Chainlink VRF config (lowercase to avoid checksum issues)
const VRF_COORDINATOR = "0x8103b0a8a00be2ddc778e6e673adf21e4b0c68d9";
const VRF_KEY_HASH = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Load existing deployed addresses
  let deployed = {};
  const deployedPath = __dirname + "/../deployed-addresses.json";
  if (fs.existsSync(deployedPath)) {
    deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  }

  const deployments = { ...deployed };

  // ========================================
  // 1. CapabilityVerifier (Groth16 Verifier)
  // ========================================
  if (!deployments.Groth16VerifierCapability) {
    console.log("\n1. Deploying Groth16Verifier (Capability)...");
    const Groth16VerifierCapability = await ethers.getContractFactory("contracts/CapabilityVerifier.sol:Groth16Verifier");
    const capabilityVerifierBase = await Groth16VerifierCapability.deploy();
    await capabilityVerifierBase.waitForDeployment();
    const capabilityVerifierBaseAddr = await capabilityVerifierBase.getAddress();
    console.log("Groth16Verifier (Capability) deployed to:", capabilityVerifierBaseAddr);
    deployments.Groth16VerifierCapability = capabilityVerifierBaseAddr;
  } else {
    console.log("\n1. Groth16VerifierCapability already deployed at:", deployments.Groth16VerifierCapability);
  }

  // 1b. CapabilityVerifierWrapper
  if (!deployments.CapabilityVerifier) {
    console.log("\n2. Deploying CapabilityVerifierWrapper...");
    const CapabilityVerifier = await ethers.getContractFactory("contracts/CapabilityVerifierWrapper.sol:CapabilityVerifier");
    const capabilityVerifier = await CapabilityVerifier.deploy(deployments.Groth16VerifierCapability);
    await capabilityVerifier.waitForDeployment();
    const capabilityVerifierAddr = await capabilityVerifier.getAddress();
    console.log("CapabilityVerifier deployed to:", capabilityVerifierAddr);
    deployments.CapabilityVerifier = capabilityVerifierAddr;
  } else {
    console.log("\n2. CapabilityVerifier already deployed at:", deployments.CapabilityVerifier);
  }

  // ========================================
  // 2. ReputationVerifier (Groth16 Verifier)
  // ========================================
  if (!deployments.Groth16VerifierReputation) {
    console.log("\n3. Deploying Groth16Verifier (Reputation)...");
    const Groth16VerifierReputation = await ethers.getContractFactory("contracts/ReputationVerifier.sol:Groth16Verifier");
    const reputationVerifierBase = await Groth16VerifierReputation.deploy();
    await reputationVerifierBase.waitForDeployment();
    const reputationVerifierBaseAddr = await reputationVerifierBase.getAddress();
    console.log("Groth16Verifier (Reputation) deployed to:", reputationVerifierBaseAddr);
    deployments.Groth16VerifierReputation = reputationVerifierBaseAddr;
  } else {
    console.log("\n3. Groth16VerifierReputation already deployed at:", deployments.Groth16VerifierReputation);
  }

  // 2b. ReputationVerifierWrapper
  if (!deployments.ReputationVerifier) {
    console.log("\n4. Deploying ReputationVerifierWrapper...");
    const ReputationVerifier = await ethers.getContractFactory("contracts/ReputationVerifierWrapper.sol:ReputationVerifier");
    const reputationVerifier = await ReputationVerifier.deploy(deployments.Groth16VerifierReputation);
    await reputationVerifier.waitForDeployment();
    const reputationVerifierAddr = await reputationVerifier.getAddress();
    console.log("ReputationVerifier deployed to:", reputationVerifierAddr);
    deployments.ReputationVerifier = reputationVerifierAddr;
  } else {
    console.log("\n4. ReputationVerifier already deployed at:", deployments.ReputationVerifier);
  }

  // ========================================
  // 3. COVENANTRouter
  // ========================================
  if (!deployments.COVENANTRouter) {
    console.log("\n5. Deploying COVENANTRouter...");
    const Router = await ethers.getContractFactory("COVENANTRouter");
    const router = await Router.deploy(
      deployments.AgentRegistry,
      deployments.TaskEscrow,
      deployments.ReceiptVerifier
    );
    await router.waitForDeployment();
    const routerAddr = await router.getAddress();
    console.log("COVENANTRouter deployed to:", routerAddr);
    deployments.COVENANTRouter = routerAddr;
  } else {
    console.log("\n5. COVENANTRouter already deployed at:", deployments.COVENANTRouter);
  }

  // ========================================
  // 4. LitProtocolIntegration
  // ========================================
  if (!deployed.LitProtocolIntegration) {
    console.log("\n6. Deploying LitProtocolIntegration...");
    const Lit = await ethers.getContractFactory("LitProtocolIntegration");
    const lit = await Lit.deploy(deployments.TaskEscrow, deployments.AgentRegistry);
    await lit.waitForDeployment();
    const litAddr = await lit.getAddress();
    console.log("LitProtocolIntegration deployed to:", litAddr);
    deployments.LitProtocolIntegration = litAddr;
  }

  // ========================================
  // 5. DisputeArbitration (VRF)
  // ========================================
  if (!deployed.DisputeArbitration) {
    console.log("\n7. Deploying DisputeArbitration...");
    console.log("Note: Requires Chainlink VRF subscription on Base Sepolia");
    console.log("VRF Coordinator:", VRF_COORDINATOR);
    console.log("Key Hash:", VRF_KEY_HASH);
    console.log("You must create a VRF subscription at https://vrf.chain.link/");

    // Deploy with placeholder subscription (must be funded and configured after)
    const Dispute = await ethers.getContractFactory("DisputeArbitration");
    const dispute = await Dispute.deploy(
      deployments.AgentRegistry,
      deployments.TaskEscrow,
      VRF_COORDINATOR,
      VRF_KEY_HASH,
      0 // subscription ID must be set after creating subscription
    );
    await dispute.waitForDeployment();
    const disputeAddr = await dispute.getAddress();
    console.log("DisputeArbitration deployed to:", disputeAddr);
    deployments.DisputeArbitration = disputeAddr;
    console.log("\nIMPORTANT: Create a VRF subscription at https://vrf.chain.link/");
    console.log("Then call dispute.setSubscriptionId(subscriptionId)");
    console.log("And add the contract as a consumer on the VRF dashboard");
  }

  // ========================================
  // 6. AgentWallet (sample deploy)
  // ========================================
  if (!deployed.AgentWallet) {
    console.log("\n8. Deploying AgentWallet...");
    const Wallet = await ethers.getContractFactory("AgentWallet");
    // Deploy with deployer as owner and human controller
    const wallet = await Wallet.deploy(deployer.address, deployer.address);
    await wallet.waitForDeployment();
    const walletAddr = await wallet.getAddress();
    console.log("AgentWallet (sample) deployed to:", walletAddr);
    deployments.AgentWallet = walletAddr;
    console.log("Note: Each agent deploys their own wallet, this is just a sample");
  }

  // Save deployments
  deployments.network = "baseSepolia";
  deployments.chainId = "84532";
  deployments.updatedAt = new Date().toISOString();
  fs.writeFileSync(deployedPath, JSON.stringify(deployments, null, 2));

  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log(JSON.stringify(deployments, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
