# COVENANT Plugin & MCP Deployment Guide

## Quick Start

### Option 1: Local Development (Recommended for Testing)

```bash
# 1. Configure environment
cp agents/.env.example agents/.env
# Edit agents/.env with your private keys

# 2. Install dependencies
cd contracts && npm install && cd ..
cd agents && npm install && cd ..
cd frontend && npm install --legacy-peer-deps && cd ..

# 3. Start local development
./demo.sh local
```

### Option 2: Live Testnet Deployment

```bash
# 1. Configure for testnet
cp agents/.env.example agents/.env
# Edit agents/.env with testnet RPC URLs and testnet keys

# 2. Deploy to testnet
./demo.sh
```

## Plugin Deployment

### Installation Steps

1. **Copy Plugin Files**
   ```bash
   cp -r .claude /path/to/claude/config/
   # or for Claude Code:
   # ~/.config/claude/plugins/covenant-protocol/
   ```

2. **Configure Environment**
   ```bash
   # Set required environment variables
   export BASE_SEPOLIA_RPC_URL="your-rpc-url"
   export REGISTRY_ADDRESS="0x86E5982aA12f9b0AB48d536BA78B4E2fCc9b1103"
   # ... etc
   ```

3. **Verify Installation**
   ```bash
   # Check plugin is loaded
   ls -la ~/.config/claude/plugins/covenant-protocol/
   cat ~/.config/claude/plugins/covenant-protocol/plugin.json
   ```

### Plugin Commands Available

```bash
# Run demo
/code/plugin run demo

# Compile contracts
/code/plugin run compile

# Run tests
/code/plugin run test

# Register agent
/code plugin run register-agent
```

## MCP Server Deployment

### Standalone Deployment

```bash
# Start MCP server
node mcp-server.js

# Or with debugging
node --inspect-brk mcp-server.js
```

### Integration with Claude Code

1. **Configure MCP Client**
   ```json
   {
     "mcpServers": {
       "covenant": {
         "command": "node",
         "args": ["/path/to/mcp-server.js"]
       }
     }
   }
   ```

2. **Use MCP Tools**
   ```typescript
   const mcp = require('@modelcontextprotocol/sdk');
   const client = new mcp.Client({ server: 'covenant' });
   
   // Call tools
   await client.callTool('register-agent', args);
   await client.runPrompt('task-creation', params);
   ```

### Production Deployment

```bash
# Use process manager (pm2 recommended)
pm2 start mcp-server.js --name covenant-mcp

# Or with Docker
docker run -d \
  -v /path/to/config:/app/config \
  -e BASE_SEPOLIA_RPC_URL=... \
  covenant-mcp:latest
```

## Environment Configuration

### Required Environment Variables

```bash
# Blockchain
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
REGISTRY_ADDRESS="0x86E5982aA12f9b0AB48d536BA78B4E2fCc9b1103"
ESCROW_ADDRESS="0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504"
VERIFIER_ADDRESS="0x3BE6849F40230b1433D4FA166E23B1789a5469Fa"
MARKET_ADDRESS="0x..."
BATCH_ADDRESS="0x..."
COLLECTIVE_ADDRESS="0x..."

# Agent Keys
CLIENT_PRIVATE_KEY="0x..."
WORKER_PRIVATE_KEY="0x..."

# APIs
ANTHROPIC_API_KEY="sk-..."
PINATA_API_KEY="..."
PINATA_SECRET="..."
```

### Optional Environment Variables

```bash
# For enhanced functionality
BASESCAN_API_KEY="..."  # Block explorer API
PRIVATE_KEY="0x..."      # Alternative wallet
```

## Network Configuration

### Base Sepolia (Production)

```bash
# Main network configuration
CHAIN_ID=84532
RPC_URL="https://sepolia.base.org"
NETWORK="base-sepolia"
```

### Localhost (Development)

```bash
# Development network configuration
CHAIN_ID=31337
RPC_URL="http://127.0.0.1:8545"
NETWORK="localhost"
```

## Security Best Practices

### Plugin Security

1. **Environment Variables**
   ```bash
   # Never commit .env files
   echo ".env" >> .gitignore
   echo "*.env" >> .gitignore
   ```

