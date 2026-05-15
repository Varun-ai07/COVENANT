const hre = require("hardhat");
const { ethers } = hre;

// Deployed TaskEscrow address on Base Sepolia
const TASK_ESCROW_ADDRESS = "0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Withdrawing fees with account:", signer.address);

  // Get TaskEscrow contract
  const escrow = await ethers.getContractAt("TaskEscrow", TASK_ESCROW_ADDRESS);

  // Check current fee recipient and accumulated fees
  const feeRecipient = await escrow.feeRecipient();
  const accumulatedFees = await escrow.accumulatedFees();

  console.log("\nFee recipient:", feeRecipient);
  console.log("Accumulated fees:", ethers.formatEther(accumulatedFees), "ETH");

  if (accumulatedFees === 0n) {
    console.log("\nNo fees to withdraw.");
    return;
  }

  // Withdraw fees
  console.log("\nWithdrawing fees...");
  const tx = await escrow.withdrawFees();
  console.log("Transaction submitted:", tx.hash);

  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt.blockNumber);

  console.log("\nFees withdrawn successfully to:", feeRecipient);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
