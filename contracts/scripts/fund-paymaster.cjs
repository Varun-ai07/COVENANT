const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const PAYMASTER = "0xd1C5265eF0Cb20c2bBE697d296bAF924754A5fd1";
  const FUND_AMOUNT = hre.ethers.parseEther("0.2");
  
  console.log("Funding CovenantPaymaster");
  console.log("From:", deployer.address);
  console.log("To:", PAYMASTER);
  console.log("Amount:", hre.ethers.formatEther(FUND_AMOUNT), "ETH");
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");
  
  if (balance < FUND_AMOUNT) {
    console.error("Insufficient balance!");
    process.exit(1);
  }
  
  const tx = await deployer.sendTransaction({
    to: PAYMASTER,
    value: FUND_AMOUNT,
  });
  await tx.wait();
  
  console.log("\n✅ Paymaster funded!");
  console.log("Tx:", tx.hash);
  console.log("Basescan:", `https://sepolia.basescan.org/tx/${tx.hash}`);
  
  const paymasterBalance = await hre.ethers.provider.getBalance(PAYMASTER);
  console.log("Paymaster balance:", hre.ethers.formatEther(paymasterBalance), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
