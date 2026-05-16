const hre = require("hardhat");
const { ethers } = hre;

const TASK_ESCROW_ADDRESS = "0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3";

async function main() {
  const escrow = await ethers.getContractAt("TaskEscrow", TASK_ESCROW_ADDRESS);
  console.log("Fee Recipient:", await escrow.feeRecipient());
  console.log("Owner:", await escrow.owner());
  console.log("Accumulated Fees:", ethers.formatEther(await escrow.accumulatedFees()), "ETH");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
