// Test the exact same computation in both places
import * as circomlib from 'circomlibjs';

async function debug() {
  console.log("Debugging exact computation match...");

  // Test values
  const capabilitySecret = BigInt(12345);
  const modelHash = BigInt(67890);
  const capabilityId = "test-capability";
  const agentAddress = "0x1234567890123456789012345678901234567890";

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

  console.log("capabilitySecret:", capabilitySecret.toString());
  console.log("modelHash:", modelHash.toString());
  console.log("capabilityId:", capabilityId);
  console.log("capabilityIdHash:", capabilityIdHash.toString());
  console.log("agentAddress:", agentAddress);
  console.log("agentAddrBig:", agentAddrBig.toString());

  // Test with buildPoseidonOpt directly
  const poseidon = await circomlib.buildPoseidonOpt();
  const commitmentRaw = poseidon([capabilitySecret, modelHash, capabilityIdHash, agentAddrBig]);
  console.log("commitmentRaw:", commitmentRaw);

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
  console.log("commitment:", commitment.toString());

  // Test with the same function
  function reduceModField(value: bigint): bigint {
    const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    return ((value % FIELD_PRIME) + FIELD_PRIME) % FIELD_PRIME;
  }

  const reducedCommitment = reduceModField(commitment);
  console.log("reducedCommitment:", reducedCommitment.toString());
}

debug().catch(console.error);