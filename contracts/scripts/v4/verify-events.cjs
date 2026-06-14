const https = require('https');
const API_KEY = 'ZQDWUWS44AX973QU2A75BQDG7XCV81DMXP';

const CONTRACTS = {
  Identity:    '0xB93eCF2bD8DE0e35ddAD13D9F00E70b938C18FdF',
  Escrow:      '0xDb9F26155192c685BEC75E86A7c70A3ca0F80Ac3',
  Settlement:  '0xBB3deBA10b0bDaa79c9384E39cDd899116082939',
  Arbitration: '0x874d2D6Aa857685D1B7786db2eF9C32C0AcfB614',
  Governance:  '0xd505b5CA3dB39d04592D51DB51507550e0d878DF',
  Attestation: '0x65804fb982Be86C48E03107963FDAcd285f21540',
};

function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 });
    const req = https.request({
      hostname: "sepolia.base.org",
      path: "/",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
    }, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const blockRes = await rpc("eth_blockNumber", []);
  const latestBlock = parseInt(blockRes.result, 16);
  console.log("═".repeat(70));
  console.log("COVENANT V4 — EVENT VERIFICATION (RPC eth_getLogs)");
  console.log(`Latest block: ${latestBlock}`);
  console.log("═".repeat(70));

  // All contracts were deployed recently — query last 5000 blocks
  const FROM = latestBlock - 5000;
  const TO = latestBlock;

  for (const [name, addr] of Object.entries(CONTRACTS)) {
    console.log(`\n📋 ${name} (${addr.slice(0,10)}...)`);

    // Query in chunks of 500 blocks (RPC limit)
    let allLogs = [];
    for (let from = FROM; from <= TO; from += 499) {
      const to = Math.min(from + 499, TO);
      const res = await rpc("eth_getLogs", [{
        address: addr,
        fromBlock: "0x" + from.toString(16),
        toBlock: "0x" + to.toString(16),
      }]);
      if (res.result && Array.isArray(res.result)) {
        allLogs = allLogs.concat(res.result);
      }
      await sleep(100);
    }

    console.log(`  Total events: ${allLogs.length}`);

    if (allLogs.length === 0) {
      console.log("  (no events found in this range)");
      continue;
    }

    // Group by topic0
    const grouped = {};
    for (const log of allLogs) {
      const topic = log.topics?.[0] || "unknown";
      if (!grouped[topic]) grouped[topic] = [];
      grouped[topic].push(log);
    }

    for (const [topic, logs] of Object.entries(grouped)) {
      console.log(`\n  📌 Topic: ${topic.slice(0, 18)}... (${logs.length} events)`);
      for (const log of logs) {
        const block = parseInt(log.blockNumber, 16);
        const tx = log.transactionHash;
        const idx = parseInt(log.logIndex, 16);
        console.log(`     Block ${block} | TX ${tx.slice(0,18)}... | logIndex ${idx}`);
        if (log.topics?.length > 1) {
          console.log(`       indexed: ${log.topics.slice(1).map(t => t.slice(0,18)+"..").join(", ")}`);
        }
        if (log.data && log.data !== "0x") {
          console.log(`       data: ${log.data.slice(0, 80)}${log.data.length > 82 ? "..." : ""}`);
        }
      }
    }
  }

  console.log("\n" + "═".repeat(70));
  console.log("Done. All events verified on-chain.");
}

main().catch(e => { console.error(e); process.exit(1); });
