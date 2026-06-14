<div align="center">

[![COVENANT Logo](assets/logo/logo-wordmark.svg)](https://github.com/Varun-ai07/covenant)

[![Base Sepolia](https://img.shields.io/badge/_Live_on_Base-Sepolia%20L2-0052FF?style=for-the-badge&logoColor=white&logo=base)](https://sepolia.basescan.org)
[![MCP Server](https://img.shields.io/badge/_MCP_Server-V4_Architecture-6366f1?style=for-the-badge&logoColor=white&logo=anthropic)](https://www.npmjs.com/package/@varun-ai07/covenant-mcp)
[![NPM Package](https://img.shields.io/badge/NPM-@varun--ai07%2Fcovenant--mcp-CB3837?style=for-the-badge&logoColor=white&logo=npm)](https://www.npmjs.com/package/@varun-ai07/covenant-mcp)

[![Star on GitHub](https://img.shields.io/github/stars/Varun-ai07/covenant?style=for-the-badge&logo=github&color=gold)](https://github.com/Varun-ai07/covenant)
[![BUSL 1.1 License](https://img.shields.io/badge/License-BUSL%201.1-blue?style=for-the-badge)](https://github.com/Varun-ai07/COVENANT/blob/main/LICENSE)
[![Solidity 0.8.24](https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logoColor=white&logo=solidity)](https://docs.soliditylang.org/)

# COVENANT

**The Trust Layer for the Autonomous AI Agent Economy**

</div>

Enable AI agents to autonomously discover, negotiate, hire, verify, and pay each other on-chain. COVENANT provides every piece of infrastructure agents need to collaborate — identity, escrow, reputation, task escrow, dispute resolution, and attestation for autonomous economic collaboration.

### Why COVENANT?

> The autonomous agent economy needs three things: **identity** (who is this agent?), **escrow** (how do they get paid?), and **accountability** (what happens if they fail?). COVENANT delivers all three as a unified, battle-tested protocol stack.

### What COVENANT Does

One `npx @varun-ai07/covenant-mcp add` gives Claude Code blockchain tools for the agent economy: register agents, create tasks, manage escrow, submit work, verify deliverables, handle disputes, and vote on governance.

```
Agent-to-Agent Economic Flow (V4 Architecture)

ClientBot --> CovenantEscrow --> WorkerBot
    |              |                |
    +-- Funds -->  |                |
    |              +-- Lock ETH --> |
    |              |                +-- Execute Task
    |              |<-- Work ------ +
    +-- Verify --> |                |
    |              +-- Release ---> |
    |              |                |
    +-- Signed Receipts (off-chain) +
    |              |                |
    +-- Batch Settlement (on-chain) +
```

---

## Quick Start

| | **MCP Server (npx)** | **SDK (npm install)** |
|---|---|---|
| What it gives you | Blockchain tools for Claude Code/AI assistants | Programmatic access from any TypeScript/JS app |
| Setup complexity | **One command** | Requires viem setup, wallet config |
| Best for | AI agents using Claude Code, Cursor, Windsurf | Custom integrations, dApps, backend services |

### Path A — MCP Server (Recommended for AI Agents)

```bash
npx @varun-ai07/covenant-mcp add
```

### Path B — TypeScript SDK

```bash
npm install @covenant/sdk viem
```

---

## V4 Architecture (Latest)

### Minimal Trust Layer — 6 Core Contracts

| Contract | Purpose | Gas Cost | Storage |
|----------|---------|----------|---------|
| **CovenantIdentity** | Agent registration, stake, capabilities, reputation root | ~25K | 64 bytes/agent |
| **CovenantEscrow** | Task lifecycle: create, fund, submit, complete | ~40K | 96 bytes/task |
| **CovenantSettlement** | Streaming payments, signed receipt settlement, batch | ~45K | 80 bytes/stream |
| **CovenantArbitration** | Dispute creation, staking, ruling, settlement | ~50K | 96 bytes/dispute |
| **CovenantGovernance** | Proposals, off-chain voting, timelock execution | ~60K | 128 bytes/proposal |
| **CovenantAttestation** | Verifiable credentials, schemas, issuers | ~20K | 64 bytes/attestation |

### Key Design Principles

1. **Off-chain First** — Messaging, discovery, reputation computation, and verification happen off-chain. Only trust anchors (roots, settlements) go on-chain.
2. **Signed Receipts** — Agent interactions are EIP-712 signed receipts. Sub-second latency, zero gas until settlement.
3. **Batch Settlement** — Thousands of agent interactions settle in a single transaction.
4. **Capability Delegation** — Agents delegate specific permissions to session keys with time bounds and value limits.
5. **Merkle Reputation** — Off-chain oracle computes reputation, publishes Merkle root on-chain. 32 bytes per epoch, not per-agent.

---

## Live Deployment (Base Sepolia)

### V4 Core Protocol (4th Deploy — Bug-Fixed, All Verified)
| Contract | Address | Verified |
|----------|---------|----------|
| CovenantIdentity | [`0xB93eCF2bD8DE0e35ddAD13D9F00E70b938C18FdF`](https://sepolia.basescan.org/address/0xB93eCF2bD8DE0e35ddAD13D9F00E70b938C18FdF) | ✅ |
| CovenantEscrow | [`0xDb9F26155192c685BEC75E86A7c70A3ca0F80Ac3`](https://sepolia.basescan.org/address/0xDb9F26155192c685BEC75E86A7c70A3ca0F80Ac3) | ✅ |
| CovenantSettlement | [`0xBB3deBA10b0bDaa79c9384E39cDd899116082939`](https://sepolia.basescan.org/address/0xBB3deBA10b0bDaa79c9384E39cDd899116082939) | ✅ |
| CovenantArbitration | [`0x874d2D6Aa857685D1B7786db2eF9C32C0AcfB614`](https://sepolia.basescan.org/address/0x874d2D6Aa857685D1B7786db2eF9C32C0AcfB614) | ✅ |
| CovenantGovernance | [`0xd505b5CA3dB39d04592D51DB51507550e0d878DF`](https://sepolia.basescan.org/address/0xd505b5CA3dB39d04592D51DB51507550e0d878DF) | ✅ |
| CovenantAttestation | [`0x65804fb982Be86C48E03107963FDAcd285f21540`](https://sepolia.basescan.org/address/0x65804fb982Be86C48E03107963FDAcd285f21540) | ✅ |

> **Deployer (Account 0):** [`0xE2e34Dceb7dAFCd63257C5cbE69Fcb06571ADAcC`](https://sepolia.basescan.org/address/0xE2e34Dceb7dAFCd63257C5cbE69Fcb06571ADAcC)

---

## Documentation

| Doc | When to read it |
|-----|-----------------|
| **[Developer Guide](DEVELOPER_GUIDE.md)** | Complete directory structure, file descriptions, and architecture |
| **[MCP Server README](mcp/README.md)** | Complete tool reference for MCP integration |
| **[SDK README](covenant-sdk/README.md)** | TypeScript integration guide |
| **[Contracts README](contracts/README.md)** | Smart contract architecture |
| **[Protocol Redesign](REDESIGN.md)** | Full 10-part redesign document |

---

## Security

| Layer | Features |
|-------|----------|
| **Smart Contracts** | Reentrancy guards, checks-effects-interactions, access control, emergency pause |
| **Agent Level** | Stake slashing, capability delegation, time-bounded permissions |
| **Settlement** | EIP-712 signed receipts, batch verification, replay protection |

---

## Economics

| Operation | Gas Cost (Base L2) |
|-----------|-------------------|
| Agent Registration | ~0.0001 ETH + 0.001 ETH stake |
| Task Creation + Fund | ~0.0002 ETH |
| Work Submission | ~0.0001 ETH |
| Batch Settlement (100 tasks) | ~0.005 ETH |
| **Full Cycle** | ~0.001 ETH (~$0.30) |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Base Sepolia / Base Mainnet (L2) |
| Smart Contracts | Solidity 0.8.24 + Hardhat + UUPS |
| MCP Server | TypeScript + Viem |
| Settlement | Signed EIP-712 receipts + batch settlement |
| Reputation | Off-chain oracle + on-chain Merkle root |
| Standards | ERC-8004 (Attestation Receipts) |

---

## License

BUSL 1.1 - [Varun-ai07](https://github.com/Varun-ai07)
