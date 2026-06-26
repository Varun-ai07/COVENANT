#!/usr/bin/env node
/**
 * COVENANT MCP CLI
 *
 * One-command installation for all MCP-compatible AI agent platforms.
 *
 * Supported platforms:
 *   - Claude Code (claude mcp add)
 *   - OpenClaude (~/.openclaude/mcp.json)
 *   - Cursor (~/.cursor/mcp.json)
 *   - Cline (~/.cline/mcp.json)
 *   - Windsurf/Codeium (~/.codeium/windsurf/mcp_config.json)
 *   - Project-level (.mcp.json — works with Cursor, Cline, Claude Code, etc.)
 *
 * Usage:
 *   npx @varun-ai07/covenant-mcp add          - Add to all detected platforms
 *   npx @varun-ai07/covenant-mcp add <platform> - Add to specific platform
 *   npx @varun-ai07/covenant-mcp remove       - Remove from all platforms
 *   npx @varun-ai07/covenant-mcp status       - Check installation status
 *   npx @varun-ai07/covenant-mcp start        - Start the MCP server
 *   npx @varun-ai07/covenant-mcp server       - Run MCP server (for clients)
 */
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir, platform } from "os";
import { join } from "path";

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

const NPM_PACKAGE = "@varun-ai07/covenant-mcp@latest";
const IS_WINDOWS = platform() === "win32";
const SERVER_COMMAND = IS_WINDOWS ? "cmd" : "npx";
const SERVER_ARGS = IS_WINDOWS
  ? ["/c", "npx", "-y", NPM_PACKAGE, "server"]
  : ["-y", NPM_PACKAGE, "server"];

// ============================================================
// Platform Detection & Config
// ============================================================

interface Platform {
  name: string;
  id: string;
  configPath: string | null;
  detected: boolean;
  installed: boolean;
  method: "cli" | "json" | "project";
}

function getClaudeCodeConfigPath(): string | null {
  const home = homedir();
  // Claude Code uses ~/.claude.json for user scope
  const claudeJson = join(home, ".claude.json");
  if (existsSync(claudeJson)) return claudeJson;
  // Also check ~/.claude/config.json (older versions)
  const claudeConfig = join(home, ".claude", "config.json");
  if (existsSync(claudeConfig)) return claudeConfig;
  return claudeJson; // Default path to create
}

function getOpenClaudeConfigPath(): string | null {
  const home = homedir();
  const p = join(home, ".openclaude", "mcp.json");
  if (existsSync(p)) return p;
  return null;
}

function getCursorConfigPath(): string | null {
  const home = homedir();
  // Cursor global config
  const globalPath = join(home, ".cursor", "mcp.json");
  if (existsSync(globalPath)) return globalPath;
  return null;
}

function getClineConfigPath(): string | null {
  const home = homedir();
  const globalPath = join(home, ".cline", "mcp.json");
  if (existsSync(globalPath)) return globalPath;
  return null;
}

function getWindsurfConfigPath(): string | null {
  const home = homedir();
  const p = join(home, ".codeium", "windsurf", "mcp_config.json");
  if (existsSync(p)) return p;
  return null;
}

function getMiMoCodeConfigPath(): string {
  return join(process.cwd(), "mimocode.json");
}

