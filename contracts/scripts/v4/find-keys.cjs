const { ethers } = require('ethers');

const mnemonic = 'since conduct okay panda away puppy category resource lady speed jazz cry';
const mn = ethers.Mnemonic.fromPhrase(mnemonic);

// Your actual addresses
const targets = [
  '0xE2e34Dceb7dAFCd63257C5cbE69Fcb06571ADAcC',
  '0x0b5d818a2E17CD5d2c1c626778B7364b87c94E05',
  '0xF9604702010B90d7Bac46f9854b338d036758f4A',
  '0x47b71B49552B16a58e2c4B796bF3bDB25eD9F2C4',
  '0xBF0A116921abA3DA0D3296b9a4843e999D1F1243',
];

// Try all common derivation paths
const paths = [
  "m/44'/60'/0'/0",      // BIP-44
  "m/44'/60'/0'/0/0",    // BIP-44 with index
  "m/0'/0'/0'",          // Ledger legacy
  "m/0'/0'/0'/0",        // Ledger legacy + index
  "m/44'/60'/0'",        // Some wallets
  "m/0",                 // Simple
  "m/1",                 // Simple
  "m/44'/60'/0'/0/0'/0", // Some variants
];

for (const path of paths) {
  try {
    const hdNode = ethers.HDNodeWallet.fromMnemonic(mn, path);
    for (let i = 0; i < 5; i++) {
      const child = hdNode.deriveChild(i);
      if (targets.includes(child.address)) {
        console.log(`MATCH: ${path}/${i} -> ${child.address}`);
        console.log(`Key: ${child.privateKey}`);
      }
    }
  } catch (e) {
    // skip invalid paths
  }
}

// Also try direct from seed without BIP-44
const seed = mn.computeSeed();
const root = ethers.HDNodeWallet.fromSeed(seed);

// Try deriving as m/0, m/1, m/2 etc
for (let i = 0; i < 20; i++) {
  try {
    const child = root.deriveChild(i);
    if (targets.includes(child.address)) {
      console.log(`MATCH: m/${i} -> ${child.address}`);
      console.log(`Key: ${child.privateKey}`);
    }
  } catch (e) {}
}

// Try hardened derivation m/0'/0'/0'/0/i
try {
  let node = root.derivePath("0'/0'/0'");
  for (let i = 0; i < 5; i++) {
    const child = node.deriveChild(i);
    if (targets.includes(child.address)) {
      console.log(`MATCH: m/0'/0'/0'/${i} -> ${child.address}`);
      console.log(`Key: ${child.privateKey}`);
    }
  }
} catch (e) {}

console.log("Done searching.");
