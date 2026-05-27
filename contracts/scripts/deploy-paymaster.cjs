const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying CovenantPaymaster with:", deployer.address);

  const Paymaster = await hre.ethers.getContractFactory("contracts/v2/core/CovenantPaymaster.sol:CovenantPaymaster");
  const pm = await Paymaster.deploy();
  await pm.waitForDeployment();
  const addr = await pm.getAddress();
  console.log("CovenantPaymaster:", addr);

  // Fund with 0.01 ETH
  const tx = await deployer.sendTransaction({ to: addr, value: hre.ethers.parseEther("0.01") });
  await tx.wait();
  console.log("Funded with 0.01 ETH");

  // Verify
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    try {
      await hre.run("verify:verify", {
        address: addr,
        contract: "contracts/v2/core/CovenantPaymaster.sol:CovenantPaymaster",
      });
      console.log("Verified on Basescan");
    } catch(e) {
      console.log("Verify:", e.message.substring(0, 100));
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
