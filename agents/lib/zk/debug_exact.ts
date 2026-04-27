import * as circomlib from 'circomlibjs';
import { keccak256 } from 'viem';

// Test the exact computation to match circuit behavior
async function debugCircuitComputation() {
  console.log("=== Debug Circuit Computation ===");

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

  // Hash capabilityId exactly as in the circuit
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

  console.log("\nHashed values:");
  console.log("- capabilityIdHash:", capabilityIdHash.toString());
  console.log("- agentAddrBig:", agentAddrBig.toString());

  // Test with buildPoseidonOpt
  const poseidon = await circomlib.buildPoseidonOpt();

  // Compute commitment like circuit would
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

  console.log("\nComputed commitment:", commitment.toString());

  // Now test what we pass to the circuit
  console.log("\nWhat we pass to circuit:");
  console.log("- capabilitySecret:", capabilitySecret.toString());
  console.log("- modelHash:", modelHash.toString());
  console.log("- capabilityIdHash:", capabilityIdHash.toString());
  console.log("- agentAddrBig:", agentAddrBig.toString());
  console.log("- registeredCommitment:", commitment.toString());
}

debugCircuitComputation();