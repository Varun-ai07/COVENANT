# COVENANT MCP Server — Design Spec

**Date:** 2026-05-06
**Status:** Approved
**Scope:** Phase 1 — Core MCP server with 12 tools, dual transport, dual-mode wallet

## Overview

Convert COVENANT's blockchain agent protocol into an MCP (Model Context Protocol) server so any AI coding agent (Claude Code, Cursor, Windsurf, etc.) can interact with COVENANT's smart contracts directly via standardized tool calls.

## Architecture

### Directory Structure
```
mcp/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts              # Entry point — transport detection + server start
│   ├── server.ts             # McpServer instance + tool registration
│   ├── config.ts             # Env loading, contract addresses, chain config
│   ├── transports/
│   │   ├── stdio.ts          # StdioServerTransport
│   │   └── http.ts           # Express + StreamableHTTPServerTransport
│   ├── tools/
│   │   ├── registry.ts       # AgentRegistry: register_agent, get_agent, find_workers
│   │   ├── escrow.ts         # TaskEscrow: create_task, submit_work, verify_task, get_task, dispute_task
│   │   ├── receipts.ts       # ReceiptVerifier: get_receipts, verify_receipt
│   │   └── protocol.ts       # Cross-contract: get_stats, get_leaderboard
│   ├── handlers/
│   │   ├── wallet.ts         # Dual-mode wallet (autonomous + prepare-only)
│   │   └── transactions.ts   # Safe tx execution, gas estimation, error parsing
│   └── types.ts              # Shared TypeScript interfaces
```

### Transport
- **stdio**: For local AI tools (Claude Code, Cursor). `--stdio` flag or default.
- **HTTP/SSE**: For remote clients. Express + `NodeStreamableHTTPServerTransport` on port 3001.

### Wallet Dual Mode
- `COVENANT_WALLET_MODE=autonomous` (default): Server holds private key in .env, signs + sends transactions immediately.
- `COVENANT_WALLET_MODE=prepare-only`: Returns unsigned calldata for external signing.

### Reused Code (imported from agents/)
- `agents/lib/config.ts` — wallet creation, contract addresses, chain config
- `agents/lib/abis.ts` — contract ABIs
- `agents/lib/crypto.ts` — Lit Protocol encryption (Phase 2+)

## Phase 1 Tools (12 tools)

### AgentRegistry
1. `register_agent` — write — Register with name, capabilities, stake
2. `get_agent` — read — Get agent details by address
3. `find_workers` — read — Search by capability, min reputation

### TaskEscrow
4. `create_task` — write — Create task with worker, payment, deadline, spec
5. `submit_work` — write — Submit deliverable hash
6. `verify_task` — write — Approve/reject work
7. `get_task` — read — Full task details by ID
8. `dispute_task` — write — File dispute

### ReceiptVerifier
9. `get_receipts` — read — All receipts for agent address
10. `verify_receipt` — read — Verify receipt validity

### Protocol
11. `get_stats` — read — Total agents, tasks, volume, fees
12. `get_leaderboard` — read — Top agents by reputation

## Dependencies
- `@modelcontextprotocol/sdk` — MCP server SDK
- `@modelcontextprotocol/sdk-express` — Express integration
- `viem` — Blockchain client (shared with agents/)
- `zod` — Input validation
- `express` — HTTP transport
- `dotenv` — Environment config

## Full Build Phases
1. **MCP Server (Core)** — 12 tools, stdio + HTTP, dual-mode wallet
2. **Security Hardening** — ReentrancyGuard, Slither, fuzz tests, emergency pause
3. **Frontend Polish** — Basescan links, TX hashes, leaderboard filters, per-agent analytics
4. **Full MCP Tools** — All 9 contracts, ~28 tools
5. **The Graph Subgraph** — GraphQL indexing
6. **SDKs** — TypeScript + Python (auto-generated from MCP tools)
7. **Docs + Templates** — Docusaurus + 6 agent templates
8. **Remaining Features** — Memory, referrals, ENS, Kleros, multi-chain, ZK circuits
