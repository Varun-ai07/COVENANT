// Deployment script for ERC-4337 Account Abstraction contracts
// Deploys: AgentSmartWallet + CovenantPaymaster
// Run: npx hardhat run scripts/deploy-ab.cjs --network baseSepolia

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");

// Default limits for the smart wallet
const DEFAULT_DAILY_LIMIT = ethers.parseEther("1.0");    // 1 ETH per day
const DEFAULT_PER_TX_LIMIT = ethers.parseEther("0.1");   // 0.1 ETH per tx
const PAYMASTER_FUND = ethers.parseEther("0.01");        // 0.01 ETH seed funding

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AA contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // ─────────────────────────────────────────────────────────────
  // 1. AgentSmartWallet
  // ─────────────────────────────────────────────────────────────
  console.log("\n1. Deploying AgentSmartWallet...");
  const SmartWallet = await ethers.getContractFactory(
    "contracts/v2/core/AgentSmartWallet.sol:AgentSmartWallet"
  );
  const wallet = await SmartWallet.deploy(
    deployer.address,       // controller (human)
    DEFAULT_DAILY_LIMIT,    // daily limit
    DEFAULT_PER_TX_LIMIT    // per-tx limit
  );
  await wallet.waitForDeployment();
  const walletAddr = await wallet.getAddress();
  console.log("   AgentSmartWallet:", walletAddr);

  // ─────────────────────────────────────────────────────────────
  // 2. CovenantPaymaster
  // ─────────────────────────────────────────────────────────────
  console.log("\n2. Deploying CovenantPaymaster...");
  const Paymaster = await ethers.getContractFactory(
    "contracts/v2/core/CovenantPaymaster.sol:CovenantPaymaster"
  );
  const paymaster = await Paymaster.deploy();
  await paymaster.waitForDeployment();
  const paymasterAddr = await paymaster.getAddress();
  console.log("   CovenantPaymaster:", paymasterAddr);

  // ─────────────────────────────────────────────────────────────
  // 3. Fund paymaster with 0.01 ETH
  // ─────────────────────────────────────────────────────────────
  console.log("\n3. Funding paymaster with 0.01 ETH...");
  const fundTx = await deployer.sendTransaction({
    to: paymasterAddr,
    value: PAYMASTER_FUND,
  });
  await fundTx.wait();
  console.log("   Done. Paymaster balance:", ethers.formatEther(await ethers.provider.getBalance(paymasterAddr)), "ETH");

  // ─────────────────────────────────────────────────────────────
  // 4. Save addresses
  // ─────────────────────────────────────────────────────────────
  const addresses = {
    network: "base-sepolia",
    chainId: 84532,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      AgentSmartWallet: walletAddr,
      CovenantPaymaster: paymasterAddr,
    },
    config: {
      dailyLimit: ethers.formatEther(DEFAULT_DAILY_LIMIT) + " ETH",
      perTxLimit: ethers.formatEther(DEFAULT_PER_TX_LIMIT) + " ETH",
      paymasterFunding: "0.01 ETH",
    },
  };

  const outPath = __dirname + "/../v2/ab-deployed-addresses.json";
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to v2/ab-deployed-addresses.json");

  // ─────────────────────────────────────────────────────────────
  // 5. Print summary
  // ─────────────────────────────────────────────────────────────
  console.log("\n=== DEPLOYED ADDRESSES ===");
  console.log("AgentSmartWallet: ", walletAddr);
  console.log("CovenantPaymaster:", paymasterAddr);

  console.log("\n=== ENV VARS FOR MCP ===");
  console.log(`AGENT_SMART_WALLET=${walletAddr}`);
  console.log(`COVENANT_PAYMASTER=${paymasterAddr}`);

  // ─────────────────────────────────────────────────────────────
  // 6. Verify on Basescan
  // ─────────────────────────────────────────────────────────────
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for block confirmations...");
    await wallet.deploymentTransaction().wait(5);
    await paymaster.deploymentTransaction().wait(5);

    console.log("\nVerifying on Basescan...");
    const verifications = [
      {
        name: "AgentSmartWallet",
        address: walletAddr,
        args: [deployer.address, DEFAULT_DAILY_LIMIT, DEFAULT_PER_TX_LIMIT],
        contract: "contracts/v2/core/AgentSmartWallet.sol:AgentSmartWallet",
      },
      {
        name: "CovenantPaymaster",
        address: paymasterAddr,
        args: [],
        contract: "contracts/v2/core/CovenantPaymaster.sol:CovenantPaymaster",
      },
    ];

    for (const v of verifications) {
      try {
        await hre.run("verify:verify", {
          address: v.address,
          constructorArguments: v.args,
          contract: v.contract,
        });
        console.log("  " + v.name + " verified!");
      } catch (e) {
        console.log("  " + v.name + " verification: " + e.message.substring(0, 120));
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
