import { generateCapabilityProof, computeCommitment } from './proveCapability.js';
import * as circomlib from 'circomlibjs';

async function debugWitnessGeneration() {
  try {
    console.log("=== Debugging witness generation ===");

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

    console.log("\nComputed values:");
    console.log("- capabilityIdHash:", capabilityIdHash.toString());
    console.log("- agentAddrBig:", agentAddrBig.toString());

    // Test what the circuit would compute for commitment
    const poseidon = await circomlib.buildPoseidonOpt();
    const commitmentRaw = poseidon([capabilitySecret, modelHash, capabilityIdHash, agentAddrBig]);

    let commitment: bigint;
    if (commitmentRaw instanceof Uint8Array) {
      let result = 0n;
      for (let i = 0; i < commitmentRaw.length; i++) {
        result = (result << 8n) + BigInt(commitmentRaw[i]);
      }
      commitment = result;
    } else {
      commitment = commitmentRaw;
    }
    console.log("- circuit commitment:", commitment.toString());

    console.log("\nComparison:");
    console.log("- registeredCommitment === circuit commitment:", registeredCommitment === commitment);

  } catch (error) {
    console.error("Error in debug:", error);
  }
}

debugWitnessGeneration().catch(console.error);