function detectPlatforms(): Platform[] {
  const platforms: Platform[] = [];

  // Claude Code — check if `claude` CLI is available
  let claudeCodeAvailable = false;
  try {
    execSync("claude --version", { stdio: "ignore" });
    claudeCodeAvailable = true;
  } catch {}
  platforms.push({
    name: "Claude Code",
    id: "claude-code",
    configPath: getClaudeCodeConfigPath(),
    detected: claudeCodeAvailable,
    installed: false,
    method: "cli",
  });

  // OpenClaude
  const openClaudePath = getOpenClaudeConfigPath();
  platforms.push({
    name: "OpenClaude",
    id: "openclaude",
    configPath: openClaudePath,
    detected: openClaudePath !== null,
    installed: false,
    method: "json",
  });

  // Cursor
  const cursorPath = getCursorConfigPath();
  platforms.push({
    name: "Cursor",
    id: "cursor",
    configPath: cursorPath,
    detected: cursorPath !== null,
    installed: false,
    method: "json",
  });

  // Cline
  const clinePath = getClineConfigPath();
  platforms.push({
    name: "Cline",
    id: "cline",
    configPath: clinePath,
    detected: clinePath !== null,
    installed: false,
    method: "json",
  });

  // Windsurf
  const windsurfPath = getWindsurfConfigPath();
  platforms.push({
    name: "Windsurf/Codeium",
    id: "windsurf",
    configPath: windsurfPath,
    detected: windsurfPath !== null,
    installed: false,
    method: "json",
  });

  // Project-level .mcp.json (always available)
  const projectMcpPath = join(process.cwd(), ".mcp.json");
  platforms.push({
    name: "Project .mcp.json",
    id: "project",
    configPath: projectMcpPath,
    detected: true,
    installed: existsSync(projectMcpPath),
    method: "project",
  });

  // MiMo Code — project-level mimocode.json
  const mimocodePath = getMiMoCodeConfigPath();
  platforms.push({
    name: "MiMo Code",
    id: "mimocode",
    configPath: mimocodePath,
    detected: true,
    installed: existsSync(mimocodePath) && isInstalled(readJsonConfig(mimocodePath)),
    method: "project",
  });

  return platforms;
}

// ============================================================
// Config Read/Write Helpers
// ============================================================

function readJsonConfig(path: string): any {
  if (!existsSync(path)) return { mcpServers: {} };
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { mcpServers: {} };
  }
}

