import { generateCapabilityProof, computeCommitment } from './proveCapability.js';
import * as circomlib from 'circomlibjs';

async function test() {
  try {
    console.log("=== Testing proof generation ===");

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

    // Compute commitment
    console.log("\nComputing commitment...");
    const registeredCommitment = await computeCommitment(
      capabilitySecret,
      modelHash,
      capabilityId,
      agentAddress
    );
    console.log(`Generated commitment: ${registeredCommitment.toString()}`);

    // Check what the circuit would compute internally
    console.log("\nWhat the circuit computes internally:");
    const poseidon = await circomlib.buildPoseidonOpt();

    // Hash capabilityId
    function hashCapabilityId(capabilityId: string): bigint {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(capabilityId);
      let result = 0n;
      for (let i = 0; i < bytes.length; i++) {
        result = (result << 8n) + BigInt(bytes[i]);
      }
      return result;
    }

    const capabilityIdHash = hashCapabilityId(capabilityId);
    const agentAddrBig = BigInt('0x' + agentAddress.replace(/^0x/, ''));

    console.log("capabilityIdHash:", capabilityIdHash.toString());
    console.log("agentAddrBig:", agentAddrBig.toString());

    // Compute commitment like circuit would
    const commitmentRaw = poseidon([capabilitySecret, modelHash, capabilityIdHash, agentAddrBig]);
    let circuitCommitment: bigint;
    if (commitmentRaw instanceof Uint8Array) {
      let result = 0n;
      for (let i = 0; i < commitmentRaw.length; i++) {
        result = (result << 8n) + BigInt(commitmentRaw[i]);
      }
      circuitCommitment = result;
    } else {
      circuitCommitment = commitmentRaw;
    }
    console.log("Circuit commitment:", circuitCommitment.toString());
    console.log("Our commitment:   ", registeredCommitment.toString());
    console.log("Match:", circuitCommitment.toString() === registeredCommitment.toString());

    // Generate proof with the same commitment
    console.log("\nGenerating proof...");
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

test().catch(console.error);