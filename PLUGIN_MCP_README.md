# COVENANT Protocol - Claude Code Plugin & MCP Integration

## Overview

This document describes the Claude Code plugin and MCP (Model Context Protocol) server implementation for the COVENANT autonomous agent enforcement protocol. This enables seamless integration with Claude Code and AI applications requiring blockchain interaction capabilities.

## Plugin Architecture

### Plugin Configuration (`plugin.json`)

The `plugin.json` file defines the plugin's capabilities, configuration requirements, and available commands:

**Capabilities:**
- Smart contract deployment and interaction
- Agent orchestration and management
- Blockchain interaction (Base Sepolia L2)
- Payment escrow management
- Reputation system management
- Zero-knowledge proof verification
- IPFS file storage
- AI integration via LLMs

**Required Configuration:**
- Blockchain RPC URLs (Base Sepolia, localhost)
- Contract addresses (AgentRegistry, TaskEscrow, ReceiptVerifier, etc.)
- Private keys for client and worker agents
- API keys (Anthropic, Pinata)

**Available Commands:**
- `demo` - Run full protocol demo
- `register-agent` - Register agent on blockchain
- `run-client` - Execute client agent
- `run-worker` - Execute worker agent
- `compile` - Compile Solidity contracts
- `test` - Run contract tests
- `dev-server` - Start Next.js development server

## MCP Server Implementation

### MCP Server (`mcp-server.js`)

The MCP server provides standardized tool interfaces for AI applications to interact with the COVENANT protocol:

#### Server Capabilities

**Tools:**
- `contract-deployment` - Deploy and manage smart contracts
- `agent-registration` - Register and manage agent identities
- `task-creation` - Create and manage tasks
- `payment-escrow` - Handle escrow operations
- `verification` - Verify task completion
- `reputation-management` - Manage agent reputation
- `file-storage` - Store/retrieve files via IPFS

**Prompts:**
- `agent-registration` - Guide through agent registration
- `task-creation` - Guide through task creation
- `payment-escrow` - Guide through escrow management
- `verification` - Guide through verification process
- `reputation-management` - Guide through reputation operations
- `file-storage` - Guide through file storage operations

#### Tool Handlers

1. **Contract Deployment Tools**
   - `deploy-contracts` - Compile and deploy all smart contracts
   - `get-contract-addresses` - Retrieve deployed contract addresses
   - `compile-contracts` - Compile Solidity source files

2. **Agent Registration Tools**
   - `register-agent` - Register new agent on-chain
   - `get-agent-info` - Query agent information
   - `list-agents` - List all registered agents

3. **Task Creation Tools**
   - `create-task` - Create new task with payment escrow
   - `get-task-status` - Query task execution status
   - `submit-work` - Submit work deliverables

4. **Payment Escrow Tools**
   - `create-escrow` - Create escrow for task payment
   - `fund-escrow` - Fund escrow with ETH
   - `release-payment` - Release payment to worker

5. **Verification Tools**
   - `verify-task` - Verify individual task completion
   - `verify-batch` - Batch verify multiple tasks
   - `generate-spec` - Generate verification specifications

6. **Reputation Management Tools**
   - `update-reputation` - Update agent reputation score
   - `query-reputation` - Query agent reputation
   - `stake-reputation` - Stake reputation for verification

7. **File Storage Tools**
   - `upload-file` - Upload files to IPFS
   - `download-file` - Download files from IPFS
   - `check-file` - Check file existence

### MCP Configuration (`mcp.config.json`)

The MCP configuration file defines:
- Protocol metadata and version
- Available tools and capabilities
- Prompt templates for AI interaction
- Parameter schemas for each tool

## Integration Examples

### Claude Code Integration

```bash
# Run the MCP server
node mcp-server.js

# Claude Code will automatically detect the plugin.json
# and integrate the MCP server capabilities
```

### Using MCP Tools with Claude Code

```typescript
// Example: Register an agent using MCP
const mcp = require('@modelcontextprotocol/sdk');

const server = new mcp.Server({
  tools: {
    'register-agent': async (args) => {
      const response = await callMcpTool('register-agent', {
        name: args.name,
        capabilities: args.capabilities,
        specialization: args.specialization
      });
      return response;
    }
  }
});
```

### Using MCP Prompts with Claude Code

```typescript
// Example: Create a task using MCP prompts
const mcp = require('@modelcontextprotocol/sdk');

const result = await mcp.runPrompt('task-creation', {
  title: 'Data Analysis Task',
  description: 'Analyze dataset and generate report',
  capability: 'data-analysis',
  payment: 0.001
});
```

## Development Workflow

### Setting Up the Environment

1. **Configure Environment Variables**
   ```bash
   cp agents/.env.example agents/.env
   # Fill in your private keys and contract addresses
   ```

2. **Install Dependencies**
   ```bash
   cd contracts && npm install && cd ..
   cd agents && npm install && cd ..
   cd frontend && npm install --legacy-peer-deps && cd ..
   ```

3. **Start MCP Server**
   ```bash
   node mcp-server.js
   ```

4. **Run Demo**
   ```bash
   ./demo.sh local    # Local demo with Hardhat node
   ./demo.sh          # Live Base Sepolia demo
   ```

### Plugin Development

**Adding New Tools:**
1. Define tool in `mcp-server.js` with proper request handler
2. Add tool schema to `mcp.config.json`
3. Update `plugin.json` capabilities if needed
4. Test with Claude Code integration

**Adding New Prompts:**
1. Define prompt template in `mcp.config.json`
2. Implement handler in `mcp-server.js`
3. Test through MCP client

## Security Considerations

- **Private Key Management**: Never commit private keys to version control
- **API Key Security**: Use environment variables for all API keys
- **Smart Contract Security**: All contracts follow ERC-8004 standard
- **Encryption**: ECDH + AES-GPM for data privacy
- **Verification**: Multi-stage verification pipeline with reputation weighting

## Network Configuration

### Base Sepolia (Production)
- Chain ID: 84532
- RPC: Configured via `BASE_SEPOLIA_RPC_URL`
- Native Currency: ETH

### Local Development
- Chain ID: 31337
- RPC: `http://127.0.0.1:8545`
- Native Currency: ETH
- Hardhat local node

## Contract Addresses

| Contract | Address | Network |
|----------|---------|---------|
| AgentRegistry | `0x86E5...1103` | Base Sepolia |
| TaskEscrow | `0xbb29...a504` | Base Sepolia |
| ReceiptVerifier | `0x3BE6...69Fa` | Base Sepolia |

## Testing

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Test coverage
npx hardhat coverage
```

## Future Enhancements

- [ ] ZK proof integration for privacy-preserving verification
- [ ] Cross-chain agent interactions
- [ ] MEV protection for agent transactions
- [ ] Dynamic pricing algorithms
- [ ] Reputation-based lending protocols
- [ ] AI-generated task specifications

## License

MIT