function writeJsonConfig(path: string, config: any): void {
  const dir = join(path, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
}

function isInstalled(config: any): boolean {
  return !!config.mcpServers?.covenant;
}

// ============================================================
// Platform-Specific Add/Remove
// ============================================================

function addToClaudeCode(): boolean {
  try {
    execSync(
      `claude mcp add --transport stdio --scope user covenant -- ${SERVER_ARGS.join(" ")}`,
      { stdio: "ignore" }
    );
    return true;
  } catch {
    // Fallback: write directly to config
    const configPath = getClaudeCodeConfigPath();
    if (!configPath) return false;
    const config = readJsonConfig(configPath);
    config.mcpServers = config.mcpServers || {};
    config.mcpServers.covenant = {
      command: SERVER_COMMAND,
      args: SERVER_ARGS,
    };
    writeJsonConfig(configPath, config);
    return true;
  }
}

function removeFromClaudeCode(): boolean {
  try {
    execSync("claude mcp remove covenant", { stdio: "ignore" });
    return true;
  } catch {
    const configPath = getClaudeCodeConfigPath();
    if (!configPath || !existsSync(configPath)) return false;
    const config = readJsonConfig(configPath);
    if (config.mcpServers?.covenant) {
      delete config.mcpServers.covenant;
      writeJsonConfig(configPath, config);
      return true;
    }
    return false;
  }
}

function addToJsonPlatform(configPath: string): boolean {
  const config = readJsonConfig(configPath);
  config.mcpServers = config.mcpServers || {};
  config.mcpServers.covenant = {
    command: SERVER_COMMAND,
    args: SERVER_ARGS,
  };
  writeJsonConfig(configPath, config);
  return true;
}

function removeFromJsonPlatform(configPath: string): boolean {
  if (!existsSync(configPath)) return false;
  const config = readJsonConfig(configPath);
  if (config.mcpServers?.covenant) {
    delete config.mcpServers.covenant;
    writeJsonConfig(configPath, config);
    return true;
  }
  return false;
}

function addToProject(): boolean {
  const projectPath = join(process.cwd(), ".mcp.json");
  const config = readJsonConfig(projectPath);
  config.mcpServers = config.mcpServers || {};
  config.mcpServers.covenant = {
    command: SERVER_COMMAND,
    args: SERVER_ARGS,
  };
  writeJsonConfig(projectPath, config);
  return true;
}

function removeFromProject(): boolean {
  const projectPath = join(process.cwd(), ".mcp.json");
  if (!existsSync(projectPath)) return false;
  const config = readJsonConfig(projectPath);
  if (config.mcpServers?.covenant) {
    delete config.mcpServers.covenant;
    // Remove file if empty
    if (Object.keys(config.mcpServers).length === 0) {
      writeJsonConfig(projectPath, { mcpServers: {} });
    } else {
      writeJsonConfig(projectPath, config);
    }
    return true;
  }
  return false;
}

// ============================================================
// Commands
// ============================================================

function addCommand(targetPlatform?: string): void {
  log("\n  COVENANT MCP Installer\n", colors.bold + colors.cyan);

  const platforms = detectPlatforms();
  const serverEntry = `  ${colors.cyan}command:${colors.reset} ${SERVER_COMMAND}\n  ${colors.cyan}args:${colors.reset}    [${SERVER_ARGS.join(", ")}]`;
  log(`  Server config:\n${serverEntry}\n`);

  let installedCount = 0;

  for (const p of platforms) {
    // If specific platform requested, skip others
    if (targetPlatform && p.id !== targetPlatform) continue;

    if (!p.detected) {
      log(`  ${colors.dim}[skip]${colors.reset} ${p.name} — not detected`, colors.dim);
      continue;
    }

    // Check if already installed
    if (p.method === "json" && p.configPath) {
      const config = readJsonConfig(p.configPath);
      if (isInstalled(config)) {
        log(`  ${colors.yellow}[exists]${colors.reset} ${p.name} — already configured`, colors.yellow);
        installedCount++;
        continue;
      }
    }

    let success = false;
    switch (p.id) {
      case "claude-code":
        success = addToClaudeCode();
        break;
      case "openclaude":
        try {
            execSync(`openclaude mcp add --scope user covenant -- ${SERVER_ARGS.join(" ")}`, { stdio: "ignore" });
            success = true;
          } catch {
            if (p.configPath) success = addToJsonPlatform(p.configPath);
          }
          break;
        break;
      case "cursor":
        if (p.configPath) success = addToJsonPlatform(p.configPath);
        break;
      case "cline":
        if (p.configPath) success = addToJsonPlatform(p.configPath);
        break;
      case "windsurf":
        if (p.configPath) success = addToJsonPlatform(p.configPath);
        break;
      case "project":
        success = addToProject();
        break;
      case "mimocode":
        success = addToJsonPlatform(join(process.cwd(), "mimocode.json"));
        break;
    }

    if (success) {
      log(`  ${colors.green}[added]${colors.reset} ${p.name}`, colors.green);
      installedCount++;
    } else {
      log(`  ${colors.red}[fail]${colors.reset} ${p.name}`, colors.red);
    }
  }

  if (installedCount === 0) {
    log(`\n  No platforms detected. Create a ${colors.cyan}.mcp.json${colors.reset} in your project root:`, colors.yellow);
    log(`    npx @varun-ai07/covenant-mcp add project\n`);
  } else {
    log(`\n  ${colors.green}Installed on ${installedCount} platform(s)${colors.reset}`);
    log(`\n  ${colors.bold}Next steps:${colors.reset}`);
    log(`    1. (Optional) Set PRIVATE_KEY env var for transactions`, colors.yellow);
    log(`    2. Restart your AI agent / IDE`, colors.yellow);
    log("");
  }
}

function removeCommand(): void {
  log("\n  Removing COVENANT MCP...\n", colors.yellow);

  const platforms = detectPlatforms();
  let removedCount = 0;

  for (const p of platforms) {
    if (!p.detected) continue;

    let success = false;
    switch (p.id) {
      case "claude-code":
        success = removeFromClaudeCode();
        break;
      case "project":
        success = removeFromProject();
        break;
      default:
        if (p.configPath) success = removeFromJsonPlatform(p.configPath);
        break;
    }

    if (success) {
      log(`  ${colors.green}[removed]${colors.reset} ${p.name}`, colors.green);
      removedCount++;
    }
  }

  if (removedCount === 0) {
    log("  Nothing to remove.", colors.dim);
  } else {
    log(`\n  Removed from ${removedCount} platform(s)\n`, colors.green);
  }
}

function statusCommand(): void {
  log("\n  COVENANT MCP Status\n", colors.bold + colors.cyan);

  const platforms = detectPlatforms();

  for (const p of platforms) {
    if (!p.detected) {
      log(`  ${colors.dim}[--]${colors.reset} ${p.name} — not detected`, colors.dim);
      continue;
    }

    let installed = false;
    if (p.method === "json" && p.configPath) {
      const config = readJsonConfig(p.configPath);
      installed = isInstalled(config);
    } else if (p.id === "claude-code") {
      // Check claude.json
      const configPath = getClaudeCodeConfigPath();
      if (configPath && existsSync(configPath)) {
        const config = readJsonConfig(configPath);
        installed = isInstalled(config);
      }
    } else if (p.id === "project") {
      const projectPath = join(process.cwd(), ".mcp.json");
      if (existsSync(projectPath)) {
        const config = readJsonConfig(projectPath);
        installed = isInstalled(config);
      }
    }

    const status = installed ? `${colors.green}[installed]` : `${colors.dim}[not installed]`;
    log(`  ${status}${colors.reset} ${p.name}`);
  }

  log("");
}

function startCommand(): void {
  log("\n  Starting COVENANT MCP Server...\n", colors.cyan);

  // Dynamically import and run the server
  import("./index.js").catch((err) => {
    log(`  Failed to start: ${err.message}`, colors.red);
    process.exit(1);
  });
}

function serverCommand(): void {
  // Direct server mode for MCP clients — import and run
  import("./index.js").catch((err) => {
    console.error(`[FATAL] Server failed: ${err.message}`);
    process.exit(1);
  });
}

function helpCommand(): void {
  log(`
  ${colors.bold}COVENANT MCP CLI${colors.reset}

  ${colors.cyan}Usage:${colors.reset}
    npx @varun-ai07/covenant-mcp add              Add to all detected platforms
    npx @varun-ai07/covenant-mcp add <platform>    Add to specific platform
    npx @varun-ai07/covenant-mcp remove            Remove from all platforms
    npx @varun-ai07/covenant-mcp status            Check installation status
    npx @varun-ai07/covenant-mcp server            Run MCP server (for clients)
    npx @varun-ai07/covenant-mcp start             Start server in foreground

  ${colors.cyan}Platforms:${colors.reset}
    claude-code    Claude Code (via claude CLI or ~/.claude.json)
    openclaude     OpenClaude (~/.openclaude/mcp.json)
    cursor         Cursor IDE (~/.cursor/mcp.json)
    cline          Cline VS Code extension (~/.cline/mcp.json)
    windsurf       Windsurf/Codeium (~/.codeium/windsurf/mcp_config.json)
    project        Project-level .mcp.json (cross-platform, git-committable)

  ${colors.cyan}Examples:${colors.reset}
    npx @varun-ai07/covenant-mcp add                    # Auto-detect & install all
    npx @varun-ai07/covenant-mcp add claude-code         # Claude Code only
    npx @varun-ai07/covenant-mcp add openclaude          # OpenClaude only
    npx @varun-ai07/covenant-mcp add project             # Create .mcp.json in cwd

  ${colors.cyan}Environment Variables:${colors.reset}
    PRIVATE_KEY           Wallet private key for signing transactions
    BASE_SEPOLIA_RPC_URL  RPC endpoint (default: https://sepolia.base.org)

  ${colors.cyan}Documentation:${colors.reset}
    https://github.com/Varun-ai07/COVENANT

`);
}

// ============================================================
// Main CLI
// ============================================================

const command = process.argv[2] || "help";
const targetPlatform = process.argv[3];

switch (command) {
  case "add":
  case "install":
    addCommand(targetPlatform);
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
  case "server":
    serverCommand();
    break;
  case "help":
  case "--help":
  case "-h":
  default:
    helpCommand();
    break;
}
