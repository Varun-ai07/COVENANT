const fs = require('fs');
console.log('Test file access');
console.log('WASM exists:', fs.existsSync('/home/vxrun/Projects/newbie/zk_circuits/ZK-CIRCUITS/capabilityProof/capabilityProof_js/capabilityProof.wasm'));
console.log('ZKEY exists:', fs.existsSync('/home/vxrun/Projects/newbie/zk_circuits/ZK-CIRCUITS/capabilityProof/capabilityProof_final.zkey'));