/**
 * Claude Code Executor - Primary execution engine for COVENANT worker agents
 * Supports three tiers:
 * 1. Claude CLI (sub-agent spawning) - DEFAULT for big projects
 * 2. MCP Server - Remote execution via Model Context Protocol
 * 3. OpenRouter - CLI flag option for simple tasks
 */

import { execSync, spawn, ChildProcess } from "child_process";
import * as dotenv from "dotenv";

dotenv.config();

// Execution modes
export type ExecutionMode = "claude-cli" | "mcp" | "openrouter";

interface ExecutionOptions {
  mode?: ExecutionMode;
  maxTokens?: number;
  model?: string;
  temperature?: number;
}

interface ExecutionResult {
  report: string;
  mode: ExecutionMode;
  tokens?: number;
}

/**
 * Parse command-line arguments for execution mode
 */
export function getExecutionMode(): ExecutionMode {
  const args = process.argv;

  if (args.includes("--use-openrouter") || args.includes("-o")) {
    return "openrouter";
  }
  if (args.includes("--use-mcp") || args.includes("-m")) {
    return "mcp";
  }
  if (args.includes("--claude-cli") || args.includes("-c")) {
    return "claude-cli";
  }

  // Default: Check environment variable
  const envMode = process.env.EXECUTION_MODE?.toLowerCase();
  if (envMode === "openrouter") return "openrouter";
  if (envMode === "mcp") return "mcp";

  // Default to Claude CLI for big project work
  return "claude-cli";
}

/**
 * Execute work using Claude CLI sub-agent
 * This is the PRIMARY method for complex projects
 */
async function executeWithClaudeCLI(taskDescription: string): Promise<ExecutionResult> {
  console.log("\n[EXECUTOR] Using Claude CLI for execution...");

  // Create a temporary prompt file for the sub-agent
  const prompt = `You are a COVENANT worker agent executing a task from the blockchain.

## Task Description
${taskDescription}

## Your Role
You are an autonomous worker agent that completes tasks and provides detailed work reports.

## Instructions
1. Analyze the task description thoroughly
2. Execute the work required
3. Provide a comprehensive work report with:
   - Summary of what you did
   - Key findings/results
   - Any relevant data or outputs

## Output Format
Provide your response as a structured work report. Be specific and thorough - this is for production use.`;

  try {
    // Use Claude Code to execute the task as a sub-agent
    // The --dangerously-skip-allowed-tools flag allows full tool access
    const claudeCommand = `claude -p --dangerously-skip-allowed-tools "${prompt.replace(/"/g, '\\"')}"`;

    console.log("[EXECUTOR] Spawning Claude CLI sub-agent...");
    const startTime = Date.now();

    // Execute with timeout (30 minutes for big projects)
    const result = execSync(claudeCommand, {
      encoding: "utf-8",
      timeout: 30 * 60 * 1000, // 30 min timeout
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
      stdio: ["pipe", "pipe", "pipe"],
    });

    const duration = Date.now() - startTime;
    console.log(`[EXECUTOR] Claude CLI completed in ${duration}ms`);

    // Claude CLI outputs to stdout - capture the full response
    const report = result || "Claude CLI executed but returned empty output";

    return {
      report,
      mode: "claude-cli",
      tokens: Math.ceil(report.length / 4), // Rough estimate
    };
  } catch (error: any) {
    console.error("[EXECUTOR] Claude CLI error:", error.message);

    // If Claude CLI fails, try MCP as fallback
    console.log("[EXECUTOR] Claude CLI failed, trying MCP...");
    return executeWithMCP(taskDescription);
  }
}

/**
 * Execute work using MCP Server
 * For remote/distributed agent execution
 */
async function executeWithMCP(taskDescription: string): Promise<ExecutionResult> {
  console.log("\n[EXECUTOR] Using MCP Server for execution...");

  const mcpServerUrl = process.env.MCP_SERVER_URL || "http://localhost:3001";

  try {
    const response = await fetch(`${mcpServerUrl}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: taskDescription,
        mode: "autonomous",
        timeout: 30 * 60 * 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP server error: ${response.status}`);
    }

    const data = await response.json() as any;

    return {
      report: data.result || data.output || "MCP executed but returned empty output",
      mode: "mcp",
      tokens: data.tokens,
    };
  } catch (error: any) {
    console.error("[EXECUTOR] MCP error:", error.message);

    // If MCP also fails, throw - don't fall back to OpenRouter automatically
    // User must explicitly request OpenRouter via flag
    throw new Error(`All execution methods failed. Use --use-openrouter for fallback.`);
  }
}

/**
 * Execute work using OpenRouter (simple tasks only)
 * Must be explicitly enabled via --use-openrouter flag
 */
async function executeWithOpenRouter(taskDescription: string): Promise<ExecutionResult> {
  console.log("\n[EXECUTOR] Using OpenRouter for execution (simple mode)...");

  // Dynamic import to avoid loading OpenAI if not needed
  const { generateCompletion } = await import("./llm.js");

  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const report = await generateCompletion(
        `You are an autonomous worker agent. Complete the following task and provide a detailed report:

${taskDescription}

Provide your response as a work report with:
1. Summary of what you did
2. Key findings/results
3. Any relevant data or outputs

Be specific and thorough.`,
        { maxTokens: 4000 } // Increased from 1000 for better outputs
      );

      if (report && report.length > 100) {
        console.log(`[EXECUTOR] Generated ${report.length} chars of work output`);
        return {
          report,
          mode: "openrouter",
          tokens: report.length / 4,
        };
      }

      console.log(`Attempt ${attempt}: Got short response (${report?.length || 0} chars), retrying...`);
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt} failed: ${error}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // OpenRouter failed - return error
  throw new Error(`OpenRouter failed after ${maxRetries} attempts: ${lastError}`);
}

/**
 * Main execution function - routes to appropriate executor based on mode
 */
export async function executeWork(taskDescription: string, options?: ExecutionOptions): Promise<ExecutionResult> {
  const mode = options?.mode || getExecutionMode();

  console.log(`\n=== EXECUTOR: ${mode.toUpperCase()} MODE ===`);
  console.log(`Task: ${taskDescription.slice(0, 100)}...`);

  switch (mode) {
    case "claude-cli":
      return await executeWithClaudeCLI(taskDescription);

    case "mcp":
      return await executeWithMCP(taskDescription);

    case "openrouter":
      return await executeWithOpenRouter(taskDescription);

    default:
      throw new Error(`Unknown execution mode: ${mode}`);
  }
}

/**
 * Execute with specific mode (for programmatic use)
 */
export async function executeWithMode(
  taskDescription: string,
  mode: ExecutionMode
): Promise<ExecutionResult> {
  return executeWork(taskDescription, { mode });
}

// Export for CLI help
export function printUsage() {
  console.log(`
COVENANT Worker Agent Executor
===============================

Usage: npx tsx worker.ts [options]

Options:
  -c, --claude-cli    Use Claude CLI for execution (DEFAULT - for big projects)
  -m, --use-mcp       Use MCP server for execution
  -o, --use-openrouter Use OpenRouter API (simple tasks only)

Environment Variables:
  EXECUTION_MODE=claude-cli|mcp|openrouter
  MCP_SERVER_URL=http://localhost:3001

Examples:
  npx tsx worker.ts                    # Use Claude CLI (default)
  npx tsx worker.ts --use-openrouter   # Use OpenRouter for simple tasks
  npx tsx worker.ts --use-mcp          # Use MCP server
  EXECUTION_MODE=openrouter npx tsx worker.ts

Note: Claude CLI is recommended for complex projects as it provides
full tool access and supports longer context windows.
`);
}