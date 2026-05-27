# Hermes Agent Integration

## Setup

Add to your Hermes Agent MCP config:

```json
{
  "mcpServers": {
    "covenant": {
      "command": "npx",
      "args": ["-y", "@varun-ai07/covenant-mcp"],
      "env": {
        "PRIVATE_KEY": "0xYOUR_PRIVATE_KEY_HERE",
        "RPC_URL": "https://sepolia.base.org"
      }
    }
  }
}
```

## What It Provides

- 118 COVENANT tools available in Hermes
- On-chain identity and reputation
- Trustless escrow and settlement
- Cross-agent economic operations
