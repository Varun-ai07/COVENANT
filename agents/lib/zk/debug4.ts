import { generateCapabilityProof, computeCommitment } from './proveCapability.js';
import * as circomlib from 'circomlibjs';

async function debug() {
  try {
    console.log("=== Detailed Debug ===");

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

    // Hash capabilityId like in the new function
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
    console.log("capabilityIdHash:", capabilityIdHash.toString());

    // Convert agentAddress to bigint
    const agentAddrBig = BigInt('0x' + agentAddress.replace(/^0x/, ''));
    console.log("agentAddrBig:", agentAddrBig.toString());

    // Compute commitment like in computeCommitment
    console.log("\nComputing commitment in TypeScript:");
    const poseidon = await circomlib.buildPoseidonOpt();

    // Reduce all inputs modulo field prime
    const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

    function reduceModField(value: bigint): bigint {
      return ((value % FIELD_PRIME) + FIELD_PRIME) % FIELD_PRIME;
    }

    const capSecretRed = reduceModField(capabilitySecret);
    const modelHashRed = reduceModField(modelHash);
    const capIdHashRed = reduceModField(capabilityIdHash);
    const addrRed = reduceModField(agentAddrBig);

    console.log("Reduced values:");
    console.log("- capSecretRed:", capSecretRed.toString());
    console.log("- modelHashRed:", modelHashRed.toString());
    console.log("- capIdHashRed:", capIdHashRed.toString());
    console.log("- addrRed:", addrRed.toString());

    // Compute commitment
    const commitmentRaw = poseidon([capSecretRed, modelHashRed, capIdHashRed, addrRed]);
    console.log("commitmentRaw:", commitmentRaw);

    let computedCommitment: bigint;
    if (commitmentRaw instanceof Uint8Array) {
      // Convert Uint8Array to bigint
      let result = 0n;
      for (let i = 0; i < commitmentRaw.length; i++) {
        result = (result << 8n) + BigInt(commitmentRaw[i]);
      }
      computedCommitment = result;
    } else if (Array.isArray(commitmentRaw)) {
      // If it's an array, take the first element or convert appropriately
      computedCommitment = commitmentRaw.length > 0 ? BigInt(commitmentRaw[0].toString()) : 0n;
    } else {
      computedCommitment = typeof commitmentRaw === 'bigint' ? commitmentRaw : BigInt(commitmentRaw.toString());
    }

    computedCommitment = reduceModField(computedCommitment);
    console.log("computedCommitment:", computedCommitment.toString());

    // Now test what the circuit would compute
    console.log("\nTesting circuit computation:");
    const commitmentFromCircuit = poseidon([capabilitySecret, modelHash, capabilityIdHash, agentAddrBig]);
    console.log("commitmentFromCircuit (raw):", commitmentFromCircuit);

    let circuitCommitment: bigint;
    if (commitmentFromCircuit instanceof Uint8Array) {
      // Convert Uint8Array to bigint
      let result = 0n;
      for (let i = 0; i < commitmentFromCircuit.length; i++) {
        result = (result << 8n) + BigInt(commitmentFromCircuit[i]);
      }
      circuitCommitment = result;
    } else {
      circuitCommitment = commitmentFromCircuit;
    }

    console.log("circuitCommitment:", circuitCommitment.toString());

    console.log("\nComparison:");
    console.log("computedCommitment == circuitCommitment:", computedCommitment === circuitCommitment);

  } catch (error) {
    console.error("Error in debug:", error);
  }
}

debug().catch(console.error);