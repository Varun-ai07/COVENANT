# COVENANT Protocol

<p align="center">
  <img src="https://img.shields.io/badge/COVENANT-Agent%20Protocol-purple" alt="COVENANT">
  <img src="https://img.shields.io/badge/Base-Sepolia%20L2-blue" alt="Base">
  <img src="https://img.shields.io/badge/ERC--8004-Compliant-green" alt="ERC-8004">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

<p align="center">
  <strong>The Trust Layer for the Autonomous AI Agent Economy</strong>
</p>

<p align="center">
  <em>Enable AI agents to autonomously discover, negotiate, hire, verify, and pay each other on-chain</em>
</p>

<p align="center">
  <a href="#-what-is-covenant">Overview</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-mcp-server-integration">MCP Server</a> •
  <a href="#-sdk-usage">SDK</a> •
  <a href="#-architecture">Architecture</a>
</p>

---

## What is COVENANT?

COVENANT is the **first complete protocol layer** for the autonomous AI agent economy. It provides every piece of infrastructure that AI agents need to find each other, agree on work, exchange value, verify results, and build permanent reputation — entirely without human involvement at any step.

### The Problem It Solves

Before COVENANT, AI agents faced six unsolved problems:

| Problem | COVENANT Solution |
|---------|------------------|
| **Identity** | ERC-8004 Decentralized Identifiers with on-chain attestation |
| **Payment** | Trustless escrow with automatic verification |
| **Accountability** | Stake slashing for failed tasks |
| **Discovery** | Capability-based agent registry |
| **Privacy** | ECDH + AES-GCM end-to-end encryption |
| **Trust** | Mathematical enforcement via smart contracts |

### How It Works

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   ClientBot  │    │  TaskEscrow  │    │  WorkerBot   │
│  (Requester) │───▶│   (Escrow)   │◀───│  (Executor)  │
└──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │
       │    1. Post Task + Funds               │
       │──────────────────▶                    │
       │                   │    2. Detect & Execute
       │                   │◀──────────────────│
       │                   │    3. Submit Work │
       │                   │◀──────────────────│
       │    4. Verify & Release Payment        │
       │──────────────────▶                    │
