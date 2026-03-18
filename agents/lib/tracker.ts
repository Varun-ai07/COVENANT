import * as fs from "fs";

const STATS_FILE = ".demo-stats.json";

interface DemoStats {
  totalRuns: number;
  totalCostETH: string;
  runs: Array<{
    run: number;
    costETH: string;
    txHashes: string[];
    timestamp: string;
  }>;
}

export function loadStats(): DemoStats {
  if (fs.existsSync(STATS_FILE)) {
    return JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
  }
  return { totalRuns: 0, totalCostETH: "0", runs: [] };
}

export function saveRun(txHashes: string[], costETH: string) {
  const stats = loadStats();
  stats.totalRuns += 1;
  stats.totalCostETH = (
    parseFloat(stats.totalCostETH) + parseFloat(costETH)
  ).toFixed(6);
  stats.runs.push({
    run: stats.totalRuns,
    costETH,
    txHashes,
    timestamp: new Date().toISOString(),
  });
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));

  const remaining = (0.01 - parseFloat(stats.totalCostETH)).toFixed(6);
  const runsLeft = Math.floor(parseFloat(remaining) / 0.0012);

  console.log("\n┌─────────────────────────────────┐");
  console.log("│        DEMO RUN COMPLETE        │");
  console.log("├─────────────────────────────────┤");
  console.log(`│  Run #${stats.totalRuns} cost:   ${costETH} ETH`);
  console.log(`│  Total spent: ${stats.totalCostETH} ETH`);
  console.log(`│  Remaining:   ${remaining} ETH`);
  console.log(`│  Runs left:   ~${runsLeft} more demos`);
  console.log("└─────────────────────────────────┘\n");
}
