import { generateCapabilityProof, computeCommitment } from './proveCapability.js';

async function debug() {
  try {
    console.log("=== Debug witness generation ===");

    // Deterministic sample values for testing
    const capabilitySecret = BigInt(12345);
    const modelHash = BigInt(67890);
    const sessionNonce = BigInt(11111);
    const capabilityId = "test-capability";
    const agentAddress = "0x1234567890123456789012345678901234567890";

    console.log("Computing commitment...");
    const registeredCommitment = await computeCommitment(
      capabilitySecret,
      modelHash,
      capabilityId,
      agentAddress
    );
    console.log(`Generated commitment: ${registeredCommitment.toString()}`);

    // Test what the witness generation would produce
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

    // Reduce all inputs modulo field prime
    const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

    function reduceModField(value: bigint): bigint {
      return ((value % FIELD_PRIME) + FIELD_PRIME) % FIELD_PRIME;
    }

    const capSecretRed = reduceModField(capabilitySecret);
    const modelHashRed = reduceModField(modelHash);
    const sessionNonceRed = reduceModField(sessionNonce);
    const capIdHashRed = reduceModField(capabilityIdHash);
    const agentAddrRed = reduceModField(agentAddrBig);

    console.log("\nWitness inputs that would be passed:");
    console.log("- capabilitySecret:", capSecretRed.toString());
    console.log("- modelHash:", modelHashRed.toString());
    console.log("- sessionNonce:", sessionNonceRed.toString());
    console.log("- capabilityId:", capIdHashRed.toString());
    console.log("- agentAddress:", agentAddrRed.toString());
    console.log("- registeredCommitment:", registeredCommitment.toString());

    // Compute commitment like in generateCapabilityProof
    console.log("\nComputing commitment in generateCapabilityProof:");
    const poseidon = await (await import('circomlibjs')).buildPoseidonOpt();

    const commitmentRaw = poseidon([capSecretRed, modelHashRed, capIdHashRed, agentAddrRed]);
    console.log("commitmentRaw:", commitmentRaw);

    let computedCommitment: bigint;
    if (commitmentRaw instanceof Uint8Array) {
      // Convert Uint8Array to bigint
      let result = 0n;
      for (let i = 0; i < commitmentRaw.length; i++) {
        result = (result << 8n) + BigInt(commitmentRaw[i]);
      }
      computedCommitment = result;
    } else {
      computedCommitment = commitmentRaw;
    }

    computedCommitment = reduceModField(computedCommitment);
    console.log("computedCommitment in generateCapabilityProof:", computedCommitment.toString());
    console.log("registeredCommitment:", registeredCommitment.toString());
    console.log("They match:", computedCommitment === registeredCommitment);

  } catch (error) {
    console.error("Error in debug:", error);
  }
}

debug().catch(console.error);