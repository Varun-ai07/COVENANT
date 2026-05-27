const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Funding CovenantPaymaster with deployer:", deployer.address);
  
  const PAYMASTER = "0xd1C5265eF0Cb20c2bBE697d296bAF924754A5fd1";
  const FUND_AMOUNT = hre.ethers.parseEther("0.01"); // 0.01 ETH for gas sponsorship
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("Funding amount:", hre.ethers.formatEther(FUND_AMOUNT), "ETH");
  
  if (balance < FUND_AMOUNT) {
    console.error("Insufficient balance. Need at least", hre.ethers.formatEther(FUND_AMOUNT), "ETH");
    process.exit(1);
  }
  
  console.log("\nSending ETH to CovenantPaymaster...");
  const tx = await deployer.sendTransaction({
    to: PAYMASTER,
    value: FUND_AMOUNT,
  });
  await tx.wait();
  
  console.log("✅ Paymaster funded!");
  console.log("   Amount:", hre.ethers.formatEther(FUND_AMOUNT), "ETH");
  console.log("   Tx:", tx.hash);
  console.log("   Basescan:", `https://sepolia.basescan.org/tx/${tx.hash}`);
  
  // Check paymaster balance
  const paymasterBalance = await hre.ethers.provider.getBalance(PAYMASTER);
  console.log("\nPaymaster total balance:", hre.ethers.formatEther(paymasterBalance), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
