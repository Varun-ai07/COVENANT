import { generateCapabilityProof, computeCommitment } from './proveCapability.js';
import * as circomlib from 'circomlibjs';

async function debugFieldElements() {
  try {
    console.log("=== Debugging field elements ===");

    // Deterministic sample values for testing
    const capabilitySecret = BigInt(12345);
    const modelHash = BigInt(67890);
    const sessionNonce = BigInt(11111);
    const capabilityId = "test-capability";
    const agentAddress = "0x1234567890123456789012345678901234567890";

    console.log("capabilitySecret:", capabilitySecret.toString());
    console.log("modelHash:", modelHash.toString());
    console.log("sessionNonce:", sessionNonce.toString());
    console.log("capabilityId:", capabilityId);
    console.log("agentAddress:", agentAddress);

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

    // Test what the circuit would compute
    const poseidon = await circomlib.buildPoseidonOpt();
    const commitment = poseidon([capabilitySecret, modelHash, capabilityIdHash, agentAddrBig]);
    console.log("commitment:", commitment);

    let commitmentValue: bigint;
    if (commitment instanceof Uint8Array) {
      let result = 0n;
      for (let i = 0; i < commitment.length; i++) {
        result = (result << 8n) + BigInt(commitment[i]);
      }
      commitmentValue = result;
    } else {
      commitmentValue = commitment;
    }
    console.log("commitmentValue:", commitmentValue.toString());

  } catch (error) {
    console.error("Error in debug:", error);
  }
}

debugFieldElements().catch(console.error);