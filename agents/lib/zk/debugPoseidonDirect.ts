import * as circomlib from 'circomlibjs';

async function debugPoseidon() {
  console.log("Debugging poseidon computation...");

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
  console.log("capabilityIdHash:", capabilityIdHash.toString());
  console.log("agentAddrBig:", agentAddrBig.toString());

  // Test with buildPoseidonOpt
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
}

debugPoseidon().catch(console.error);