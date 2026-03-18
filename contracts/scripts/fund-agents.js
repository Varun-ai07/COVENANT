import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Funding from:", deployer.address);

  const clientAddress = "0x715f3b64189EcA51a57567962Cd2278dc7a5e92C";
  const workerAddress = "0x5501b9810e09d89d414F171ef8C7283B22587603";

  // Send 0.05 ETH to each
  console.log("\nSending 0.05 ETH to client agent...");
  const tx1 = await deployer.sendTransaction({
    to: clientAddress,
    value: ethers.parseEther("0.05"),
  });
  await tx1.wait();
  console.log("Client funded! Tx:", tx1.hash);

  console.log("\nSending 0.05 ETH to worker agent...");
  const tx2 = await deployer.sendTransaction({
    to: workerAddress,
    value: ethers.parseEther("0.05"),
  });
  await tx2.wait();
  console.log("Worker funded! Tx:", tx2.hash);

  console.log("\nBoth agents funded successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
