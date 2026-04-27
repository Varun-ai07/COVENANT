import * as circomlib from 'circomlibjs';
import { computeCommitment } from './proveCapability.js';

async function test() {
  console.log("Testing commitment computation...");

  // Deterministic sample values for testing
  const capabilitySecret = BigInt(12345);
  const modelHash = BigInt(67890);
  const capabilityId = "test-capability";
  const agentAddress = "0x1234567890123456789012345678901234567890";

  console.log("capabilitySecret:", capabilitySecret.toString());
  console.log("modelHash:", modelHash.toString());
  console.log("capabilityId:", capabilityId);
  console.log("agentAddress:", agentAddress);

  // What we compute in TS
  const commitment = await computeCommitment(
    capabilitySecret,
    modelHash,
    capabilityId,
    agentAddress
  );
  console.log("TS computed commitment:", commitment.toString());

  // What the circuit computes
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
  console.log("Circuit would compute:", commitmentRaw);

  let commitmentValue: bigint;
  if (commitmentRaw instanceof Uint8Array) {
    // Convert Uint8Array to bigint
    let result = 0n;
    for (let i = 0; i < commitmentRaw.length; i++) {
      result = (result << 8n) + BigInt(commitmentRaw[i]);
    }
    commitmentValue = result;
  } else {
    commitmentValue = commitmentRaw;
  }
  console.log("Circuit commitment:", commitmentValue.toString());
}

test().catch(console.error);