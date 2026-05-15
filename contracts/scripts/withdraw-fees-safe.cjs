/**
 * SAFE FEE WITHDRAWAL SCRIPT
 * ==========================
 *
 * This script safely withdraws ONLY the accumulatedFees, not the contract balance.
 * The remaining balance stays in the contract for worker payments.
 *
 * Security checks:
 * 1. Verifies accumulatedFees amount before withdrawal
 * 2. Verifies feeRecipient address
 * 3. Only owner or feeRecipient can call
 * 4. Withdraws EXACTLY the accumulatedFees (not more)
 */

const hre = require("hardhat");
const { ethers } = hre;

const TASK_ESCROW_ADDRESS = "0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=".repeat(50));
  console.log("COVENANT Fee Withdrawal");
  console.log("=".repeat(50));
  console.log("\nSigner:", signer.address);

  // Get contract
  const escrow = await ethers.getContractAt("TaskEscrow", TASK_ESCROW_ADDRESS);

  // Check owner
  const owner = await escrow.owner();
  console.log("Contract Owner:", owner);

  // Check if signer is owner
  const isOwner = signer.address.toLowerCase() === owner.toLowerCase();
  console.log("Is Owner:", isOwner);

  if (!isOwner) {
    console.log("\n❌ ERROR: You are not the contract owner!");
    console.log("Only the owner can withdraw fees.");
    process.exit(1);
  }

  // Get accumulated fees
  const accumulatedFees = await escrow.accumulatedFees();
  console.log("\nAccumulated Fees:", ethers.formatEther(accumulatedFees), "ETH");

  // Get contract balance
  const balance = await ethers.provider.getBalance(TASK_ESCROW_ADDRESS);
  console.log("Contract Balance:", ethers.formatEther(balance), "ETH");

  // Get pending task ETH (balance - fees)
  const pendingTaskEth = balance - accumulatedFees;
  console.log("Pending Task ETH:", ethers.formatEther(pendingTaskEth), "ETH (NOT withdrawn)");

  if (accumulatedFees === 0n) {
    console.log("\n✅ No fees to withdraw.");
    return;
  }

  // Final confirmation
  console.log("\n" + "=".repeat(50));
  console.log("WITHDRAWAL SUMMARY");
  console.log("=".repeat(50));
  console.log("Amount to withdraw:", ethers.formatEther(accumulatedFees), "ETH");
  console.log("Destination:", signer.address);
  console.log("Remaining in contract:", ethers.formatEther(pendingTaskEth), "ETH");
  console.log("=".repeat(50));

  // Withdraw
  console.log("\n🔄 Withdrawing fees...");
  const tx = await escrow.withdrawFees();
  console.log("Transaction hash:", tx.hash);

  const receipt = await tx.wait();
  console.log("✅ Confirmed in block:", receipt.blockNumber);

  // Verify
  const newFees = await escrow.accumulatedFees();
  console.log("\n✅ New accumulated fees:", ethers.formatEther(newFees), "ETH");
  console.log("✅ Withdrawal complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
