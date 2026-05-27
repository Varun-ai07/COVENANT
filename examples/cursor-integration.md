# Cursor Integration

## Setup

1. Open project in Cursor
2. Create `.cursor/mcp.json`:

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

3. Restart Cursor
4. COVENANT tools available in AI chat
