import { generateCapabilityProof, computeCommitment } from './proveCapability.js';
import * as circomlib from 'circomlibjs';

async function debug() {
  try {
    console.log("=== Debugging commitment computation ===");

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

    // Test what the circuit expects
    console.log("\nTesting circuit computation:");
    const poseidon = await circomlib.buildPoseidonOpt();

    // Hash capabilityId like in the TypeScript code
    const encoder = new TextEncoder();
    const capabilityIdHash = BigInt('0x' + Buffer.from(encoder.encode(capabilityId)).toString('hex'));
    console.log("capabilityIdHash:", capabilityIdHash.toString());

    // Convert agentAddress to bigint
    const agentAddrBig = BigInt('0x' + agentAddress.replace(/^0x/, ''));
    console.log("agentAddrBig:", agentAddrBig.toString());

    // Compute commitment like in the circuit
    const commitment = poseidon([capabilitySecret, modelHash, capabilityIdHash, agentAddrBig]);
    console.log("Direct poseidon result:", commitment);

    if (commitment instanceof Uint8Array) {
      // Convert Uint8Array to bigint
      let result = 0n;
      for (let i = 0; i < commitment.length; i++) {
        result = (result << 8n) + BigInt(commitment[i]);
      }
      console.log("Converted commitment:", result.toString());
    }

  } catch (error) {
    console.error("Error in debug:", error);
  }
}

debug().catch(console.error);