const hre = require("hardhat");
const fs = require("fs");

// Base Sepolia VRF config
const VRF_COORDINATOR = "0x8103b0a8a00be2ddc778e6e673adf21e4b0c68d9";
const VRF_KEY_HASH = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";

async function main() {
  // Load deployed addresses
  const deployed = JSON.parse(fs.readFileSync("./deployed-addresses.json", "utf8"));

  console.log("========================================");
  console.log("COVENANT CONTRACT VERIFICATION");
  console.log("Network:", deployed.network);
  console.log("Chain ID:", deployed.chainId);
  console.log("========================================\n");

  // Check if we have an API key
  if (!process.env.BASESCAN_API_KEY || process.env.BASESCAN_API_KEY === "your_basescan_api_key_here") {
    console.error("ERROR: BASESCAN_API_KEY not set in .env");
    console.error("Get your key at: https://sepolia.basescan.org/myapikey");
    process.exit(1);
  }

  // Contract verification configurations
  const contractsToVerify = [
    // Original 7 contracts
    {
      name: "AgentRegistry",
      address: deployed.AgentRegistry,
      constructorArgs: [],
    },
    {
      name: "ReceiptVerifier",
      address: deployed.ReceiptVerifier,
      constructorArgs: [],
    },
    {
      name: "TaskEscrow",
      address: deployed.TaskEscrow,
      constructorArgs: [deployed.AgentRegistry, deployed.ReceiptVerifier],
    },
    {
      name: "OpenTaskMarket",
      address: deployed.OpenTaskMarket,
      constructorArgs: [deployed.AgentRegistry],
    },
    {
      name: "ParallelTaskBatch",
      address: deployed.ParallelTaskBatch,
      constructorArgs: [deployed.TaskEscrow, deployed.AgentRegistry],
    },
    {
      name: "AgentCollective",
      address: deployed.AgentCollective,
      constructorArgs: [deployed.TaskEscrow, deployed.AgentRegistry],
    },
    {
      name: "AgentInsurance",
      address: deployed.AgentInsurance,
      constructorArgs: [deployed.AgentRegistry, deployed.TaskEscrow],
    },
    // ZK Verifiers - Capability
    {
      name: "Groth16VerifierCapability",
      address: deployed.Groth16VerifierCapability,
      constructorArgs: [],
      fullyQualifiedName: "contracts/CapabilityVerifier.sol:Groth16Verifier",
    },
    {
      name: "CapabilityVerifier",
      address: deployed.CapabilityVerifier,
      constructorArgs: [deployed.Groth16VerifierCapability],
      fullyQualifiedName: "contracts/CapabilityVerifierWrapper.sol:CapabilityVerifier",
    },
    // ZK Verifiers - Reputation
    {
      name: "Groth16VerifierReputation",
      address: deployed.Groth16VerifierReputation,
      constructorArgs: [],
      fullyQualifiedName: "contracts/ReputationVerifier.sol:Groth16Verifier",
    },
    {
      name: "ReputationVerifier",
      address: deployed.ReputationVerifier,
      constructorArgs: [deployed.Groth16VerifierReputation],
      fullyQualifiedName: "contracts/ReputationVerifierWrapper.sol:ReputationVerifier",
    },
    // Router
    {
      name: "COVENANTRouter",
      address: deployed.COVENANTRouter,
      constructorArgs: [deployed.AgentRegistry, deployed.TaskEscrow, deployed.ReceiptVerifier],
    },
    // Lit Protocol
    {
      name: "LitProtocolIntegration",
      address: deployed.LitProtocolIntegration,
      constructorArgs: [deployed.TaskEscrow, deployed.AgentRegistry],
    },
    // Dispute Arbitration (VRF)
    {
      name: "DisputeArbitration",
      address: deployed.DisputeArbitration,
      constructorArgs: [
        deployed.AgentRegistry,
        deployed.TaskEscrow,
        VRF_COORDINATOR,
        VRF_KEY_HASH,
        0 // subscriptionId
      ],
    },
    // Agent Wallet (sample)
    {
      name: "AgentWallet",
      address: deployed.AgentWallet,
      constructorArgs: [deployed.owner, deployed.owner], // owner and humanController
    },
  ];

  let verified = 0;
  let failed = 0;

  for (const contract of contractsToVerify) {
    if (!contract.address || contract.address === "0x0000000000000000000000000000000000000000") {
      console.log(`Skipping ${contract.name} - not deployed`);
      continue;
    }

    console.log(`\nVerifying ${contract.name}...`);
    console.log(`  Address: ${contract.address}`);

    try {
      const verifyArgs = {
        address: contract.address,
        constructorArguments: contract.constructorArgs,
      };

      // Add fully qualified name for contracts with naming conflicts
      if (contract.fullyQualifiedName) {
        verifyArgs.contract = contract.fullyQualifiedName;
      }

      await hre.run("verify:verify", verifyArgs);
      console.log(`  ✅ ${contract.name} verified!`);
      verified++;
    } catch (e) {
      if (e.message.includes("Already Verified")) {
        console.log(`  ✅ ${contract.name} already verified!`);
        verified++;
      } else {
        console.log(`  ❌ ${contract.name} verification failed:`, e.message);
        failed++;
      }
    }
  }

  console.log("\n========================================");
  console.log("VERIFICATION SUMMARY");
  console.log("========================================");
  console.log(`Verified: ${verified}/${contractsToVerify.length}`);
  console.log(`Failed: ${failed}`);
  console.log("========================================");

  // Print Basescan links
  console.log("\nBasescan Links:");
  const baseUrl = deployed.chainId === "84532"
    ? "https://sepolia.basescan.org/address/"
    : "https://basescan.org/address/";

  for (const contract of contractsToVerify) {
    if (contract.address && contract.address !== "0x0000000000000000000000000000000000000000") {
      console.log(`${contract.name}: ${baseUrl}${contract.address}#code`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
