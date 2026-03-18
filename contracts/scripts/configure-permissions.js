import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Configuring with account:", deployer.address);

  // Contract addresses from deployment
  const registryAddress = "0x8931A2fe53ab9bE4CC1187cf4B413c9C56d77Cb2";
  const verifierAddress = "0x5f9bfa2ad14dc97a7d32054AF46D07AeDe73757B";
  const escrowAddress = "0xef3194fbAAE98Fb2C614b1381F350340a990B1c0";

  console.log("\nConnecting to contracts...");
  const registry = await ethers.getContractAt("AgentRegistry", registryAddress);
  const verifier = await ethers.getContractAt("ReceiptVerifier", verifierAddress);

  console.log("\n1. Authorizing TaskEscrow in AgentRegistry...");
  const tx1 = await registry.addAuthorizedContract(escrowAddress);
  await tx1.wait();
  console.log("   Tx hash:", tx1.hash);

  console.log("\n2. Authorizing TaskEscrow in ReceiptVerifier...");
  const tx2 = await verifier.addAuthorizedIssuer(escrowAddress);
  await tx2.wait();
  console.log("   Tx hash:", tx2.hash);

  console.log("\nPermissions configured successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
