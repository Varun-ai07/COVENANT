import * as circomlib from 'circomlibjs';
import * as snarkjs from 'snarkjs';
import { keccak256 } from 'viem';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// BN254 scalar field prime (from circomlib)
const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Convert Uint8Array to bigint
 */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (let i = 0; i < bytes.length; i++) {
    result = (result << 8n) + BigInt(bytes[i]);
  }
  return result;
}

/**
 * Reduce a bigint modulo the field prime (mimic Circom's automatic modulo)
 */
function reduceModField(value: bigint): bigint {
  return ((value % FIELD_PRIME) + FIELD_PRIME) % FIELD_PRIME;
}

// Use the optimized JS Poseidon that returns bigint directly (matches circom circuit)
let poseidonFn: ((inputs: bigint[]) => bigint) | null = null;
async function getPoseidon(): Promise<(inputs: bigint[]) => bigint> {
  if (!poseidonFn) {
    poseidonFn = await circomlib.buildPoseidonOpt();
  }
  return poseidonFn;
}

export interface ZKProofOutput {
  pA: [bigint, bigint];
  pB: [[bigint, bigint], [bigint, bigint]];
  pC: [bigint, bigint];
  pubSignals: bigint[];
}

/**
 * Compute the Poseidon commitment as done in the circuit.
 * commitment = poseidon.F([capabilitySecret, modelHash, capabilityIdHash, agentAddress])
 */
export async function computeCommitment(
  capabilitySecret: bigint,
  modelHash: bigint,
  capabilityId: string,
  agentAddress: string
): Promise<bigint> {
  const poseidon = await getPoseidon();
  const addr = BigInt('0x' + agentAddress.replace(/^0x/, ''));

  // Convert capabilityId to bigint (don't hash it to match circuit expectations)
  const encoder = new TextEncoder();
  const bytes = encoder.encode(capabilityId);
  let capabilityIdValue = 0n;
  for (let i = 0; i < bytes.length; i++) {
    capabilityIdValue = (capabilityIdValue << 8n) + BigInt(bytes[i]);
  }

  // Compute Poseidon hash (same as circuit - no input reduction)
  const commitment = poseidon([capabilitySecret, modelHash, capabilityIdValue, addr]);

  // The result should already be a field element (bigint), but ensure it's reduced
  // Handle case where poseidon returns Uint8Array
  let commitmentValue: bigint;
  if (commitment instanceof Uint8Array) {
    // Convert Uint8Array to bigint
    commitmentValue = bytesToBigInt(commitment);
  } else if (Array.isArray(commitment)) {
    // If it's an array, take the first element or convert appropriately
    commitmentValue = commitment.length > 0 ? BigInt(commitment[0].toString()) : 0n;
  } else {
    commitmentValue = typeof commitment === 'bigint' ? commitment : BigInt(commitment.toString());
  }

  // Don't apply field reduction to match circuit behavior
  // The circuit automatically reduces field elements, so we should pass the raw value
  // and let the circuit do the reduction
  return commitmentValue;
}

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

/**
 * Generate a ZK proof for the given capability.
 * @param inputs
 * @param wasmPath Optional custom path to WASM file
 * @param zkeyPath Optional custom path to zkey file
 * @returns Formatted proof data suitable for calldata encoding
 */
