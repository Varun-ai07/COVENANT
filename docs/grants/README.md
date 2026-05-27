# COVENANT Grant Applications

This directory contains grant application templates and submitted applications for COVENANT Protocol funding.

## Grant Opportunities

| Grant Program | Amount | Deadline | Status |
|---------------|--------|----------|--------|
| Base Grants | $5K - $50K | Rolling | Ready to apply |
| Ethereum Foundation | $10K - $100K | Rolling | Ready to apply |
| Optimism RetroPGF | $10K - $500K | Quarterly | Next round Q3 2026 |

## Application Templates

- `base-grants-application.md` — Base ecosystem grant template
- `ethereum-foundation-application.md` — EF ecosystem support template
- `optimism-retropgf-application.md` — Optimism RetroPGF template

## Eligibility Criteria

COVENANT qualifies for all three programs because:
- ✅ Open source (MIT license)
- ✅ Deployed on Base/Optimism L2
- ✅ Infrastructure for autonomous agents
- ✅ No token (yet) — pure public good
- ✅ Measurable on-chain metrics

## On-Chain Proof of Traction

Include these in every application:

```
Registered Agents: Query AgentRegistry.totalAgents()
Completed Tasks: Query TaskEscrow.taskCounter()
Protocol Fees Collected: Query TaskEscrow.accumulatedFees()
Total Value Transacted: Sum of all task payments
```

## Protocol Highlights

### Technology
- **124 MCP Tools** — Complete protocol access from Claude Code, Cursor, Windsurf
- **ERC-8004 DIDs** — On-chain agent identity with attestation receipts
- **Trustless Escrow** — Payment locked until verification, automatic release
- **Base L2** — Sub-cent gas fees, 2-second blocks
- **Deep Verification** — Off-chain AI verification with on-chain attestation
- **Free Revisions** — Up to 3 revision rounds per task

### Contracts Deployed (Base Sepolia)

#### Core Protocol
| Contract | Address |
|----------|---------|
| AgentRegistry | `0xB215589dA259A98eEE8BF39739F6255131ac33A1` |
| TaskEscrow | `0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3` |
| ReceiptVerifier | `0xa47D15099be6aC516B53a6859D468E9004eEf76b` |

#### Market & Batching
| Contract | Address |
|----------|---------|
| OpenTaskMarket | `0x5ccF09469222E5046b0830c6d71ed6B912bE70e6` |
| ParallelTaskBatch | `0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc` |

#### Collective & Insurance
| Contract | Address |
|----------|---------|
| AgentCollective | `0x0CDE9560D2E95338922c40A52A2c81cdd20613d1` |
| AgentInsurance | `0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55` |

#### Dispute Resolution
| Contract | Address |
|----------|---------|
| DisputeArbitration | `0x37A62C6eDd18461CCe00B6772Da8640C75DE740e` |

#### Verification & Enforcement
| Contract | Address |
|----------|---------|
| AutoVerifier | `0xad7A6453447d720b715E106F2e331fAcfb4B21d1` |
| MultiPartyReview | `0x8B1D433D1f744004c7E375e07143869FeA4482F1` |
| ClientReputation | `0x4de4694b5a509081949BA599e8AB9Fa9784188d9` |
| StakeSlashing | `0x3b56AB51e2D34d403aaB3D3F89c3Cee57DFFD946` |
| MilestoneVerification | `0x2aC422503988556645e7923E9CBCb2DB68d35CD7` |
| RevisionManager | `0x913d3486687544eA18057ca84C2D6b6bb1E01a65` |

### Infrastructure
- RPC caching (5min agents, 30sec tasks)
- Event indexing (15s poll, 1000 blocks/batch)
- IPFS gateway fallback (Pinata → ipfs.io → Cloudflare → dWeb)

## Grant Strategy

1. **Base Grants First** — Fastest path, strongest ecosystem fit
2. **Ethereum Foundation** — Broader credibility, larger amounts
3. **Optimism RetroPGF** — Largest potential, requires proven impact

## Using These Templates

```bash
# Copy template for your application
cp base-grants-application.md submissions/base-grants-2026-05.md

# Fill in the bracketed sections
# Add your on-chain metrics
# Submit via the program's portal
```
