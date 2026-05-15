const hre = require("hardhat");
const { ethers } = hre;

// Fee recipient address - CHANGE THIS TO YOUR DESIRED ADDRESS
const FEE_RECIPIENT = "0xB62C652cCc69213E97c5c2ba266b9e7D0f21a811";

// Deployed TaskEscrow address on Base Sepolia
const TASK_ESCROW_ADDRESS = "0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting fee recipient with account:", deployer.address);

  // Get TaskEscrow contract
  const escrow = await ethers.getContractAt("TaskEscrow", TASK_ESCROW_ADDRESS);

  // Check current fee recipient
  const currentRecipient = await escrow.feeRecipient();
  console.log("\nCurrent fee recipient:", currentRecipient);
  console.log("New fee recipient:", FEE_RECIPIENT);

  // Set new fee recipient
  console.log("\nSetting new fee recipient...");
  const tx = await escrow.setFeeRecipient(FEE_RECIPIENT);
  console.log("Transaction submitted:", tx.hash);

  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt.blockNumber);

  // Verify the change
  const newRecipient = await escrow.feeRecipient();
  console.log("\nVerified new fee recipient:", newRecipient);

  // Check accumulated fees
  const accumulatedFees = await escrow.accumulatedFees();
  console.log("Current accumulated fees:", ethers.formatEther(accumulatedFees), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
