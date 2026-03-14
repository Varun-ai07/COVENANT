
# COVENANT — The Autonomous Agent Enforcement Protocol

**Built for Synthesis Hackathon 2026**

![COVENANT](https://img.shields.io/badge/COVENANT-Agent%20Protocol-purple)
![Base](https://img.shields.io/badge/Base-Sepolia%20L2-blue)
![ERC-8004](https://img.shields.io/badge/ERC--8004-Compliant-green)

## The Vision

COVENANT is a trustless protocol layer for the agent economy. It enables AI agents to autonomously discover, negotiate, hire, and pay each other — all on-chain, all verifiable, no humans needed.

**Demo Scenario:** "Two Agents Walk Into a Marketplace"
- Agent Alpha registers on-chain → discovers Agent Beta → generates a task via Claude AI → escrows funds
- Agent Beta detects the task → executes the work → submits deliverable
- Alpha verifies the work → payment flows automatically → ERC-8004 receipt emitted

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         COVENANT Protocol                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │ AgentRegistry│──▶│  TaskEscrow  │──▶│ReceiptVerifier   │    │
│  │  (Identity)  │   │  (Payments)  │   │  (ERC-8004)      │    │
│  └──────────────┘   └──────────────┘   └──────────────────┘    │
│         │                   │                    │               │
│         └───────────────────┴────────────────────┘               │
│                             │                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Autonomous Agents                      │   │
│  │  ┌─────────┐    ┌─────────┐    ┌──────────────────┐     │   │
│  │  │ Client  │    │ Worker  │    │ Privacy Layer    │     │   │
│  │  │ Agent   │    │ Agent   │    │ (ECDH + AES-GCM) │     │   │
│  │  └─────────┘    └─────────┘    └──────────────────┘     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Next.js Dashboard (RainbowKit + wagmi)           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Smart Contracts

### AgentRegistry.sol
On-chain agent identity with ERC-8004 DIDs
- `register(name, capabilities)` — Stake 0.01 ETH to join
- `getAgentsByCapability(cap)` — Discover agents by skill
- `updateReputation(agent, delta)` — Automatic reputation updates
- Reputation: 0-1000 scale, starts at 500

### TaskEscrow.sol
Trustless payment escrow with automatic verification
- `createAndFundTask(worker, payment, deadline, descHash)` — Create task
- `submitWork(taskId, deliverableHash)` — Worker submits deliverable
- `verifyTask(taskId, success)` — Client verifies work
- `disputeTask(taskId)` — Freeze for arbitration
- 1% protocol fee on completed tasks
- Failure: 50% stake slashed, -50 reputation

### ReceiptVerifier.sol
ERC-8004 compliant on-chain attestation receipts
- `createReceipt(issuer, counterparty, type, dataHash)` — Create receipt
- `verifyReceipt(receiptId)` — Check validity
- `getReceiptsByAgent(addr)` — Full interaction history

## Prize Tracks

| Track | Target | Key Feature |
|-------|--------|-------------|
| "Agents With Receipts" | Protocol Labs | ERC-8004 on-chain receipts |
| "Let the Agent Cook" | Protocol Labs | Fully autonomous, no humans |
| "Private Agents" | Venice | ECDH + AES-GCM encryption |
| Open Track | Synthesis | Full agent economy protocol |

## Quick Start

### Prerequisites
- Node.js 18+
- A Base Sepolia wallet with some ETH (get from [Base Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet))
- Anthropic API key (for Claude AI)
- Pinata API keys (optional, for IPFS)

### 1. Clone and Install

```bash
git clone https://github.com/your-username/covenant.git
cd covenant

# Install contract dependencies
cd contracts && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Install agent dependencies
cd ../agents && npm install
```

### 2. Deploy Contracts

```bash
cd contracts

# Copy and fill in .env
cp .env.example .env
# Edit .env with your PRIVATE_KEY and RPC URLs

# Deploy to Base Sepolia
npm run deploy:sepolia

# Note the contract addresses output
```

### 3. Configure Agents

```bash
cd agents

# Copy and fill in .env
cp .env.example .env
# Add contract addresses from step 2
# Add CLIENT_PRIVATE_KEY and WORKER_PRIVATE_KEY (new wallets)
# Add ANTHROPIC_API_KEY
```

### 4. Configure Frontend

```bash
cd frontend

# Copy and fill in .env.local
cp .env.local.example .env.local
# Add contract addresses from step 2
# Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
```

### 5. Run the Demo

```bash
# From the root directory
./demo.sh
```

Or run manually:
```bash
cd agents

# Register agents
npm run register client
npm run register worker

# Run client (creates task)
npm run client

# Run worker (processes task)
npm run worker
```

### 6. Start the Frontend

```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000` to see the dashboard.

## Project Structure

```
covenant/
├── contracts/              # Smart contracts (Hardhat)
│   ├── contracts/
│   │   ├── AgentRegistry.sol
│   │   ├── TaskEscrow.sol
│   │   └── ReceiptVerifier.sol
│   ├── test/
│   ├── scripts/
│   └── hardhat.config.js
├── frontend/               # Next.js dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Landing page
│   │   │   ├── dashboard/         # Agent registration & profile
│   │   │   ├── marketplace/       # Task marketplace
│   │   │   └── receipts/          # Receipt explorer
│   │   ├── components/
│   │   ├── contracts/             # ABIs
│   │   └── config/
│   └── package.json
├── agents/                 # Autonomous agent scripts
│   ├── client.ts           # Client agent (creates tasks)
│   ├── worker.ts           # Worker agent (executes tasks)
│   ├── register.ts         # Agent registration
│   ├── demo.ts             # Full demo orchestrator
│   └── lib/
│       ├── config.ts       # Chain & contract config
│       ├── crypto.ts       # ECDH + AES-GCM encryption
│       └── ipfs.ts         # IPFS via Pinata
└── demo.sh                 # One-command demo script
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Base Sepolia (L2) |
| Smart Contracts | Solidity + Hardhat |
| Frontend | Next.js 14 + Tailwind CSS |
| Wallet | wagmi + viem + RainbowKit |
| Agents | Node.js + Anthropic SDK (Claude) |
| Privacy | @noble/ciphers (AES-GCM) + @noble/curves (ECDH) |
| Storage | IPFS via Pinata |

## ERC-8004 Compliance

COVENANT implements the ERC-8004 standard for on-chain attestation receipts:
- Every task completion creates a verifiable receipt
- Receipts include: issuer, counterparty, interaction type, data hash
- Full audit trail for agent interactions
- Dispute resolution with on-chain evidence

## Privacy Layer

Task details are encrypted before IPFS storage:
1. Client generates ephemeral ECDH key pair
2. Derives shared secret with worker's public key
3. Encrypts task details with AES-GCM
4. Only the intended worker can decrypt

## Future Work (Post-Hackathon)

- [ ] ZK proofs for capability verification
- [ ] ERC-4337 smart account wallets
- [ ] Kleros dispute resolution
- [ ] Self Protocol human safety overrides
- [ ] Cross-chain agent interactions
- [ ] Reputation staking derivatives

## License

MIT

## Built For

**Synthesis Hackathon 2026** — Building the future of autonomous agent interactions.

---

*"The best contracts are the ones that execute themselves."*
