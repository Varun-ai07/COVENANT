const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying Verification Contracts with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  
  const results = [];
  
  // 1. AutoVerifier
  console.log("\n[1/5] Deploying AutoVerifier...");
  const AutoVerifier = await hre.ethers.getContractFactory("contracts/v2/extensions/AutoVerifier.sol:AutoVerifier");
  const autoVerifier = await AutoVerifier.deploy();
  await autoVerifier.waitForDeployment();
  const avAddr = await autoVerifier.getAddress();
  console.log("  AutoVerifier:", avAddr);
  results.push({ name: "AutoVerifier", address: avAddr });
  
  // 2. MultiPartyReview
  console.log("\n[2/5] Deploying MultiPartyReview...");
  const MultiPartyReview = await hre.ethers.getContractFactory("contracts/v2/extensions/MultiPartyReview.sol:MultiPartyReview");
  const multiPartyReview = await MultiPartyReview.deploy();
  await multiPartyReview.waitForDeployment();
  const mprAddr = await multiPartyReview.getAddress();
  console.log("  MultiPartyReview:", mprAddr);
  results.push({ name: "MultiPartyReview", address: mprAddr });
  
  // 3. ClientReputation
  console.log("\n[3/5] Deploying ClientReputation...");
  const ClientReputation = await hre.ethers.getContractFactory("contracts/v2/extensions/ClientReputation.sol:ClientReputation");
  const clientReputation = await ClientReputation.deploy();
  await clientReputation.waitForDeployment();
  const crAddr = await clientReputation.getAddress();
  console.log("  ClientReputation:", crAddr);
  results.push({ name: "ClientReputation", address: crAddr });
  
  // 4. StakeSlashing
  console.log("\n[4/5] Deploying StakeSlashing...");
  const StakeSlashing = await hre.ethers.getContractFactory("contracts/v2/extensions/StakeSlashing.sol:StakeSlashing");
  const stakeSlashing = await StakeSlashing.deploy();
  await stakeSlashing.waitForDeployment();
  const ssAddr = await stakeSlashing.getAddress();
  console.log("  StakeSlashing:", ssAddr);
  results.push({ name: "StakeSlashing", address: ssAddr });
  
  // 5. MilestoneVerification
  console.log("\n[5/5] Deploying MilestoneVerification...");
  const MilestoneVerification = await hre.ethers.getContractFactory("contracts/v2/extensions/MilestoneVerification.sol:MilestoneVerification");
  const milestoneVerification = await MilestoneVerification.deploy();
  await milestoneVerification.waitForDeployment();
  const mvAddr = await milestoneVerification.getAddress();
  console.log("  MilestoneVerification:", mvAddr);
  results.push({ name: "MilestoneVerification", address: mvAddr });
  
  // Verify all on Basescan
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n=== Verifying on Basescan ===");
    for (const r of results) {
      try {
        await hre.run("verify:verify", {
          address: r.address,
          contract: `contracts/v2/extensions/${r.name}.sol:${r.name}`,
          constructorArguments: [],
        });
        console.log(`  ✅ ${r.name} verified`);
      } catch (e) {
        console.log(`  ⚠️ ${r.name}: ${e.message.substring(0, 80)}`);
      }
    }
  }
  
  console.log("\n=== Deployment Summary ===");
  for (const r of results) {
    console.log(`${r.name}: ${r.address}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
