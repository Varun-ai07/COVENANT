import * as circomlib from 'circomlibjs';

async function testCommitmentReduction() {
  try {
    console.log("=== Testing commitment reduction ===");

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

    // Field prime from circomlib
    const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    console.log("FIELD_PRIME:", FIELD_PRIME.toString());

    // Check if commitment is larger than field prime
    console.log("commitment > FIELD_PRIME:", commitment > FIELD_PRIME);
    if (commitment > FIELD_PRIME) {
      const reducedCommitment = commitment % FIELD_PRIME;
      console.log("Reduced commitment:", reducedCommitment.toString());
    }

    // Test what the circuit would compute
    console.log("\nWhat the circuit computes:");
    console.log("Inputs to circuit:");
    console.log("  capabilitySecret:", capabilitySecret.toString());
    console.log("  modelHash:", modelHash.toString());
    console.log("  capabilityIdHash:", capabilityIdHash.toString());
    console.log("  agentAddrBig:", agentAddrBig.toString());

  } catch (error) {
    console.error("Error in test:", error);
  }
}

testCommitmentReduction().catch(console.error);