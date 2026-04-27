import { generateCapabilityProof, computeCommitment } from './proveCapability.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  try {
    console.log("=== Testing ZK Proof Generation ===");

    // Deterministic sample values for testing
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
    console.log(`Generated commitment: ${registeredCommitment.toString()}`);

    // Generate proof with the same commitment
    console.log("Generating proof...");
    const proof = await generateCapabilityProof({
      capabilitySecret,
      modelHash,
      sessionNonce,
      capabilityId,
      agentAddress,
      registeredCommitment: registeredCommitment // Use the computed commitment
    });

    console.log("Proof generated successfully!");
    console.log("Proof:", JSON.stringify(proof, null, 2));

  } catch (error) {
    console.error("Error generating proof:", error);
    console.error("Error stack:", error.stack);
  }
}

main().catch(console.error);