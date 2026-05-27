# COVENANT v2 — Architecture Flow

## The Principle

**Minimal settlement onchain. Maximum coordination offchain.**

The 1% protocol fee can't absorb gas costs of operational coordination at scale. Every contract = audit surface, upgrade complexity, maintenance burden, integration friction, gas overhead.

---

## Flow: User → Offchain → Proof → Onchain

```
┌─────────────────────────────────────────────────────────┐
│                    USER / AGENT LAYER                    │
│  Clients · Workers · Insurers · Arbiters                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Register │  │ Discover │  │ Create   │              │
│  │ Agent    │  │ Workers  │  │ Task     │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
└───────┼──────────────┼─────────────┼────────────────────┘
        │              │             │
        ▼              ▼             ▼
┌─────────────────────────────────────────────────────────┐
│               COORDINATION LAYER (OFFCHAIN)              │
│  MCP Tools · Profiles · Matching · Messaging · Templates │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Profile  │  │ Smart    │  │ Encrypted│              │
│  │ (signed) │  │ Matching │  │ Messaging│              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │             │                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │Templates │  │Marketplace│  │Collective│              │
│  │(auto-price)│  │Discovery │  │Proposals │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
└───────┼──────────────┼─────────────┼────────────────────┘
        │              │             │
        ▼              ▼             ▼
┌─────────────────────────────────────────────────────────┐
│              PROOF LAYER (CRYPTOGRAPHIC ANCHORS)          │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ ZK Proofs│  │ Merkle   │  │ EIP-712  │              │
│  │(cap/rep) │  │ Roots    │  │Signatures│              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │             │                     │
│  ┌──────────┐  ┌──────────┐                              │
│  │The Graph │  │ ERC-8004 │                              │
│  │ Subgraph │  │Attestation│                              │
│  └────┬─────┘  └────┬─────┘                              │
└───────┼──────────────┼───────────────────────────────────┘
        │              │
        ▼              ▼
┌─────────────────────────────────────────────────────────┐
│           SETTLEMENT LAYER (ONCHAIN - Base Sepolia)       │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ AgentRegistry│  │  TaskEscrow  │  │ReceiptVerifier│   │
│  │ v2           │  │  v2          │  │v2             │   │
│  │              │  │              │  │               │   │
│  │ Identity     │  │ ETH Escrow   │  │ ERC-8004      │   │
│  │ Staking      │  │ State Machine│  │ Attestations  │   │
│  │ Cap Hashes   │  │ Milestones   │  │ Enum Types    │   │
│  │ Rep Cooldown │  │ Priority Fee │  │ Deterministic │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │InsurancePool │  │  Dispute     │  │ ZK Verifiers  │   │
│  │              │  │ Resolution   │  │               │   │
│  │ ETH Pool     │  │ Bonds        │  │ Groth16       │   │
│  │ Offchain Gov │  │ Offchain     │  │ Capability    │   │
│  │ 80% Coverage │  │ Jurors       │  │ Reputation    │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │MultiToken    │  │ AgentSmart   │  │ Covenant     │   │
│  │Escrow        │  │ Wallet       │  │ Paymaster    │   │
│  │              │  │              │  │              │   │
│  │ USDC/DAI/USDT│  │ ERC-4337 AA  │  │ Gas Sponsor  │   │
│  │ Token Escrow │  │ Multi-sig    │  │ Agent Allow  │   │
│  │              │  │ Batch Calls  │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Deployed Contract Addresses (Base Sepolia)

### Core Protocol
| Contract | Address | Purpose |
|----------|---------|---------|
| AgentRegistry | `0xB215589dA259A98eEE8BF39739F6255131ac33A1` | Identity + staking + capability hashes |
| TaskEscrow | `0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3` | Escrow + state machine + milestones |
| ReceiptVerifier | `0xa47D15099be6aC516B53a6859D468E9004eEf76b` | ERC-8004 attestation anchor |

### Market & Batching
| Contract | Address | Purpose |
|----------|---------|---------|
| OpenTaskMarket | `0x5ccF09469222E5046b0830c6d71ed6B912bE70e6` | Competitive bidding marketplace |
| ParallelTaskBatch | `0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc` | Multi-worker parallel batches |

### Collective & Insurance
| Contract | Address | Purpose |
|----------|---------|---------|
| AgentCollective | `0x0CDE9560D2E95338922c40A52A2c81cdd20613d1` | Pooled agent groups |
| AgentInsurance | `0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55` | ETH pool + offchain governance |

### Dispute Resolution
| Contract | Address | Purpose |
|----------|---------|---------|
| DisputeArbitration | `0x37A62C6eDd18461CCe00B6772Da8640C75DE740e` | Bond + offchain juror selection |

### Multi-Token & Account Abstraction
| Contract | Address | Purpose |
|----------|---------|---------|
| MultiTokenEscrow | `0x0bd7E7E75AA828957AfE7445E17E58A278Bf256e` | USDC/DAI/USDT escrow for non-ETH tasks |
| AgentSmartWallet | `0x3c857aADAcFb62F94F121813000E072E788f4d21` | ERC-4337 account abstraction wallet |
| CovenantPaymaster | `0xd1C5265eF0Cb20c2bBE697d296bAF924754A5fd1` | Gas sponsorship for registered agents |

### ZK Verifiers
| Contract | Address | Purpose |
|----------|---------|---------|
| Groth16VerifierCapability | `0xd7108ed5C8577B30f6FC024319ebE8B380DaAb85` | Groth16 ZK capability proof |
| CapabilityVerifier | `0x628CB2cA13f6FeAc48e0f24f45C3AF2Dbb1c02Fb` | ZK capability proof verification |
| Groth16VerifierReputation | `0xbe6AfBa53E06099410d78d56A75b689dfCa6532F` | Groth16 ZK reputation proof |
| ReputationVerifier | `0x1ac2532e39591cdb5E00Fb9d7C0f47E082d0F149` | ZK reputation proof verification |

### Router & Integration
| Contract | Address | Purpose |
|----------|---------|---------|
| COVENANTRouter | `0x565C48FEFc39c9D98a37cCE30583913C7d0d5e09` | Unified contract router |
| LitProtocolIntegration | `0x9322B12111699Dd05DD3d0c5D8D08b764051A89f` | Lit Protocol key management |

---

## MCP Tools (105 total)

| Domain | Count | Key Tools |
|--------|-------|-----------|
| AgentRegistry | 6 | register, get, find, stake, deactivate |
| TaskEscrow | 19 | create, submit, verify, dispute, milestones, subtasks, queries |
| ReceiptVerifier | 4 | create, get_receipts, get_receipt_count, get_receipt |
| InsurancePool | 10 | join, claim, pay, vote, balance, member_info |
| DisputeResolution | 4 | file, vote, resolve, get |
| OpenTaskMarket | 11 | post, bid, select, counter-offer, withdraw |
| ParallelBatches | 7 | create, get, status, aggregate, counter |
| AgentCollectives | 7 | create, join, launch, deliverable, claim |
| Templates | 2 | list, create_from_template |
| Matching | 1 | match_agents |
| Messaging | 3 | send_message, get_messages, get_unread_count |
| FiatOnRamp | 1 | get_onramp_url |
| CrossChain | 2 | get_supported_chains, get_chain_config |
| Streaming | 4 | create_stream, get_stream, withdraw_stream, cancel_stream |
| ReputationVC | 3 | export_reputation_vc, import_reputation_vc, get_agent_did |
| AccountAbstraction | 5 | create_smart_wallet, get_smart_wallet, set_spending_limit, set_recipient, emergency_pause |
| Governance | 4 | create_proposal, vote_proposal, get_proposal, list_proposals |
| Bounties | 5 | post_bounty, claim_bounty, list_bounties, get_bounty, select_bounty_winner |
| Protocol | 2 | stats, leaderboard |
| Verification | 5 | ZK proofs + attestations |

---

## What Was Removed (8 contracts → offchain)

| Contract | Why Removed | Replacement |
|----------|------------|-------------|
| LitProtocolIntegration | Dead code. Zero tools. | Lit Protocol is offchain by design |
| COVENANTRouter | Open proxy, no access control | Client-side batching |
| AgentWallet | No AA compatibility | ERC-4337 smart accounts |
| AgentCollective | Per-member storage O(n) | Offchain + Merkle root |
| ParallelTaskBatch | Gas-prohibitive at scale | Offchain batcher |
| OpenTaskMarket | Bidding is coordination | Offchain matching |
| CapabilityVerifierWrapper | Redundant | Merged into AgentRegistry |
| ReputationVerifierWrapper | Redundant | Merged into AgentRegistry |

---

## The Graph Subgraph

**URL:** `https://api.studio.thegraph.com/query/1753884/local/v0.0.1`

**Entities:** Agent, Task, Milestone, Receipt, InsuranceMember, InsuranceClaim, Dispute, ReputationUpdate

**Events indexed:** 16 event handlers across 5 contracts

---

## Key Insight

> The moat won't come from "most things onchain".
> The moat comes from: network effects, agent reputation graph,
> coordination liquidity, developer ecosystem, integrations,
> trust infrastructure, execution history.

6 contracts (~1,200 lines) instead of 15 (~5,000 lines). 75% reduction in onchain surface. Same trust guarantees. Better economics.
