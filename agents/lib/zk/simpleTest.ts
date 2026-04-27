import { generateCapabilityProof, computeCommitment } from './proveCapability.js';

async function test() {
  try {
    console.log("=== Testing proof generation ===");

    // Simple test with minimal inputs
    const capabilitySecret = BigInt(12345);
    const modelHash = BigInt(67890);
    const sessionNonce = BigInt(11111);
    const capabilityId = "test";
    const agentAddress = "0x1234567890123456789012345678901234567890";

    console.log("Generating proof with simple inputs...");

    // Generate proof
    const proof = await generateCapabilityProof({
      capabilitySecret,
      modelHash,
      sessionNonce,
      capabilityId,
      agentAddress,
      registeredCommitment: capabilitySecret  // This will fail, but let's see what happens
    });

    console.log("Proof generated successfully!");
    console.log("Proof:", JSON.stringify(proof, null, 2));

  } catch (error) {
    console.error("Error generating proof:", error);
  }
}

test().catch(console.error);