const hre = require("hardhat");

async function main() {
  const PAYMASTER = "0xd1C5265eF0Cb20c2bBE697d296bAF924754A5fd1";
  const balance = await hre.ethers.provider.getBalance(PAYMASTER);
  console.log("Paymaster balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("Address:", PAYMASTER);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
