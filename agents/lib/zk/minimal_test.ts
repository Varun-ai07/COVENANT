// Minimal test to debug ZK proof generation
import * as circomlib from 'circomlibjs';
import * as snarkjs from 'snarkjs';
import path from 'path';
import fs from 'fs';

const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function reduceModField(value) {
  return ((BigInt(value) % FIELD_PRIME) + FIELD_PRIME) % FIELD_PRIME;
}

async function main() {
  console.log("=== Minimal ZK Proof Test ===\n");

  // Get Poseidon
  const poseidon = await circomlib.buildPoseidon();

  // Sample inputs - use SMALL values that definitely fit in field
  const capabilitySecret = 12345678901234567890n;
  const modelHash = 9876543210987654321n;
  const sessionNonce = 5555555555555555555n;
  const capabilityId = "test-capability";
  const agentAddressHex = "0x1234567890123456789012345678901234567890";
  const agentAddr = BigInt('0x' + agentAddressHex.replace(/^0x/, ''));

  // Hash capabilityId using viem's keccak256
  // Since we can't import viem easily here, compute hash inline using simpler approach
  // For testing, just use a small deterministic value
  const capabilityIdHash = BigInt('0x') + BigInt(keccak256(capabilityId));

  console.log("Raw values:");
  console.log("  capabilitySecret:", capabilitySecret.toString());
  console.log("  modelHash:", modelHash.toString());
  console.log("  sessionNonce:", sessionNonce.toString());
  console.log("  capabilityIdHash:", capabilityIdHash.toString());
  console.log("  agentAddr:", agentAddr.toString());

  // Reduced values
  const capSecretRed = reduceModField(capabilitySecret);
  const modelHashRed = reduceModField(modelHash);
  const sessionNonceRed = reduceModField(sessionNonce);
  const capIdHashRed = reduceModField(capabilityIdHash);
  const agentAddrRed = reduceModField(agentAddr);

  console.log("\nReduced values:");
  console.log("  capabilitySecret:", capSecretRed.toString());
  console.log("  modelHash:", modelHashRed.toString());
  console.log("  sessionNonce:", sessionNonceRed.toString());
  console.log("  capabilityIdHash:", capIdHashRed.toString());
  console.log("  agentAddr:", agentAddrRed.toString());

  // Compute commitment
  const hashBytes = poseidon([capSecretRed, modelHashRed, capIdHashRed, agentAddrRed]);
  let commitment = 0n;
  for (let i = 0; i < hashBytes.length; i++) {
    commitment |= BigInt(hashBytes[i]) << BigInt(8 * i);
  }
  console.log("\nComputed commitment (LE):", commitment.toString());
  const commitmentRed = reduceModField(commitment);
  console.log("Commitment reduced:", commitmentRed.toString());

  // Build witness input for snarkjs (all as strings)
  const witnessInput = {
    capabilitySecret: capSecretRed.toString(),
    modelHash: modelHashRed.toString(),
    sessionNonce: sessionNonceRed.toString(),
    capabilityId: capIdHashRed.toString(),
    agentAddress: agentAddrRed.toString(),
    registeredCommitment: commitmentRed.toString()
  };

  console.log("\nWitness input:");
  console.log(JSON.stringify(witnessInput, null, 2));

  // Try just calculating witness
  const basePath = path.resolve('.');
  const wasm = path.join(basePath, 'zk_circuits/ZK-CIRCUITS/capabilityProof/capabilityProof_js/capabilityProof.wasm');
  const zkey = path.join(basePath, 'zk_circuits/ZK-CIRCUITS/capabilityProof/capabilityProof_final.zkey');

  console.log("\nWASM:", wasm);
  console.log("Exists:", fs.existsSync(wasm));
  console.log("ZKEY:", zkey);
  console.log("Exists:", fs.existsSync(zkey));

  if (!fs.existsSync(wasm) || !fs.existsSync(zkey)) {
    console.error("Missing required files!");
    return;
  }

  console.log("\nAttempting witness calculation...");
  try {
    const { witness } = await snarkjs.wtns.calculate(wasm, witnessInput);
    console.log("✅ Witness calculated successfully, length:", witness.length);

    // Try full proof
    console.log("\nGenerating full proof...");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(witnessInput, wasm, zkey);
    console.log("✅ Proof generated!");
    console.log("Public signals:", publicSignals);
  } catch (err) {
    console.error("❌ Error:", err.message);
    if (err.causedBy) console.error("Caused by:", err.causedBy);
  }
}

// Simple keccak256 for Node.js (without viem dependency)
function keccak256(str) {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(str);
  // Return a hex string without 0x prefix for simplicity
  // Note: this is NOT actually keccak256 but for debug we'll just use a placeholder
  // In real code, we'd use proper keccak256
  return '0x' + hash.digest('hex');
}

main().catch(console.error);