export async function generateCapabilityProof(
  inputs: {
    capabilitySecret: bigint;
    modelHash: bigint;
    sessionNonce: bigint;
    capabilityId: string;
    agentAddress: string;
    registeredCommitment: bigint;
  },
  wasmPath?: string,
  zkeyPath?: string
): Promise<ZKProofOutput> {
  // Get poseidon for computing outputs
  const poseidon = await getPoseidon();

  // Convert agentAddress to bigint (uint160)
  const agentAddrBig = BigInt('0x' + inputs.agentAddress.replace(/^0x/, ''));
  // Hash capabilityId for signals
  const capabilityIdHash = hashCapabilityId(inputs.capabilityId);

  // Compute commitment using the same inputs as the circuit
  const commitment = await computeCommitment(
    inputs.capabilitySecret,
    inputs.modelHash,
    inputs.capabilityId,
    inputs.agentAddress
  );

  // Compute nullifier (output) using Poseidon with 3 inputs (same as circuit - no input reduction)
  const nullifierRaw = poseidon([inputs.capabilitySecret, inputs.sessionNonce, capabilityIdHash]);
  let nullifier: bigint;
  if (nullifierRaw instanceof Uint8Array) {
    nullifier = bytesToBigInt(nullifierRaw);
  } else {
    nullifier = nullifierRaw;
  }

  // Build witness input with ALL signals (private + public inputs + public outputs)
  // Convert capabilityId to field element for witness input to match circuit expectations
  const encoder = new TextEncoder();
  const capabilityIdBytes = encoder.encode(inputs.capabilityId);
  let capabilityIdField = 0n;
  for (let i = 0; i < capabilityIdBytes.length; i++) {
    capabilityIdField = (capabilityIdField << 8n) + BigInt(capabilityIdBytes[i]);
  }
  // Reduce modulo field prime to ensure it's a valid field element
  capabilityIdField = reduceModField(capabilityIdField);

  const witnessInput = {
    capabilitySecret: inputs.capabilitySecret.toString(),
    modelHash: inputs.modelHash.toString(),
    sessionNonce: inputs.sessionNonce.toString(),
    capabilityId: capabilityIdField.toString(),  // Pass capabilityId as field element
    agentAddress: agentAddrBig.toString(),
    registeredCommitment: inputs.registeredCommitment.toString(),
    // Don't pass commitment - let circuit compute it
    nullifier: nullifier.toString()
  };

  // Resolve paths
  const wasm = wasmPath || '/home/vxrun/Projects/newbie/zk_circuits/ZK-CIRCUITS/capabilityProof/capabilityProof_js/capabilityProof.wasm';
  const zkey = zkeyPath || '/home/vxrun/Projects/newbie/zk_circuits/ZK-CIRCUITS/capabilityProof/capabilityProof_final.zkey';

  // Verify files exist
  if (!fs.existsSync(wasm)) throw new Error(`WASM file not found: ${wasm}`);
  if (!fs.existsSync(zkey)) throw new Error(`ZKEY file not found: ${zkey}`);

  // Generate proof using snarkjs
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    witnessInput,
    wasm,
    zkey
  ) as { proof: any; publicSignals: string[] };

  // Format proof for Solidity
  const pA: [bigint, bigint] = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
  const pB: [[bigint, bigint], [bigint, bigint]] = [
    [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])],
    [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])]
  ];
  const pC: [bigint, bigint] = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];

  const pubSignalsBigInt = publicSignals.map(s => BigInt(s));

  return { pA, pB, pC, pubSignals: pubSignalsBigInt };
}

/**
 * Encode the proof into a bytes calldata that can be passed to Solidity.
 * The encoding matches Solidity's abi.encode(uint256[2], uint256[2][2], uint256[2], uint256[5])
 */
export function encodeZKProofForCall(proof: ZKProofOutput): string {
  // Encode as a single bytes payload
  const words: string[] = [];
  // pA: 2 uint256
  words.push(padTo32Bytes(proof.pA[0]));
  words.push(padTo32Bytes(proof.pA[1]));
  // pB: 2x2 = 4 uint256 (first row, second row)
  words.push(padTo32Bytes(proof.pB[0][0]));
  words.push(padTo32Bytes(proof.pB[0][1]));
  words.push(padTo32Bytes(proof.pB[1][0]));
  words.push(padTo32Bytes(proof.pB[1][1]));
  // pC: 2 uint256
  words.push(padTo32Bytes(proof.pC[0]));
  words.push(padTo32Bytes(proof.pC[1]));
  // pubSignals: 5 uint256
  for (let i = 0; i < 5; i++) {
    words.push(padTo32Bytes(proof.pubSignals[i]));
  }
  return '0x' + words.join('');
}

function padTo32Bytes(value: bigint): string {
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const needed = 64; // 32 bytes * 2 hex chars
  if (hex.length < needed) {
    hex = '0'.repeat(needed - hex.length) + hex;
  }
  return hex;
}
