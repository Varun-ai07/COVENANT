const fs = require('fs');
const f = 'contracts/DisputeArbitration.sol';
let c = fs.readFileSync(f, 'utf8');
c = c.replace(/\\n/g, '\n').replace(/\\"/g, '"');
fs.writeFileSync(f, c, 'utf8');
console.log('Fixed DisputeArbitration.sol - now has', c.split('\n').length, 'lines');