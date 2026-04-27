import { generateCapabilityProof, computeCommitment } from './proveCapability.js';
import * as circomlib from 'circomlibjs';

async function debugTest() {
  try {
    console.log("=== Testing commitment computation ===");

    // Test values
    const capabilitySecret = BigInt(12345);
    const modelHash = BigInt(67890);
    const sessionNonce = BigInt(11111);
    const capabilityId = "test-capability";
    const agentAddress = "0x1234567890123456789012345678901234567890";

    console.log("capabilitySecret:", capabilitySecret.toString());
    console.log("modelHash:", modelHash.toString());
    console.log("sessionNonce:", sessionNonce.toString());
    console.log("capabilityId:", capabilityId);
    console.log("agentAddress:", agentAddress);

    // Compute commitment
    const commitment = await computeCommitment(
      capabilitySecret,
      modelHash,
      capabilityId,
      agentAddress
    );
    console.log("Computed commitment:", commitment.toString());

  } catch (error) {
    console.error("Error in debug:", error);
  }
}

debugTest().catch(console.error);