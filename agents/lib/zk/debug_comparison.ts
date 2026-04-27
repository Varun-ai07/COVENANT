import * as circomlib from 'circomlibjs';

async function debugCircuitVsJS() {
  console.log("=== Debug Circuit vs JS Computation ===");

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

  // Hash capabilityId exactly as in the circuit
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

  // How JavaScript computes commitment
  console.log("\nJavaScript computation:");
  const jsCommitmentRaw = poseidon([capabilitySecret, modelHash, capabilityIdHash, agentAddrBig]);
  let jsCommitment: bigint;
  if (jsCommitmentRaw instanceof Uint8Array) {
    let result = 0n;
    for (let i = 0; i < jsCommitmentRaw.length; i++) {
      result = (result << 8n) + BigInt(jsCommitmentRaw[i]);
    }
    jsCommitment = result;
  } else {
    jsCommitment = jsCommitmentRaw;
  }
  console.log("- JS commitment:", jsCommitment.toString());

  // How circuit computes commitment (using capabilityId directly)
  console.log("\nCircuit computation (if using capabilityId directly):");
  const circuitCommitmentRaw = poseidon([capabilitySecret, modelHash, capabilityIdHash, agentAddrBig]);
  let circuitCommitment: bigint;
  if (circuitCommitmentRaw instanceof Uint8Array) {
    let result = 0n;
    for (let i = 0; i < circuitCommitmentRaw.length; i++) {
      result = (result << 8n) + BigInt(circuitCommitmentRaw[i]);
    }
    circuitCommitment = result;
  } else {
    circuitCommitment = circuitCommitmentRaw;
  }
  console.log("- Circuit commitment:", circuitCommitment.toString());

  console.log("\nComparison:");
  console.log("- JS === Circuit:", jsCommitment === circuitCommitment);
}

debugCircuitVsJS();