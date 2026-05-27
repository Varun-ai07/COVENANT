const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying TrainingMarketplace with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  // Deploy TrainingMarketplace
  console.log("\nDeploying TrainingMarketplace...");
  const Factory = await hre.ethers.getContractFactory("contracts/v2/extensions/TrainingMarketplace.sol:TrainingMarketplace");
  const contract = await Factory.deploy(deployer.address);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("TrainingMarketplace:", addr);

  // Verify on Basescan
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    try {
      await hre.run("verify:verify", {
        address: addr,
        contract: "contracts/v2/extensions/TrainingMarketplace.sol:TrainingMarketplace",
        constructorArguments: [deployer.address],
      });
      console.log("\nVerified on Basescan");
    } catch (e) {
      console.log("\nVerify:", e.message.substring(0, 100));
    }
  }

  console.log("\nDone! Contract address:", addr);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
