import { computeCommitment } from './proveCapability.js';
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

    console.log("Computing commitment with values:");
    console.log("- capabilitySecret:", capabilitySecret.toString());
    console.log("- modelHash:", modelHash.toString());
    console.log("- capabilityId:", capabilityId);
    console.log("- agentAddress:", agentAddress);

    // Compute commitment
    const commitment = await computeCommitment(
      capabilitySecret,
      modelHash,
      capabilityId,
      agentAddress
    );
    console.log("Computed commitment:", commitment.toString());

    // Test poseidon function directly
    const poseidon = await circomlib.buildPoseidonOpt();
    const poseidonResult = poseidon([BigInt(12345), BigInt(67890), BigInt("0x" + agentAddress.replace(/^0x/, ''))]);
    console.log("Direct poseidon result:", poseidonResult);

  } catch (error) {
    console.error("Error in debug:", error);
  }
}

debug().catch(console.error);