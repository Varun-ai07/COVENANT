import { generateCapabilityProof, computeCommitment } from './proveCapability.js';

async function main() {
  // Deterministic sample values for testing - tiny values to avoid field issues
  const capabilitySecret = BigInt(1n);
  const modelHash = BigInt(2n);
  const sessionNonce = BigInt(3n);
  const capabilityId = "cap1";
  const agentAddress = "0x0000000000000000000000000000000000000001";

  // Compute commitment (async)
  const registeredCommitment = await computeCommitment(capabilitySecret, modelHash, capabilityId, agentAddress);
  console.error(`Generated commitment: ${registeredCommitment.toString()}`);

  // Generate proof
  const proof = await generateCapabilityProof({
    capabilitySecret,
    modelHash,
    sessionNonce,
    capabilityId,
    agentAddress,
    registeredCommitment
  });

  // Build fixture object
  const fixture = {
    commitment: registeredCommitment.toString(),
    nullifier: proof.pubSignals[4].toString(),
    proof: {
      pA: proof.pA.map(x => x.toString()),
      pB: proof.pB.map(row => row.map(x => x.toString())),
      pC: proof.pC.map(x => x.toString())
    },
    pubSignals: proof.pubSignals.map(x => x.toString()),
    inputs: {
      capabilitySecret: capabilitySecret.toString(),
      modelHash: modelHash.toString(),
      sessionNonce: sessionNonce.toString(),
      capabilityId,
      agentAddress,
      registeredCommitment: registeredCommitment.toString()
    }
  };

  // Write to fixtures
  const fs = await import('fs');
  const path = await import('path');
  const outDir = path.join(process.cwd(), 'contracts', 'test', 'fixtures');
  const outPath = path.join(outDir, 'sampleZKProof.json');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(fixture, null, 2));
  console.error(`✅ Sample ZK proof fixture written to ${outPath}`);

  // Also print a summary
  console.log(JSON.stringify({
    commitment: fixture.commitment,
    nullifier: fixture.nullifier,
    proof: fixture.proof,
    pubSignals: fixture.pubSignals
  }, null, 2));
}

main().catch(err => {
  console.error('Error generating proof:', err);
  process.exit(1);
});
