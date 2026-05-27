const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying MultiTokenEscrow with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  // AgentRegistry v2 address (Base Sepolia)
  const AGENT_REGISTRY = "0xB215589dA259A98eEE8BF39739F6255131ac33A1";
  // Fee recipient = deployer for now
  const FEE_RECIPIENT = deployer.address;

  console.log("\nDeploying MultiTokenEscrow...");
  const Factory = await hre.ethers.getContractFactory("contracts/MultiTokenEscrow.sol:MultiTokenEscrow");
  const contract = await Factory.deploy(AGENT_REGISTRY, FEE_RECIPIENT);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("MultiTokenEscrow:", addr);

  // Add accepted tokens (Base Sepolia addresses)
  // USDC on Base Sepolia
  const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  // USDT on Base Sepolia
  const USDT = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2";
  // DAI on Base Sepolia
  const DAI = "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb";

  console.log("\nAdding accepted tokens...");
  for (const [name, tokenAddr] of [["USDC", USDC], ["USDT", USDT], ["DAI", DAI]]) {
    try {
      const tx = await contract.setAcceptedToken(tokenAddr, true);
      await tx.wait();
      console.log(`  ${name} added`);
    } catch (e) {
      console.log(`  ${name} failed: ${e.message.substring(0, 80)}`);
    }
  }

  // Verify on Basescan
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    try {
      await hre.run("verify:verify", {
        address: addr,
        contract: "contracts/MultiTokenEscrow.sol:MultiTokenEscrow",
        constructorArguments: [AGENT_REGISTRY, FEE_RECIPIENT],
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
