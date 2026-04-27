import { keccak256 } from 'viem';

async function testKeccak() {
  try {
    const testString = "test-capability";
    const encoder = new TextEncoder();
    const hash = keccak256(encoder.encode(testString));
    console.log("keccak256 result:", hash);
    console.log("typeof hash:", typeof hash);

    // Try to convert to bigint
    const hashBigInt = BigInt(hash);
    console.log("hash as bigint:", hashBigInt);
  } catch (error) {
    console.error("Error with keccak256:", error);
  }
}

testKeccak().catch(console.error);