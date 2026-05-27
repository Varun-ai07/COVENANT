/**
 * Terminal dashboard for COVENANT protocol — real-time metrics display.
 * Uses blessed for a TUI with auto-refreshing panels.
 *
 * Usage:
 *   tsx src/dashboard.ts
 */

import blessed from "blessed";
import { formatEther } from "viem";
import {
  METRICS_INTERVAL_MS, ts,
} from "./config.js";
import {
  collectAllMetrics, type ProtocolMetrics, displayMetrics,
} from "./metrics-collector.js";
import { checkSubgraphHealth, type HealthStatus } from "./subgraph-health.js";

// ---------------------------------------------------------------------------
// Dashboard state
// ---------------------------------------------------------------------------

let lastMetrics: ProtocolMetrics | null = null;
let lastHealth: HealthStatus | null = null;
let eventLog: string[] = [];
const MAX_LOG_LINES = 50;

function pushLog(msg: string) {
  eventLog.push(`[${ts()}] ${msg}`);
  if (eventLog.length > MAX_LOG_LINES) eventLog.shift();
}

// ---------------------------------------------------------------------------
// Blessed screen
// ---------------------------------------------------------------------------

const screen = blessed.screen({
  smartCSR: true,
  title: "COVENANT Protocol Dashboard",
});

// Header
const header = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: "100%",
  height: 3,
  tags: true,
  style: { fg: "white", bg: "blue" },
  content: "{center}{bold}COVENANT Protocol Dashboard{/bold}{/center}\n{center}Base Sepolia — Auto-refreshing{/center}",
});

// Protocol Stats panel
const statsBox = blessed.box({
  parent: screen,
  label: " Protocol Stats ",
  top: 3,
  left: 0,
  width: "50%",
  height: "50%-3",
  border: { type: "line" },
  style: { fg: "white", border: { fg: "cyan" } },
  tags: true,
});

// Subgraph Health panel
const healthBox = blessed.box({
  parent: screen,
  label: " Subgraph Health ",
  top: 3,
  left: "50%",
  width: "50%",
  height: "50%-3",
  border: { type: "line" },
  style: { fg: "white", border: { fg: "cyan" } },
  tags: true,
});

// Tasks breakdown panel
const tasksBox = blessed.box({
  parent: screen,
  label: " Tasks by Status ",
  top: "50%",
  left: 0,
  width: "50%",
  height: "50%",
  border: { type: "line" },
  style: { fg: "white", border: { fg: "cyan" } },
  tags: true,
});

// Activity log panel
const logBox = blessed.log({
  parent: screen,
  label: " Activity Log ",
  top: "50%",
  left: "50%",
  width: "50%",
  height: "50%",
  border: { type: "line" },
  style: { fg: "white", border: { fg: "cyan" } },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: { style: { bg: "cyan" } },
  tags: true,
});

// Footer
const footer = blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: "100%",
  height: 1,
  style: { fg: "white", bg: "blue" },
  content: " q: Quit | r: Refresh now | Refreshes every 60s",
});

// Quit
screen.key(["q", "C-c"], () => process.exit(0));
screen.key(["r"], () => refresh());

// ---------------------------------------------------------------------------
// Render functions
// ---------------------------------------------------------------------------

function renderStats(m: ProtocolMetrics) {
  statsBox.setContent([
    `  Agents Registered     : {bold}${m.totalAgents}{/bold}`,
    `  Total Tasks           : {bold}${m.totalTasks}{/bold}`,
    `  Accumulated Fees      : {bold}${formatEther(m.accumulatedFees)}{/bold} ETH`,
    `  Receipts Issued       : {bold}${m.totalReceipts}{/bold}`,
    ``,
    `  Insurance Pool        : {bold}${formatEther(m.poolBalance)}{/bold} ETH`,
    `  Insurance Members     : {bold}${m.memberCount}{/bold}`,
    `  Insurance Claims      : {bold}${m.claimCount}{/bold}`,
    ``,
    `  Disputes Filed        : {bold}${m.disputeCount}{/bold}`,
    ``,
    `  Last 24h:`,
    `    New tasks    : ${m.recent24h.newTasks}`,
    `    Completed    : ${m.recent24h.completedTasks}`,
    `    Disputes     : ${m.recent24h.newDisputes}`,
    `    Claims       : ${m.recent24h.newClaims}`,
  ].join("\n"));
}

function renderHealth(h: HealthStatus | null) {
  if (!h) {
    healthBox.setContent("  Loading...");
    return;
  }

  const statusColor = h.healthy ? "green" : "red";
  const statusText = h.healthy ? "HEALTHY" : "ALERT";

  healthBox.setContent([
    `  Status    : {${statusColor}-fg}{bold}${statusText}{/bold}{/${statusColor}-fg}`,
    `  Synced    : Block ${h.syncedBlock}`,
    `  Chain     : ${h.chainBlock ?? "unknown"}`,
    `  Lag       : ${h.lag != null ? `${h.lag} blocks` : "unknown"}`,
    `  Errors    : ${h.hasIndexingErrors ? "{red-fg}YES{/red-fg}" : "none"}`,
    `  Latency   : ${h.latencyMs}ms`,
    `  Checked   : ${h.checkedAt}`,
    ``,
    h.alerts.length > 0
      ? `  {red-fg}Alerts: ${h.alerts.join(", ")}{/red-fg}`
      : `  {green-fg}No alerts{/green-fg}`,
  ].join("\n"));
}

function renderTasks(m: ProtocolMetrics | null) {
  if (!m || Object.keys(m.tasksByStatus).length === 0) {
    tasksBox.setContent("  No task data available");
    return;
  }

  const lines: string[] = [];
  const maxCount = Math.max(...Object.values(m.tasksByStatus), 1);

  for (const [status, count] of Object.entries(m.tasksByStatus)) {
    const barLen = Math.round((count / maxCount) * 20);
    const bar = "{cyan-fg}" + "|".repeat(barLen) + "{/cyan-fg}";
    const padded = status.padEnd(12);
    lines.push(`  ${padded} ${bar} ${count}`);
  }

  tasksBox.setContent(lines.join("\n"));
}

// ---------------------------------------------------------------------------
// Refresh loop
// ---------------------------------------------------------------------------

async function refresh() {
  pushLog("Refreshing metrics...");

  try {
    const [metrics, health] = await Promise.all([
      collectAllMetrics(),
      checkSubgraphHealth(),
    ]);

    lastMetrics = metrics;
    lastHealth = health;

    renderStats(metrics);
    renderHealth(health);
    renderTasks(metrics);

    pushLog("Metrics updated.");
    if (!health.healthy) {
      for (const a of health.alerts) pushLog(`ALERT: ${a}`);
    }
  } catch (err) {
    pushLog(`Error: ${(err as Error).message}`);
  }

  logBox.setContent(eventLog.join("\n"));
  screen.render();
}

async function main() {
  pushLog("Dashboard started.");
  logBox.setContent(eventLog.join("\n"));
  screen.render();

  // Initial fetch
  await refresh();

  // Periodic refresh
  setInterval(refresh, METRICS_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Dashboard fatal:", err);
  process.exit(1);
});
