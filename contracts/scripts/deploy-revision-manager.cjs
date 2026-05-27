const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying RevisionManager with:", deployer.address);
  
  const Factory = await hre.ethers.getContractFactory("contracts/v2/extensions/RevisionManager.sol:RevisionManager");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("RevisionManager:", addr);
  
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    try {
      await hre.run("verify:verify", {
        address: addr,
        contract: "contracts/v2/extensions/RevisionManager.sol:RevisionManager",
        constructorArguments: [],
      });
      console.log("Verified on Basescan");
    } catch (e) {
      console.log("Verify:", e.message.substring(0, 80));
    }
  }
  
  console.log("Done! Contract address:", addr);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
