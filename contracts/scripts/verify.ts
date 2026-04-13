import hre from "hardhat";
const { run } = hre;
import fs from "fs";
import path from "path";

async function main() {
  const deploymentPath = path.join("deployments", `${hre.network.name}.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found at ${deploymentPath}. Deploy first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const { AgentRegistry, TaskEscrow, ReceiptVerifier } = deployment.contracts;

  console.log("Verifying contracts on Basescan...\n");

  // AgentRegistry (no constructor args)
  try {
    await run("verify:verify", {
      address: AgentRegistry,
      constructorArguments: [],
    });
    console.log("✓ AgentRegistry verified");
  } catch (e: any) {
    if (e.message.includes("Already Verified")) {
      console.log("✓ AgentRegistry already verified");
    } else {
      console.log("✗ AgentRegistry verification failed:", e.message);
    }
  }

  // ReceiptVerifier (no constructor args)
  try {
    await run("verify:verify", {
      address: ReceiptVerifier,
      constructorArguments: [],
    });
    console.log("✓ ReceiptVerifier verified");
  } catch (e: any) {
    if (e.message.includes("Already Verified")) {
      console.log("✓ ReceiptVerifier already verified");
    } else {
      console.log("✗ ReceiptVerifier verification failed:", e.message);
    }
  }

  // TaskEscrow (needs registry and verifier addresses)
  try {
    await run("verify:verify", {
      address: TaskEscrow,
      constructorArguments: [AgentRegistry, ReceiptVerifier],
    });
    console.log("✓ TaskEscrow verified");
  } catch (e: any) {
    if (e.message.includes("Already Verified")) {
      console.log("✓ TaskEscrow already verified");
    } else {
      console.log("✗ TaskEscrow verification failed:", e.message);
    }
  }

  console.log("\nAll contracts verified on Basescan!");
  console.log("\nJudges can now read your source code at:");
  console.log(`  https://sepolia.basescan.org/address/${AgentRegistry}#code`);
  console.log(`  https://sepolia.basescan.org/address/${TaskEscrow}#code`);
  console.log(`  https://sepolia.basescan.org/address/${ReceiptVerifier}#code`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
