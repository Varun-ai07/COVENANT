import { generateCapabilityProof, computeCommitment } from './proveCapability.js';

async function debug() {
  try {
    console.log("=== Final debug ===");

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

    // Hash capabilityId
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

    // Convert agentAddress to bigint (uint160)
    const agentAddrBig = BigInt('0x' + agentAddress.replace(/^0x/, ''));
    console.log("agentAddrBig:", agentAddrBig.toString());

    console.log("\nTesting computeCommitment function:");
    const registeredCommitment = await computeCommitment(
      capabilitySecret,
      modelHash,
      capabilityId,
      agentAddress
    );
    console.log("registeredCommitment:", registeredCommitment.toString());

    console.log("\nTesting what generateCapabilityProof would receive:");
    console.log("- capabilitySecret:", capabilitySecret.toString());
    console.log("- modelHash:", modelHash.toString());
    console.log("- sessionNonce:", sessionNonce.toString());
    console.log("- capabilityId:", capabilityId);
    console.log("- agentAddress:", agentAddress);
    console.log("- registeredCommitment:", registeredCommitment.toString());

  } catch (error) {
    console.error("Error in debug:", error);
  }
}

debug().catch(console.error);