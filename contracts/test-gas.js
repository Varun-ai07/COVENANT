const hre = require("hardhat");
async function main() {
  const clientAddr = "0x715f3b64189EcA51a57567962Cd2278dc7a5e92C";
  const workerAddr = "0x5501b9810e09d89d414f171ef8c7283b22587603";
  
  const escrow = await hre.ethers.getContractAt("TaskEscrow", "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0");
  
  const deadline = Math.floor(Date.now()/1000) + 86400;
  const payment = hre.ethers.parseEther("0.001");
  const descriptionHash = "0x15a81388d3c777732fb1195ca6befe3e1f51906a5bc2bd5fa369d02e058f8d32";
  
  console.log("Client registered?", (await escrow.agentRegistry()).toLowerCase() !== "0x0000000000000000000000000000000000000000");
  
  // Check if worker is registered
  const registry = await hre.ethers.getContractAt("AgentRegistry", "0x5FbDB2315678afecb367f032d93F642f64180aa3");
  const workerAgent = await registry.getAgent(workerAddr);
  console.log("Worker agent status:", workerAgent.isActive.toString(), "rep:", workerAgent.reputation.toString());
  
  console.log("\nAttempting gas estimation for createAndFundTask...");
  try {
    const gas = await escrow.estimateGas.createAndFundTask(workerAddr, payment, deadline, descriptionHash, { value: payment });
    console.log("✓ Gas estimate successful:", gas.toString());
  } catch (e) {
    console.error("✗ Estimate failed:", e.message);
    if (e.error) console.error("  Error details:", e.error);
  }
}
main().catch(console.error);
