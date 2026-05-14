#!/usr/bin/env node
/**
 * COVENANT MCP CLI
 *
 * One-command installation for Claude Code and MCP-compatible tools.
 *
 * Usage:
 *   npx @covenant/mcp add          - Add to Claude Code config
 *   npx @covenant/mcp remove       - Remove from Claude Code config
 *   npx @covenant/mcp status       - Check installation status
 *   npx @covenant/mcp start        - Start the MCP server
 */
import { spawn, execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir, platform } from "os";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function getConfigPath(): string {
  const os = platform();
  if (os === "win32") {
    return join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json");
  }
  return join(homedir(), ".claude", "claude_desktop_config.json");
}

function getServerPath(): string {
  return join(__dirname, "index.js");
}

function readConfig(): any {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { mcpServers: {} };
  }
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch (e) {
    return { mcpServers: {} };
  }
}

function writeConfig(config: any): void {
  const configPath = getConfigPath();
  const configDir = dirname(configPath);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function addCommand(): void {
  log("\n  COVENANT MCP Installer\n", colors.bold + colors.cyan);

  const serverPath = getServerPath();
  const configPath = getConfigPath();

  log(`  Server path: ${serverPath}`, colors.blue);
  log(`  Config path: ${configPath}`, colors.blue);
  log("");

  // Check if server is built
  if (!existsSync(serverPath)) {
    log("  ✗ Server not built. Running build...", colors.yellow);
    try {
      execSync("npm run build", { cwd: __dirname, stdio: "inherit" });
    } catch (e) {
      log("  ✗ Build failed. Please run 'npm run build' in the mcp directory.", colors.red);
      process.exit(1);
    }
  }

  const config = readConfig();

  // Add covenant server
  config.mcpServers = config.mcpServers || {};
  config.mcpServers.covenant = {
    command: "node",
    args: [serverPath],
  };

  writeConfig(config);

  log("  ✓ COVENANT MCP added to Claude Code configuration", colors.green);
  log("");
  log("  Available tools (39):", colors.bold);
  log("    • Agent Registry: register_agent, get_agent, find_workers", colors.reset);
  log("    • Task Escrow: create_task, get_task, submit_work, verify_task, dispute_task", colors.reset);
  log("    • Open Market: post_open_task, submit_bid, select_worker, ...", colors.reset);
  log("    • And 25+ more blockchain interaction tools", colors.reset);
  log("");
  log("  Next steps:", colors.bold);
  log("    1. Set environment variables in mcp/.env:", colors.yellow);
  log("       PRIVATE_KEY=0x...", colors.reset);
  log("       BASE_SEPOLIA_RPC_URL=https://sepolia.base.org", colors.reset);
  log("");
  log("    2. Restart Claude Code", colors.yellow);
  log("");
  log("  Contract Addresses (Base Sepolia):", colors.bold);
  log("    AgentRegistry: 0x3e4a9013Ec6315eF0e13B4f768e07cf43c6c3369", colors.cyan);
  log("    TaskEscrow:    0xb2a2b7f046fa82A020B3008A71E61d16603BAa05", colors.cyan);
  log("");
}

function removeCommand(): void {
  log("\n  Removing COVENANT MCP...\n", colors.yellow);

  const config = readConfig();

  if (config.mcpServers?.covenant) {
    delete config.mcpServers.covenant;
    writeConfig(config);
    log("  ✓ COVENANT MCP removed from Claude Code configuration\n", colors.green);
  } else {
    log("  ✗ COVENANT MCP was not installed\n", colors.yellow);
  }
}

function statusCommand(): void {
  log("\n  COVENANT MCP Status\n", colors.bold + colors.cyan);

  const config = readConfig();
  const isInstalled = !!config.mcpServers?.covenant;

  log(`  Installed: ${isInstalled ? "✓ Yes" : "✗ No"}`, isInstalled ? colors.green : colors.red);

  if (isInstalled) {
    const serverPath = config.mcpServers.covenant.args?.[0];
    log(`  Server: ${serverPath}`, colors.blue);
    log(`  Built: ${existsSync(serverPath) ? "✓ Yes" : "✗ No"}`, existsSync(serverPath) ? colors.green : colors.red);
  }

  log("");
}

function startCommand(): void {
  log("\n  Starting COVENANT MCP Server...\n", colors.cyan);

  const serverPath = getServerPath();

  if (!existsSync(serverPath)) {
    log("  ✗ Server not built. Run 'npm run build' first.\n", colors.red);
    process.exit(1);
  }

  const child = spawn("node", [serverPath, "--stdio"], {
    stdio: "inherit",
  });

  child.on("error", (error) => {
    log(`  ✗ Error: ${error.message}`, colors.red);
  });
}

function helpCommand(): void {
  log(`
  ${colors.bold}COVENANT MCP CLI${colors.reset}

  ${colors.cyan}Usage:${colors.reset}
    npx @covenant/mcp add       Add to Claude Code configuration
    npx @covenant/mcp remove    Remove from Claude Code configuration
    npx @covenant/mcp status    Check installation status
    npx @covenant/mcp start     Start the MCP server manually

  ${colors.cyan}Environment Variables (mcp/.env):${colors.reset}
    PRIVATE_KEY           Wallet private key for signing transactions
    BASE_SEPOLIA_RPC_URL  RPC endpoint (default: https://sepolia.base.org)
    MCP_API_KEY           API key for HTTP mode
    MCP_HTTP_PORT         HTTP server port (default: 3001)

  ${colors.cyan}Documentation:${colors.reset}
    https://github.com/Varun-ai07/COVENANT

`);
}

// Main CLI
const command = process.argv[2] || "help";

switch (command) {
  case "add":
  case "install":
    addCommand();
    break;
  case "remove":
  case "uninstall":
    removeCommand();
    break;
  case "status":
  case "check":
    statusCommand();
    break;
  case "start":
  case "run":
    startCommand();
    break;
  case "help":
  case "--help":
  case "-h":
  default:
    helpCommand();
    break;
}
