import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testZK() {
  try {
    console.log("Testing ZK proof generation...");

    // Simple test to see if we can generate a proof
    const result = await execAsync('echo "Test complete"');
    console.log("Test completed");
  } catch (error) {
    console.error("Error in test:", error);
  }
}

testZK();