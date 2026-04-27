import * as circomlib from 'circomlibjs';

// BN254 scalar field prime (from circomlib)
const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Reduce a bigint modulo the field prime (mimic Circom's automatic modulo)
 */
function reduceModField(value: bigint): bigint {
  return ((value % FIELD_PRIME) + FIELD_PRIME) % FIELD_PRIME;
}

async function debugFieldReduction() {
  console.log("=== Debug Field Reduction ===");

  // Test values
  const capabilitySecret = BigInt(12345);
  const modelHash = BigInt(67890);
  const capabilityId = "test-capability";
  const agentAddress = "0x1234567890123456789012345678901234567890";

  console.log("Inputs:");
  console.log("- capabilitySecret:", capabilitySecret.toString());
  console.log("- modelHash:", modelHash.toString());
  console.log("- capabilityId:", capabilityId);
  console.log("- agentAddress:", agentAddress);

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

  console.log("\nHashed values:");
  console.log("- capabilityIdHash:", capabilityIdHash.toString());
  console.log("- agentAddrBig:", agentAddrBig.toString());

  // Test with buildPoseidonOpt
  const poseidon = await circomlib.buildPoseidonOpt();

  // Compute commitment
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
  console.log("FIELD_PRIME:", FIELD_PRIME.toString());
  console.log("commitment > FIELD_PRIME:", commitment > FIELD_PRIME);

  if (commitment > FIELD_PRIME) {
    const reducedCommitment = commitment % FIELD_PRIME;
    console.log("Reduced commitment:", reducedCommitment.toString());
    console.log("Reduced commitment === original commitment:", reducedCommitment === commitment);
  } else {
    console.log("Commitment is already within field range");
  }

  // Test what happens if we reduce it anyway
  const reducedCommitment = reduceModField(commitment);
  console.log("Force reduced commitment:", reducedCommitment.toString());
  console.log("Force reduced === original:", reducedCommitment === commitment);
}

debugFieldReduction();