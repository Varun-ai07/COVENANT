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
  let capabilityIdHash = hashCapabilityId(capabilityId);
  const addr = BigInt('0x' + agentAddress.replace(/^0x/, ''));

  // Reduce all inputs modulo field prime to match Circom's automatic reduction
  const capSecretRed = reduceModField(capabilitySecret);
  const modelHashRed = reduceModField(modelHash);
  const capIdHashRed = reduceModField(capabilityIdHash);
  const addrRed = reduceModField(addr);

  // Compute Poseidon hash (returns bigint directly with buildPoseidonOpt)
  const commitment = poseidon([capSecretRed, modelHashRed, capIdHashRed, addrRed]);

  // The result should already be a field element (bigint), but ensure it's reduced
  return typeof commitment === 'bigint' ? reduceModField(commitment) : BigInt(commitment);
}

function hashCapabilityId(capabilityId: string): bigint {
  // viem's keccak256 returns hex string with 0x prefix
  const hash = keccak256(new TextEncoder().encode(capabilityId));
  return BigInt(hash);
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

  // Reduce all inputs modulo field prime to match Circom's automatic reduction
  const capSecretRed = reduceModField(inputs.capabilitySecret);
  const modelHashRed = reduceModField(inputs.modelHash);
  const sessionNonceRed = reduceModField(inputs.sessionNonce);
  const capIdHashRed = reduceModField(capabilityIdHash);
  const agentAddrRed = reduceModField(agentAddrBig);

  // Compute commitment (output) using Poseidon (returns bigint)
  const commitment = poseidon([capSecretRed, modelHashRed, capIdHashRed, agentAddrRed]);

  // Verify that the provided registeredCommitment matches the computed commitment
  if (commitment !== inputs.registeredCommitment) {
    throw new Error('Registered commitment does not match computed commitment');
  }

  // Compute nullifier (output) using Poseidon with 3 inputs
  const nullifier = poseidon([capSecretRed, sessionNonceRed, capIdHashRed]);

  // Build witness input with ALL signals (private + public inputs + public outputs)
  const witnessInput = {
    capabilitySecret: capSecretRed.toString(),
    modelHash: modelHashRed.toString(),
    sessionNonce: sessionNonceRed.toString(),
    capabilityId: capIdHashRed.toString(),
    agentAddress: agentAddrRed.toString(),
    registeredCommitment: inputs.registeredCommitment.toString(),
    // Public outputs
    commitment: commitment.toString(),
    nullifier: nullifier.toString()
  };

  // Resolve paths
  const basePath = path.resolve(__dirname, '../../..');
  const wasm = wasmPath || path.join(basePath, 'zk_circuits/ZK-CIRCUITS/capabilityProof/capabilityProof_js/capabilityProof.wasm');
  const zkey = zkeyPath || path.join(basePath, 'zk_circuits/ZK-CIRCUITS/capabilityProof/capabilityProof_final.zkey');

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
