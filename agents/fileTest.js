const fs = require('fs');

// Test if we can read the circuit files
console.log("Testing file access...");

const wasmPath = '/home/vxrun/Projects/newbie/zk_circuits/ZK-CIRCUITS/capabilityProof/capabilityProof_js/capabilityProof.wasm';
const zkeyPath = '/home/vxrun/Projects/newbie/zk_circuits/ZK-CIRCUITS/capabilityProof/capabilityProof_final.zkey';

console.log("WASM file exists:", fs.existsSync(wasmPath));
console.log("ZKEY file exists:", fs.existsSync(zkeyPath));

if (fs.existsSync(wasmPath)) {
  console.log("WASM file size:", fs.statSync(wasmPath).size);
}

if (fs.existsSync(zkeyPath)) {
  console.log("ZKEY file size:", fs.statSync(zkeyPath).size);
}