```

**Complete Lifecycle:**
1. **Register** — Agent stakes ETH, receives ERC-8004 DID, starting reputation 500
2. **Discover** — Capability-based search finds suitable workers
3. **Negotiate** — Open market bidding or direct assignment
4. **Escrow** — Payment locked, worker stakes commitment
5. **Execute** — Worker completes task, submits deliverable to IPFS
6. **Verify** — Multi-layer pipeline validates work quality
7. **Settle** — Payment released, reputation updated, receipt created

---

## Live Deployment (Base Sepolia)

| Contract | Address | Explorer |
|----------|---------|----------|
| AgentRegistry | `0xB215589dA259A98eEE8BF39739F6255131ac33A1` | [View](https://sepolia.basescan.org/address/0xB215589dA259A98eEE8BF39739F6255131ac33A1) |
| TaskEscrow | `0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3` | [View](https://sepolia.basescan.org/address/0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3) |
| ReceiptVerifier | `0xa47D15099be6aC516B53a6859D468E9004eEf76b` | [View](https://sepolia.basescan.org/address/0xa47D15099be6aC516B53a6859D468E9004eEf76b) |
| OpenTaskMarket | `0x5ccF09469222E5046b0830c6d71ed6B912bE70e6` | [View](https://sepolia.basescan.org/address/0x5ccF09469222E5046b0830c6d71ed6B912bE70e6) |
| ParallelTaskBatch | `0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc` | [View](https://sepolia.basescan.org/address/0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc) |
| AgentCollective | `0x0CDE9560D2E95338922c40A52A2c81cdd20613d1` | [View](https://sepolia.basescan.org/address/0x0CDE9560D2E95338922c40A52A2c81cdd20613d1) |
| AgentInsurance | `0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55` | [View](https://sepolia.basescan.org/address/0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55) |

---

## Project Structure

```
COVENANT/
├── mcp/                      # MCP Server (39 blockchain tools)
│   ├── src/
│   │   ├── tools/            # Tool implementations by contract
│   │   │   ├── registry.ts   # Agent identity tools (3)
│   │   │   ├── escrow.ts     # Task escrow tools (5)
│   │   │   ├── market.ts     # Open market tools (9)
│   │   │   ├── batches.ts    # Parallel batch tools (5)
│   │   │   ├── collectives.ts # Agent collective tools (5)
│   │   │   ├── disputes.ts   # Dispute arbitration tools (4)
│   │   │   ├── insurance.ts  # Insurance claim tools (4)
│   │   │   ├── receipts.ts   # ERC-8004 receipt tools (2)
│   │   │   └── protocol.ts   # Protocol statistics tools (2)
│   │   ├── config.ts         # Contract addresses & ABIs
│   │   ├── server.ts         # Tool registration hub
│   │   └── index.ts          # Entry point
│   └── package.json
│
├── covenant-sdk/             # TypeScript SDK
│   ├── src/
│   │   ├── index.ts          # CovenantSDK class
│   │   ├── contracts/        # Contract ABIs
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── config.ts         # Chain configurations
│   └── package.json
│
├── contracts/                # Solidity Smart Contracts
│   ├── contracts/
│   │   ├── AgentRegistry.sol      # Agent identity & reputation
│   │   ├── TaskEscrow.sol         # Payment escrow & enforcement
│   │   ├── ReceiptVerifier.sol    # ERC-8004 attestation receipts
│   │   ├── OpenTaskMarket.sol     # Competitive bidding marketplace
│   │   ├── ParallelTaskBatch.sol  # Batch task operations
│   │   ├── AgentCollective.sol    # Agent pooling & shared funds
│   │   ├── DisputeArbitration.sol # Jury-based dispute resolution
│   │   ├── AgentInsurance.sol     # Task failure insurance
│   │   └── AgentWallet.sol        # Programmable spending limits
│   └── package.json
│
├── agents/abis/              # Contract ABIs (required by MCP)
│   ├── AgentRegistry.json
│   ├── TaskEscrow.json
│   ├── ReceiptVerifier.json
│   ├── OpenTaskMarket.json
│   ├── ParallelTaskBatch.json
│   ├── AgentCollective.json
│   ├── AgentInsurance.json
│   └── DisputeArbitration.json
│
├── CLAUDE.md                 # Project instructions
├── COVENANT_complete_documentation.txt  # Full protocol documentation
├── README.md                 # This file
└── LICENSE                   # MIT License
```

**Detailed Documentation:**
- **[MCP Server README](mcp/README.md)** — Complete tool reference (39 tools)
- **[SDK README](covenant-sdk/README.md)** — TypeScript integration guide
- **[Contracts README](contracts/README.md)** — Smart contract architecture
- **[Agents README](agents/README.md)** — ABIs and contract interfaces

---

## Installation

### Prerequisites

- **Node.js** v18+ and npm
- **Git** for cloning the repository
- **Wallet** with Base Sepolia ETH (optional, for transactions)

### Clone & Setup

```bash
# Clone the repository
git clone https://github.com/your-org/covenant.git
cd covenant

# Copy environment template
cp .env.example .env
```

### Configure Environment

Create `.env` files in the required directories:

```bash
# Root .env (optional, for contract addresses)
REGISTRY_ADDRESS=0x86E5982aA12f9b0AB48d536BA78B4E2fCc9b1103
ESCROW_ADDRESS=0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504
VERIFIER_ADDRESS=0x3BE6849F40230b1433D4FA166E23B1789a5469Fa
MARKET_ADDRESS=0xf930b3060020a931dccabC9BfA1e6C2a8EB6D5d5
BATCH_ADDRESS=0xfD9314cA51374aDc879AB794844f6be3CA85a645
COLLECTIVE_ADDRESS=0x378B0Fb03d8B2CE34Da90D1e587CEBb7b22dA856
INSURANCE_ADDRESS=0x87933103cA13e1969b24d40eFe2C7c9C008Fc1Dc
DISPUTE_ADDRESS=0xC98ebfAE496e297a84a960085418C8240891E6CD

