/**
 * Stdio transport for COVENANT MCP Server.
 * Used when running as a subprocess (e.g., Claude Code, Cursor, Windsurf).
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export function createStdioTransport(): StdioServerTransport {
  return new StdioServerTransport();
}
