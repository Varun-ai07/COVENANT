/**
 * HTTP (Streamable) transport for COVENANT MCP Server.
 * Runs an Express server accepting MCP requests over HTTP.
 *
 * Uses the SDK's createMcpExpressApp for DNS rebinding protection,
 * and StreamableHTTPServerTransport for session management.
 *
 * Security features:
 * - API key authentication (required for HTTP)
 * - Rate limiting (100 req/15min per IP)
 * - Binds to localhost by default (override via MCP_HOST)
 */
import { randomUUID, timingSafeEqual } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import rateLimit from "express-rate-limit";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ============================================================
// API Key Authentication Middleware
// ============================================================

function createApiKeyMiddleware() {
  const expectedKey = process.env.MCP_API_KEY;

  return (req: any, res: any, next: any) => {
    // Skip auth for health endpoint
    if (req.path === "/health") {
      return next();
    }

    if (!expectedKey) {
      console.error("[SECURITY] MCP_API_KEY not configured - rejecting request");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    const providedKey = req.headers["x-mcp-api-key"];

    if (!providedKey) {
      return res.status(401).json({ error: "Missing API key" });
    }

    // Timing-safe comparison to prevent timing attacks
    try {
      const providedBuf = Buffer.from(providedKey, "utf-8");
      const expectedBuf = Buffer.from(expectedKey, "utf-8");

      if (providedBuf.length !== expectedBuf.length) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!timingSafeEqual(providedBuf, expectedBuf)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }

    next();
  };
}

// ============================================================
// HTTP Server Startup
// ============================================================

export async function startHttpServer(
  serverFactory: () => McpServer,
  port: number
): Promise<void> {
  // createMcpExpressApp provides DNS rebinding protection for localhost
  const app = createMcpExpressApp();

  // API key authentication (applies to all /mcp endpoints)
  const apiKeyMiddleware = createApiKeyMiddleware();
  app.use("/mcp", apiKeyMiddleware);

  // CORS: only allow same-origin or localhost by default
  const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:5173").split(",");
  app.use("/mcp", (req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin) && !allowedOrigins.includes("*")) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
    next();
  });

  // Rate limiting: 100 requests per 15 minutes per IP
  const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/mcp", rateLimiter);

  // Store transports by session ID (stateful mode)
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.post("/mcp", async (req: any, res: any) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      // Reuse existing session transport
      await transports.get(sessionId)!.handleRequest(req as any, res as any, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      // New session initialization
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid: string) => {
          transports.set(sid, transport);
          console.error(`[HTTP] Session initialized: ${sid}`);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
          console.error(`[HTTP] Session closed: ${transport.sessionId}`);
        }
      };

      const server = serverFactory();
      await server.connect(transport);
      await transport.handleRequest(req as any, res as any, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: invalid session" },
      id: null,
    });
  });

  // Health check endpoint (no auth required, minimal info)
  app.get("/health", (_req: any, res: any) => {
    res.json({ status: "ok", transport: "http" });
  });

  // Bind to localhost by default (security: don't expose to network)
  const host = process.env.MCP_HOST || "127.0.0.1";

  return new Promise((resolve) => {
    app.listen(port, host, () => {
      console.error(`[HTTP] COVENANT MCP Server listening on http://${host}:${port}/mcp`);
      if (!process.env.MCP_API_KEY) {
        console.error("[SECURITY] Warning: MCP_API_KEY not set. Server will reject all requests.");
      }
      resolve();
    });
  });
}
