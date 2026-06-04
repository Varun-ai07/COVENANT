const hre = require("hardhat");
const fs = require("fs");

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
    {
      name: "DisputeArbitrationMock",
      address: deployed.DisputeArbitration,
      // DisputeArbitrationMock constructor: (_registry, _escrow, _vrfCoordinator, _keyHash)
      // Using zero address for VRF on testnet (mock used)
      constructorArgs: [
        deployed.AgentRegistry,
        deployed.TaskEscrow,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      ],
      fullyQualifiedName: "contracts/DisputeArbitrationMock.sol:DisputeArbitrationMock",
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
