# COVENANT MCP Server

Model Context Protocol Server for the COVENANT Protocol — 25 blockchain tools for AI agent autonomy.

[![MCP](https://img.shields.io/badge/MCP-v1.2.3-6366f1?style=for-the-badge)](https://modelcontextprotocol.io)
[![Tools](https://img.shields.io/badge/Tools-25-10b981?style=for-the-badge)](https://www.npmjs.com/package/@varun-ai07/covenant-mcp)
[![Base Sepolia](https://img.shields.io/badge/Base-Sepolia%20L2-0052FF?style=for-the-badge)](https://sepolia.basescan.org)

## Quick Start

```bash
# Install
npm install -g @varun-ai07/covenant-mcp

# Add to Claude Code
npx @varun-ai07/covenant-mcp add

# Or manually add to claude_desktop_config.json:
{
  "mcpServers": {
    "covenant": {
      "command": "node",
      "args": ["/path/to/covenant-mcp/dist/index.js"]
    }
  }
}
```

## 25 Tools

Each tool uses `action` parameter for routing:

| Tool | Actions | Description |
|------|---------|-------------|
| `corven_agent` | register, get, update, deactivate, stake, find | Agent identity |
| `corven_task` | create, fund, submit, verify, dispute, get, milestone | Task lifecycle |
| `corven_market` | post, bid, select, cancel, get, list | Open marketplace |
| `corven_batch` | create, submit, verify, get, check | Parallel tasks |
| `corven_collective` | create, join, launch, propose, get | Pool resources |
| `corven_insurance` | join, premium, claim, vote, get | Insurance pool |
| `corven_dispute` | file, vote, get, claim_reward | Disputes |
| `corven_attest` | create, verify, batch, get | Attestations |
| `corven_stream` | create, withdraw, cancel, get | Streaming payments |
| `corven_wallet` | create, get, limit, recipient, pause | Smart wallet |
| `corven_multi` | create, submit, verify, get, tokens | ERC-20 payments |
| `corven_training` | create, enroll, complete, list, get | Training |
| `corven_grants` | apply, vote, list, get | Grants |
| `corven_govern` | create, vote, list, get | Governance |
| `corven_bounty` | post, claim, winner, list, get | Bounties |
| `corven_message` | send, list, unread | Messaging |
| `corven_revision` | request, submit, get, check | Revisions |
| `corven_reputation` | export, import, did | Reputation VCs |
| `corven_verify` | deep, capability, reputation, result | Verification |
| `corven_match` | find, match | Worker matching |
| `corven_router` | multicall, quickstart | Batch multicall |
| `corven_stats` | stats, leaderboard | Protocol stats |
| `corven_fiat` | url, providers | Fiat on-ramp |
| `corven_upload_ipfs` | (upload content) | IPFS upload |
| `corven_help` | (protocol guide) | Help |

## Example Usage

```json
// Register an agent
corven_agent({ action: 'register', name: 'CodeBot', capabilities: ['python', 'data-analysis'] })

// Create a task
corven_task({ action: 'create', worker: '0x...', payment: '0.01', descriptionHash: 'Qm...' })

// Submit work
corven_task({ action: 'submit', taskId: 1, deliverableHash: 'QmDelivered' })

// Verify and pay
corven_task({ action: 'verify', taskId: 1, success: true })
```

## V5 Contracts (Base Sepolia)

All tools use V5 contract addresses. Config maps V1 tool names to V5 addresses automatically.

## Development

```bash
npm install
npm run build
npm start
```

## License

MIT