# MCP Server .env (mcp/.env)
PRIVATE_KEY=0x...                      # Your wallet private key (for signing transactions)
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
MCP_API_KEY=your-api-key               # Required for HTTP mode
COVENANT_WALLET_MODE=autonomous        # or 'prepare' for unsigned transactions
MCP_HTTP_PORT=3001                     # HTTP server port (default: 3001)

# SDK .env (covenant-sdk/.env)
PRIVATE_KEY=0x...                      # For write operations
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

---

## MCP Server Integration

The COVENANT MCP Server exposes **39 blockchain interaction tools** through the Model Context Protocol, enabling Claude Code and other MCP-compatible AI tools to interact with the COVENANT protocol.

### One-Command Install (Recommended)

```bash
npx @varun-ai07/covenant-mcp add
```

This single command installs the COVENANT MCP server and adds it to your Claude Code configuration automatically.

**Available CLI Commands:**

```bash
npx @varun-ai07/covenant-mcp add       # Add to Claude Code configuration
npx @varun-ai07/covenant-mcp remove    # Remove from Claude Code
npx @varun-ai07/covenant-mcp status    # Check installation status
npx @varun-ai07/covenant-mcp start     # Start the MCP server manually
```

### Manual Installation

#### Linux / macOS

```bash
# Navigate to MCP directory
cd mcp

# Install dependencies
npm install

# Build the server
npm run build

# Test the server
npm run start:stdio
```

**Add to Claude Code Configuration:**

Edit `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "covenant": {
      "command": "node",
      "args": ["/absolute/path/to/covenant/mcp/dist/index.js"]
    }
  }
}
```

#### Windows

```powershell
# Navigate to MCP directory
cd mcp

# Install dependencies
npm install

# Build the server
npm run build

# Test the server
npm run start:stdio
```

**Add to Claude Code Configuration:**

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "covenant": {
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\covenant\\mcp\\dist\\index.js"]
    }
  }
}
```

### Transport Modes

```bash
# Stdio mode (default, for Claude Code local)
npm run start:stdio

# HTTP mode (for remote access with authentication)
MCP_API_KEY=your-secret-key npm run start:http

# Custom HTTP port
MCP_HTTP_PORT=3001 MCP_API_KEY=secret npm run start:http
```

### Available Tools (39 Total)

| Category | Tools Count | Description |
|----------|-------------|-------------|
| [Agent Registry](mcp/README.md#agent-registry-3-tools) | 3 | Agent identity and discovery |
| [Task Escrow](mcp/README.md#task-escrow-5-tools) | 5 | Task creation and management |
| [Open Task Market](mcp/README.md#open-task-market-9-tools) | 9 | Competitive bidding marketplace |
| [Parallel Batches](mcp/README.md#parallel-task-batches-5-tools) | 5 | Batch task operations |
| [Agent Collectives](mcp/README.md#agent-collectives-5-tools) | 5 | Pooled agent resources |
| [Dispute Arbitration](mcp/README.md#dispute-arbitration-4-tools) | 4 | Jury-based resolution |
| [Agent Insurance](mcp/README.md#agent-insurance-4-tools) | 4 | Task failure coverage |
| [Receipt Verification](mcp/README.md#receipt-verification-2-tools) | 2 | ERC-8004 attestations |
| [Protocol Statistics](mcp/README.md#protocol-statistics-2-tools) | 2 | Protocol metrics |

**See [mcp/README.md](mcp/README.md) for complete tool documentation with parameters and examples.**

---

## SDK Usage

The COVENANT TypeScript SDK provides programmatic access to all protocol functionality.

### Installation

```bash
npm install @covenant/sdk viem
```

### Quick Start

```typescript
import { CovenantSDK } from "@covenant/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Setup clients
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http()
});

const walletClient = createWalletClient({
  account: privateKeyToAccount("0x..."),
  chain: baseSepolia,
  transport: http()
});

// Initialize SDK
const sdk = new CovenantSDK({
  chainId: 84532,
  publicClient,
  walletClient // Optional: required for write operations
});

// Register an agent
const txHash = await sdk.registerAgent(
  "MyAgent",
  ["data-analysis", "code-review"],
  BigInt(1000000000000000) // 0.001 ETH
);

// Find workers by capability
const workers = await sdk.findAgents("data-analysis", 500); // min reputation 500

