import { generateCapabilityProof, computeCommitment } from './proveCapability.js';

async function debug() {
  try {
    console.log("=== Debugging commitment computation ===");

    // Deterministic sample values for testing
    const capabilitySecret = BigInt(12345);
    const modelHash = BigInt(67890);
    const sessionNonce = BigInt(11111);
    const capabilityId = "test-capability";
    const agentAddress = "0x1234567890123456789012345678901234567890";

    console.log("capabilityId:", capabilityId);

    // Test the new hash function
    function hashCapabilityId(capabilityId: string): bigint {
      // Convert string to bigint by encoding it as bytes and converting to bigint
      const encoder = new TextEncoder();
      const bytes = encoder.encode(capabilityId);
      let result = 0n;
      for (let i = 0; i < bytes.length; i++) {
        result = (result << 8n) + BigInt(bytes[i]);
      }
      return result;
    }

    const capabilityIdHash = hashCapabilityId(capabilityId);
    console.log("capabilityIdHash:", capabilityIdHash.toString());

    console.log("Computing commitment...");
    const registeredCommitment = await computeCommitment(
      capabilitySecret,
      modelHash,
      capabilityId,
      agentAddress
    );
    console.log(`Generated commitment: ${registeredCommitment.toString()}`);

  } catch (error) {
    console.error("Error in debug:", error);
  }
}

debug().catch(console.error);