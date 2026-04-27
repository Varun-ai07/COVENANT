import { computeCommitment } from './proveCapability.js';

async function debugComputeCommitment() {
  console.log("Debugging computeCommitment function...");

  // Test values
  const capabilitySecret = BigInt(12345);
  const modelHash = BigInt(67890);
  const capabilityId = "test-capability";
  const agentAddress = "0x1234567890123456789012345678901234567890";

  console.log("capabilitySecret:", capabilitySecret.toString());
  console.log("modelHash:", modelHash.toString());
  console.log("capabilityId:", capabilityId);
  console.log("agentAddress:", agentAddress);

  // Test computeCommitment function
  const commitment = await computeCommitment(
    capabilitySecret,
    modelHash,
    capabilityId,
    agentAddress
  );
  console.log("Computed commitment:", commitment.toString());
}

debugComputeCommitment().catch(console.error);