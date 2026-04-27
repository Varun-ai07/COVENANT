import { generateCapabilityProof, computeCommitment } from './proveCapability.js';

async function test() {
  try {
    console.log("=== Testing proof generation ===");

    // Deterministic sample values for testing
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
    const registeredCommitment = await computeCommitment(
      capabilitySecret,
      modelHash,
      capabilityId,
      agentAddress
    );
    console.log("registeredCommitment:", registeredCommitment.toString());

    console.log("Generating proof...");
    const proof = await generateCapabilityProof({
      capabilitySecret,
      modelHash,
      sessionNonce,
      capabilityId,
      agentAddress,
      registeredCommitment
    });

    console.log("Proof generated successfully!");
    console.log("Proof:", JSON.stringify(proof, null, 2));

  } catch (error) {
    console.error("Error generating proof:", error);
    console.error("Error stack:", error.stack);
  }
}

test().catch(console.error);