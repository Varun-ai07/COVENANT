const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying GrantProgram with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  // Deploy GrantProgram with deployer as governance
  console.log("\nDeploying GrantProgram...");
  const Factory = await hre.ethers.getContractFactory("contracts/v2/extensions/GrantProgram.sol:GrantProgram");
  const contract = await Factory.deploy(deployer.address);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("GrantProgram:", addr);

  // Verify on Basescan
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    try {
      await hre.run("verify:verify", {
        address: addr,
        contract: "contracts/v2/extensions/GrantProgram.sol:GrantProgram",
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
