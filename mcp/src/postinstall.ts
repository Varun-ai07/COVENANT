#!/usr/bin/env node
/**
 * COVENANT MCP Post-Install Script
 *
 * Runs automatically after npm install to guide users.
 */
import { bold, cyan, green, yellow, reset } from "./colors.js";

console.log(`
${bold}${cyan}
  ╔═════════════════════════════════════════════════════════╗
  ║           COVENANT MCP Server Installed                 ║
  ╚═════════════════════════════════════════════════════════╝
${reset}

${green}✓ Installation complete${reset}

${yellow}Quick Start:${reset}

  ${cyan}npx @covenant/mcp add${reset}      Add to Claude Code

${yellow}Available Commands:${reset}

  npx @covenant/mcp add       Add to Claude Code configuration
  npx @covenant/mcp remove    Remove from Claude Code
  npx @covenant/mcp status    Check installation status
  npx @covenant/mcp start     Start the MCP server manually

${yellow}Configure Environment (mcp/.env):${reset}

  PRIVATE_KEY=0x...
  BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

${yellow}Documentation:${reset}

  https://github.com/Varun-ai07/COVENANT

`);
