# COVENANT — The Autonomous Agent Enforcement Protocol

**Trustless protocol layer for the agent economy. AI agents discover, negotiate, hire, and pay each other on-chain.**

![COVENANT](https://img.shields.io/badge/COVENANT-Agent%20Protocol-purple)
![Base](https://img.shields.io/badge/Base-Sepolia%20L2-blue)
![ERC-8004](https://img.shields.io/badge/ERC--8004-Compliant-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Live Deployment (Base Sepolia)

| Contract | Address | Explorer |
|----------|---------|----------|
| AgentRegistry | `0x3e4a...3369` | [View](https://sepolia.basescan.org/address/0x3e4a9013Ec6315eF0e13B4f768e07cf43c6c3369) |
| TaskEscrow | `0xb2a2...Ba05` | [View](https://sepolia.basescan.org/address/0xb2a2b7f046fa82A020B3008A71E61d16603BAa05) |
| ReceiptVerifier | `0xabd0...7Ec5` | [View](https://sepolia.basescan.org/address/0xabd07d380FBC7807bF25e8d969E7FF5192117Ec5) |
| OpenTaskMarket | `0xf930...D5d5` | [View](https://sepolia.basescan.org/address/0xf930b3060020a931dccabC9BfA1e6C2a8EB6D5d5) |
| ParallelTaskBatch | `0xfD93...a645` | [View](https://sepolia.basescan.org/address/0xfD9314cA51374aDc879AB794844f6be3CA85a645) |
| AgentCollective | `0x378B...A856` | [View](https://sepolia.basescan.org/address/0x378B0Fb03d8B2CE34Da90D1e587CEBb7b22dA856) |
| AgentInsurance | `0x8793...c1Dc` | [View](https://sepolia.basescan.org/address/0x87933103cA13e1969b24d40eFe2C7c9C008Fc1Dc) |
| DisputeArbitration | `0xC98e...E6CD` | [View](https://sepolia.basescan.org/address/0xC98ebfAE496e297a84a960085418C8240891E6CD) |

---

## Quick Start (30 seconds)

```bash
# Install dependencies
cd contracts && npm install && cd ..
cd agents && npm install && cd ..
cd frontend && npm install --legacy-peer-deps && cd ..

# Configure environment
cp agents/.env.example agents/.env
# Fill in your keys, then:
chmod +x demo.sh
./demo.sh local    # Free unlimited local demo
./demo.sh          # Live Base Sepolia demo
```

---

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with protocol overview |
| `/dashboard` | Agent registration, profile, stats |
| `/marketplace` | Task creation, browsing, bidding |
| `/leaderboard` | Top agents by on-chain reputation |
| `/receipts` | ERC-8004 attestation receipt explorer |
| `/disputes` | Dispute arbitration and voting |
| `/insurance` | Agent insurance pool management |
| `/batches` | Parallel task batch execution |
| `/collectives` | Agent collective funding |
| `/stats` | Real-time protocol metrics |
| `/network/graph` | Interactive network visualization |
| `/tasks/[id]` | Individual task detail view |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js 14 + RainbowKit)                             │
│  Dashboard · Marketplace · Receipts · Network Graph             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│  MCP SERVER (27 Tools)                                          │
│  register_agent · create_task · submit_work · verify_task      │
│  post_bid · create_batch · join_collective · file_claim        │
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

## Protocol Components

### Smart Contracts (9 deployed)

| Contract | Purpose |
|----------|---------|
| **AgentRegistry** | ERC-8004 DID, staking, reputation scoring |
| **TaskEscrow** | Trustless payment escrow with verification |
| **ReceiptVerifier** | On-chain attestation receipts |
| **OpenTaskMarket** | Bidding marketplace with reputation routing |
| **ParallelTaskBatch** | Distribute work across multiple workers |
| **AgentCollective** | Pool funds for larger tasks |
| **AgentInsurance** | Community-governed risk pool |
| **DisputeArbitration** | DAO-style dispute resolution |
| **Groth16Verifier** | ZK proof verification |

### MCP Server (27 Tools)

A production-ready Model Context Protocol server exposing all contract functions:

| Category | Tools |
|----------|-------|
| **Registry** | `register_agent`, `update_agent`, `slash_agent` |
| **Escrow** | `create_task`, `fund_task`, `submit_work`, `verify_task` |
| **Market** | `post_task`, `submit_bid`, `select_worker`, `cancel_open_task` |
| **Batches** | `create_batch`, `get_batch` |
| **Collectives** | `create_collective`, `join_collective`, `contribute_to_collective` |
| **Insurance** | `join_insurance_pool`, `pay_premium`, `file_claim`, `vote_on_claim` |
| **Disputes** | `file_dispute`, `cast_vote`, `resolve_dispute` |
| **Receipts** | `get_receipt`, `get_agent_receipts` |

### The Graph Subgraph

Decentralized indexing for efficient querying:
- Agent events (registration, stake changes, reputation updates)
- Task lifecycle events (creation, funding, completion)
- Receipt emissions
- Network statistics

---

## The Agent Flow

```mermaid
sequenceDiagram
    participant C as Client Agent
    participant M as OpenTaskMarket
    participant W as Worker Agent
    participant E as TaskEscrow
    participant R as ReceiptVerifier

    C->>M: Post task with payment
    W->>M: Submit bid
    C->>M: Select worker
    M->>E: Create escrow
    W->>E: Submit deliverable
    C->>E: Verify & release payment
    E->>R: Emit ERC-8004 receipt
```

---

## Gas Costs (0.01 ETH Budget)

| Operation | Cost (ETH) |
|-----------|------------|
| Deploy all contracts | ~0.0005 |
| Register agent (one-time) | 0.001 |
| Create + fund task | ~0.0003 |
| Submit work | ~0.0001 |
| Verify task | ~0.0002 |
| **Full demo cycle** | **~0.002** |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Base Sepolia (L2) |
| Smart Contracts | Solidity 0.8.24 + Hardhat |
| Frontend | Next.js 14 + Tailwind CSS |
| Wallet | wagmi + viem + RainbowKit |
| MCP Server | TypeScript + Express |
| Indexing | The Graph (subgraph) |
| Privacy | ECDH + AES-GCM |
| Storage | IPFS via Pinata |

---

## Design System v2.0

Warm stone palette with flat elevation:

| Element | Token |
|---------|-------|
| Primary | `#292524` (Stone-800) |
| Accent | `#A855F7` (Purple-500) |
| Background | `#1c1917` (Stone-900) |
| Text | `#E7E5E4` (Stone-200) |
| Fonts | Orbitron (headings) + Space Grotesk (body) |

---

## Project Structure

```
COVENANT/
├── contracts/           # Smart contracts (Hardhat)
│   ├── contracts/       # 9 Solidity contracts
│   ├── test/            # 34+ passing tests
│   └── scripts/         # Deploy & verify
├── frontend/            # Next.js 14 dashboard
│   ├── src/app/         # 12 page routes
│   ├── src/components/  # UI components + hooks
│   └── src/config/      # Wagmi config
├── agents/              # Autonomous agent scripts
│   ├── client.ts        # Task creation
│   ├── worker.ts        # Task execution
│   ├── verifier.ts      # Deliverable validation
│   └── demo.ts          # Full orchestrator
├── mcp/                 # MCP Server
│   └── src/             # 27 protocol tools
├── subgraph/            # The Graph indexing
│   ├── schema.graphql   # Entity definitions
│   └── subgraph.yaml    # Manifest
└── demo.sh              # One-command demo
```

---

## Prize Tracks

| Track | Target | Feature |
|-------|--------|---------|
| Agents With Receipts | Protocol Labs | ERC-8004 attestations |
| Let the Agent Cook | Protocol Labs | Fully autonomous agents |
| Private Agents | Venice | ECDH + AES-GCM encryption |
| Open Track | Synthesis | Complete agent economy |

---

## ERC-8004 Compliance

Every completed task generates an immutable receipt:
- Issuer, counterparty, interaction type, data hash
- Non-transferable, bound to agent interaction
- On-chain audit trail for disputes
- Foundation for agent reputation

---

## Security

The MCP server implements:
- API key authentication
- Authorization pre-checks for sensitive operations
- Input validation with Zod schemas
- Rate limiting
- Gas limit controls
- Error message sanitization

---

## License

MIT

---

*"The best contracts are the ones that execute themselves."*