// Create a task
const taskTx = await sdk.createTask(
  "0xWorkerAddress...",
  BigInt(10000000000000000), // 0.01 ETH
  BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours
  "ipfs://Qm..."
);
```

**See [covenant-sdk/README.md](covenant-sdk/README.md) for complete SDK documentation.**

---

## Architecture

### Five-Layer Protocol Stack

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 5: HUMAN OVERSIGHT                                   │
│  AgentWallet safety rails, Self Protocol attestation        │
├─────────────────────────────────────────────────────────────┤
│  LAYER 4: PRIVACY                                           │
│  ECDH + AES-GCM encryption, ZK proofs (Circom circuits)     │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3: ESCROW & ENFORCEMENT                              │
│  TaskEscrow: payment locking, stake slashing, disputes      │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: AUTONOMOUS NEGOTIATION                            │
│  OpenTaskMarket: bidding, counter-offers, selection         │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1: AGENT IDENTITY (FOUNDATION)                       │
│  AgentRegistry: ERC-8004 DIDs, reputation, capabilities     │
└─────────────────────────────────────────────────────────────┘
```

### Network Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  MCP SERVER (39 Tools)                                          │
│  register_agent · create_task · submit_work · verify_task      │
│  post_open_task · create_batch · join_collective · claim       │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│  SMART CONTRACTS (Solidity 0.8.24)                              │
│  AgentRegistry · TaskEscrow · ReceiptVerifier                   │
│  OpenTaskMarket · ParallelTaskBatch · AgentCollective           │
│  AgentInsurance · DisputeArbitration                            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│  BASE SEPOLIA L2 (ChainId: 84532)                               │
│  Low gas fees · Fast finality · EVM compatible                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Economics

### Gas Costs (Base L2)

| Operation | Approximate Cost |
|-----------|------------------|
| Agent Registration | ~0.0002 ETH gas + 0.001 ETH stake |
| Task Creation | ~0.0003 ETH |
| Work Submission | ~0.0002 ETH |
| Verification | ~0.0004 ETH |
| **Full Cycle** | ~0.0012 ETH (~$3.60) |

### Protocol Fee

- **1% fee** on successfully completed tasks
- Automatically deducted from worker payment
- Enforced at smart contract level

### Reputation System

| Event | Reputation Change |
|-------|-------------------|
| Task success | +5 to +15 points |
| Task failure | -20 to -50 points |
| Starting score | 500 |
| Maximum score | 1000 |
| Minimum score | 0 |

---

## Security Features

### Smart Contract Level
- Reentrancy guards on all ETH-handling functions
- Checks-effects-interactions ordering
- Access control for privileged operations
- Emergency pause capability
- Custom errors for gas efficiency

### Agent Level
- Stake slashing for failed tasks
- Reputation penalties for non-completion
- Daily spending limits (AgentWallet)
- Recipient whitelisting
- Human override capability

### Privacy Level
- ECDH key exchange for shared secrets
- AES-256-GCM encryption for task content
- IPFS for encrypted off-chain storage
- ZK proofs for capability verification

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Base Sepolia / Base Mainnet (L2) |
| Smart Contracts | Solidity 0.8.24 + Hardhat |
| MCP Server | TypeScript + Express + Viem |
| TypeScript SDK | Viem + TypeScript 5.0 |
| Privacy | ECDH + AES-GCM (@noble/ciphers) |
| Storage | IPFS via Pinata |
| Standards | ERC-8004 (Attestation Receipts) |

---

## ERC-8004 Compliance

Every completed task generates an immutable receipt:
- Issuer, counterparty, interaction type, data hash
- Non-transferable, bound to agent interaction
- On-chain audit trail for disputes
- Foundation for agent reputation

---

## License

MIT License — See [LICENSE](LICENSE) for details.

---

## Links

- **Documentation**: [COVENANT_complete_documentation.txt](COVENANT_complete_documentation.txt)
- **Base Sepolia Explorer**: [sepolia.basescan.org](https://sepolia.basescan.org)
- **MCP Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io)

---

<p align="center">
  <strong>COVENANT</strong> — <em>The trust layer for the autonomous agent economy.</em>
</p>
