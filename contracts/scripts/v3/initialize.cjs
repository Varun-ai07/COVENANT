const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Initializing protocol with:", deployer.address);

  const addresses = require("../deployed-addresses-v3.json");

  const attestation = await ethers.getContractAt("CovenantAttestation", addresses.CovenantAttestation);

  console.log("\n--- Registering Schemas ---");
  const reputationSchema = ethers.keccak256(ethers.toUtf8Bytes("covenant.reputation.v1"));
  const capabilitySchema = ethers.keccak256(ethers.toUtf8Bytes("covenant.capability.v1"));
  const taskSchema = ethers.keccak256(ethers.toUtf8Bytes("covenant.task.v1"));

  await attestation.registerSchema(reputationSchema, "Reputation");
  await attestation.registerSchema(capabilitySchema, "Capability");
  await attestation.registerSchema(taskSchema, "TaskCompletion");
  console.log("Schemas registered");

  console.log("\n--- Registering Trusted Issuers ---");
  await attestation.registerIssuer(deployer.address, "Protocol Oracle");
  console.log("Issuer registered");

  console.log("\n=== INITIALIZATION COMPLETE ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
