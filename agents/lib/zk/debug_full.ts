import { generateCapabilityProof, computeCommitment } from './proveCapability.js';
import * as circomlib from 'circomlibjs';

async function debugFullProcess() {
  try {
    console.log("=== Full Debug Process ===");

    // Test values
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

    // Compute commitment
    const registeredCommitment = await computeCommitment(
      capabilitySecret,
      modelHash,
      capabilityId,
      agentAddress
    );
    console.log("registeredCommitment:", registeredCommitment.toString());

    // Try to generate proof with exact same values
    console.log("\nGenerating proof with exact values...");

    try {
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
      console.error("Error generating proof:", error.message);
      console.error("Error stack:", error.stack);
    }

  } catch (error) {
    console.error("Error in debug:", error);
  }
}

debugFullProcess().catch(console.error);