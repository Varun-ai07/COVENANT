// Upgrade V5 UUPS proxy contracts with guardrail fixes
// Run: npx hardhat run scripts/upgrade-v5.cjs --network baseSepolia
//
// Upgrades only contracts that have security fixes and are deployed as UUPS proxies.

const hre = require("hardhat");
const { ethers, upgrades } = hre;

const PROXY_ADDRESSES = {
  CovenantAttestation: "0x945d1576B71fA332e16B5a5fBD6Ca661B4DD1b8D",
  InsurancePool: "0x7855E3BDf7d5FdCa33fF911E8B4B034263214371",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const upgraded = {};

  for (const [name, proxyAddr] of Object.entries(PROXY_ADDRESSES)) {
    console.log(`\nUpgrading ${name} at ${proxyAddr}...`);

    try {
      const Factory = await ethers.getContractFactory(name);
      const contract = await upgrades.upgradeProxy(proxyAddr, Factory);
      await contract.waitForDeployment();
      const addr = await contract.getAddress();
      upgraded[name] = addr;
      console.log(`  ${name} upgraded! Same address: ${addr}`);
    } catch (e) {
      console.error(`  FAILED: ${e.message}`);
    }
  }

  console.log("\n=== UPGRADED ADDRESSES (unchanged) ===");
  for (const [name, addr] of Object.entries(upgraded)) {
    console.log(`  ${name}: ${addr}`);
  }

  console.log("\n=== UPGRADE VERIFICATION ===");
  console.log("Check Basescan to verify new implementation code is deployed.");
  console.log("Proxy addresses remain the same — all state preserved.");
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