2. **Key Management**
   ```bash
   # Use secure storage
   export PRIVATE_KEY=$(vault read -field=key secret/covenant)
   ```

3. **Access Control**
   ```bash
   # Limit permissions
   chmod 600 .env
   chmod 600 agents/.env
   ```

### MCP Security

1. **Input Validation**
   - All tool parameters validated
   - No arbitrary code execution
   - Sanitized outputs

2. **Connection Security**
   ```bash
   # Use secure connections
   export MCP_TLS=true
   export MCP_CERT_PATH=/path/to/cert
   ```

## Monitoring and Logging

### Plugin Monitoring

```bash
# Check plugin status
/code plugin list

# Monitor logs
tail -f ~/.config/claude/plugins/covenant-protocol/logs/*.log
```

### MCP Server Monitoring

```bash
# Start with logging
node mcp-server.js 2>&1 | tee mcp.log

# Monitor health
curl -X POST http://localhost:8080/health
```

## Troubleshooting

### Common Issues

**Issue: Plugin not loading**
```bash
# Verify installation
ls -la ~/.config/claude/plugins/covenant-protocol/

# Check permissions
chmod 644 ~/.config/claude/plugins/covenant-protocol/plugin.json
```

**Issue: MCP connection failed**
```bash
# Check server is running
ps aux | grep mcp-server

# Verify port
netstat -tlnp | grep 8080

# Test connection
node -e "const {StdioServerTransport} = require('@modelcontextprotocol/sdk/server/stdio'); console.log('MCP OK')"
```

**Issue: Contract deployment fails**
```bash
# Check RPC URL
curl $BASE_SEPOLIA_RPC_URL

# Verify network
npx hardhat node --port 8545
```

### Error Recovery

1. **Rollback Plugin**
   ```bash
   rm -rf ~/.config/claude/plugins/covenant-protocol
   cp -r /backup/plugins/covenant-protocol ~/.config/claude/plugins/
   ```

2. **Restart MCP Server**
   ```bash
   pkill -f mcp-server.js
   node mcp-server.js &
   ```

3. **Redeploy Contracts**
   ```bash
   cd contracts
   npx hardhat run scripts/deploy.ts --network localhost
   ```

## Performance Optimization

### Plugin Optimization

```bash
# Enable caching
export CACHE_PLUGIN=true
export CACHE_DIR=/tmp/covenant-cache
```

### MCP Optimization

```bash
# Enable connection pooling
export MCP_POOL_SIZE=10
export MCP_TIMEOUT=30000
```

## Backup and Recovery

### Backup Configuration

```bash
# Backup plugin
cp -r .claude ~/.claude.backup

# Backup environment
cp agents/.env agents/.env.backup

# Backup contracts
cp -r contracts/artifacts contracts/artifacts.backup
```

### Disaster Recovery

```bash
# Restore plugin
cp -r ~/.claude.backup/.claude ~/.config/claude/

# Restore environment
cp agents/.env.backup agents/.env

# Redeploy contracts
cd contracts && npx hardhat deploy --network localhost
```

## Testing

### Plugin Tests

```bash
# Unit tests
/code plugin run test

# Integration tests
./demo.sh local

# End-to-end tests
npm run test:e2e
```

### MCP Tests

```bash
# Tool availability
node test/mcp-tools.js

# Prompt testing
node test/mcp-prompts.js

# Integration testing
node test/mcp-integration.js
```

## Maintenance

### Regular Tasks

```bash
# Weekly: Check logs
cat mcp.log | grep -E "(ERROR|WARN)"

# Monthly: Update dependencies
cd contracts && npm update
cd agents && npm update

# Quarterly: Security audit
npm audit
npx hardhat security
```

### Version Management

```bash
# Check current version
cat package.json | grep version

# Update plugin
cd /path/to/plugin
git pull origin main

# Update dependencies
npm install
```

## Support and Resources

### Documentation

- Plugin Config: `.claude/plugin.json`
- MCP Config: `mcp.config.json`
- Full Guide: `PLUGIN_MCP_README.md`
- Verification: `VERIFICATION_CHECKLIST.md`

### Contact

For issues or questions:
- Check logs in `~/.config/claude/plugins/covenant-protocol/logs/`
- Review `mcp.log` for MCP server issues
- Consult `CONVERSION_SUMMARY.md` for architecture details