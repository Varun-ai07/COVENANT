import * as circomlib from 'circomlibjs';

async function test() {
  console.log("Testing poseidon computation...");

  // Deterministic sample values for testing
  const capabilitySecret = BigInt(12345);
  const modelHash = BigInt(67890);
  const sessionNonce = BigInt(11111);
  const capabilityId = "test-capability";
  const agentAddress = "0x1234567890123456789012345678901234567890";

  console.log("capabilitySecret:", capabilitySecret.toString());
  console.log("modelHash:", modelHash.toString());
  console.log("capabilityId:", capabilityId);
  console.log("agentAddress:", agentAddress);

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
  console.log("capabilityIdHash:", capabilityIdHash.toString());

  // Convert agentAddress to bigint (uint160)
  const agentAddrBig = BigInt('0x' + agentAddress.replace(/^0x/, ''));
  console.log("agentAddrBig:", agentAddrBig.toString());

  // Get poseidon
  const poseidon = await circomlib.buildPoseidonOpt();

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
}

test().catch(console.error);