import { generateCapabilityProof, computeCommitment } from './lib/zk/proveCapability.js';

async function test() {
  try {
    console.log("Testing ZK proof generation...");

    // Test values
    const capabilitySecret = BigInt(12345);
    const modelHash = BigInt(67890);
    const sessionNonce = BigInt(11111);
    const capabilityId = "test-capability";
    const agentAddress = "0x1234567890123456789012345678901234567890";

    console.log("Computing commitment...");
    const registeredCommitment = await computeCommitment(
      capabilitySecret,
      modelHash,
      capabilityId,
      agentAddress
    );
    console.log("Commitment computed:", registeredCommitment.toString());

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
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
  }
}

test().catch(console.error);