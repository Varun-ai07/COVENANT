import { generateCapabilityProof, computeCommitment } from './proveCapability.js';
import * as circomlib from 'circomlibjs';

async function debugCircuit() {
  try {
    console.log("=== Debug Circuit Computation ===");

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

    // What the circuit would compute
    console.log("\nWhat the circuit expects:");
    console.log("- capabilitySecret:", capabilitySecret.toString());
    console.log("- modelHash:", modelHash.toString());
    console.log("- capabilityId:", capabilityId);
    console.log("- agentAddress:", agentAddress);
    console.log("- registeredCommitment:", registeredCommitment.toString());

    // Try to compute what the circuit computes
    console.log("\nComputing commitment like circuit would:");

    // Get poseidon
    const poseidon = await circomlib.buildPoseidonOpt();

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
    const agentAddrBig = BigInt('0x' + agentAddress.replace(/^0x/, ''));

    console.log("capabilityIdHash:", capabilityIdHash.toString());
    console.log("agentAddrBig:", agentAddrBig.toString());

    // Compute commitment like circuit would
    const commitmentRaw = poseidon([capabilitySecret, modelHash, capabilityIdHash, agentAddrBig]);
    console.log("commitmentRaw:", commitmentRaw);

    let commitment: bigint;
    if (commitmentRaw instanceof Uint8Array) {
      // Convert Uint8Array to bigint
      let result = 0n;
      for (let i = 0; i < commitmentRaw.length; i++) {
        result = (result << 8n) + BigInt(commitmentRaw[i]);
      }
      commitment = result;
    } else {
      commitment = commitmentRaw;
    }
    console.log("commitment:", commitment.toString());

    // Now test with the same commitment
    console.log("\nTesting with matching commitment:");
    const proofInputs = {
      capabilitySecret,
      modelHash,
      sessionNonce,
      capabilityId,
      agentAddress,
      registeredCommitment: commitment
    };

    console.log("Generating proof with matching commitment...");
    const proof = await generateCapabilityProof(proofInputs);
    console.log("Proof generated successfully!");
    console.log("Proof:", JSON.stringify(proof, null, 2));

  } catch (error) {
    console.error("Error in debug:", error);
  }
}

debugCircuit().catch(console.error);