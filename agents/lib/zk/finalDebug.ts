import { generateCapabilityProof, computeCommitment } from './proveCapability.js';

async function debug() {
  try {
    console.log("=== Final comparison ===");

    // Deterministic sample values for testing
    const capabilitySecret = BigInt(12345);
    const modelHash = BigInt(67890);
    const sessionNonce = BigInt(11111);
    const capabilityId = "test-capability";
    const agentAddress = "0x1234567890123456789012345678901234567890";

    console.log("Inputs:");
    console.log("- capabilitySecret:", capabilitySecret.toString());
    console.log("- modelHash:", modelHash.toString());
    console.log("- sessionNonce:", sessionNonce.toString());
    console.log("- capabilityId:", capabilityId);
    console.log("- agentAddress:", agentAddress);

    // Compute commitment using computeCommitment function
    console.log("\nComputing commitment with computeCommitment function:");
    const registeredCommitment = await computeCommitment(
      capabilitySecret,
      modelHash,
      capabilityId,
      agentAddress
    );
    console.log("registeredCommitment:", registeredCommitment.toString());

    // Test what the circuit would compute
    console.log("\nWhat the circuit expects:");
    console.log("- capabilitySecret:", capabilitySecret.toString());
    console.log("- modelHash:", modelHash.toString());
    console.log("- capabilityId:", capabilityId);
    console.log("- agentAddress:", agentAddress);

  } catch (error) {
    console.error("Error in debug:", error);
  }
}

debug().catch(console.error);