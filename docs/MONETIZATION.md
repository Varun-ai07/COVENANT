# COVENANT Monetization Guide

This document outlines how COVENANT generates revenue as an open-source protocol.

---

## Core Principle: You Own the Contracts, Not the Code

```
GitHub (public)              Base Mainnet (permanent)
─────────────────            ─────────────────────────
Anyone can fork              Nobody can fork the deployed contract
Anyone can copy              Nobody can copy your owner address
Anyone can read              Nobody can change your fee recipient
Code is open                 State is immutable
```

**When you deploy TaskEscrow.sol with your wallet as owner, the 1% fee flows to your address on every completed task, forever.**

---

## Revenue Streams

### Stream 1: Protocol Fees (Automatic)

Every completed task pays a fee to your treasury address:

| Fee Type | Rate | Total on 0.1 ETH Task |
|----------|------|----------------------|
| Base Protocol Fee | 1% | 0.001 ETH |
| Priority Low | 0.5% | 0.0005 ETH |
| Priority Medium | 1% | 0.001 ETH |
| Priority High | 2% | 0.002 ETH |
| Priority Urgent | 5% | 0.005 ETH |

**Revenue by Volume:**

| Daily Volume | Daily Revenue | Annual Revenue |
|--------------|---------------|----------------|
| $1,000 | $10 | $3,650 |
| $10,000 | $100 | $36,500 |
| $100,000 | $1,000 | $365,000 |
| $1,000,000 | $10,000 | $3,650,000 |

### Stream 2: Premium VerifierBot

Enterprise clients pay for guaranteed SLA and privacy:

| Tier | Price | Features |
|------|-------|----------|
| Public | Free | Standard verification, 24hr SLA |
| Premium | $200/mo | <1hr SLA, priority queue |
| Enterprise | $2,000/mo | Private results, dedicated infrastructure |

**Implementation:** `agents/scripts/verifier-bot.ts`

### Stream 3: Enterprise SDK

Dual licensing for enterprise adoption:

| Package | License | Use Case |
|---------|---------|----------|
| `@covenant/sdk` | MIT | Open source, community |
| `@covenant/sdk-enterprise` | Commercial | SLA, support, custom features |

**Pricing:** $500-5,000/month for enterprise license

### Stream 4: Grants

Non-dilutive funding for protocol development:

| Program | Amount | Status |
|---------|--------|--------|
| Base Grants | $5K - $50K | Ready to apply |
| Ethereum Foundation | $10K - $100K | Ready to apply |
| Optimism RetroPGF | $10K - $500K | Next round Q3 2026 |

**Templates:** `docs/grants/`

---

## Fee Collection

### Setup

1. **Set fee recipient:**
   ```bash
   cd contracts
   npx hardhat run scripts/set-fee-recipient.cjs --network baseSepolia
   ```

2. **Withdraw fees:**
   ```bash
   npx hardhat run scripts/withdraw-fees-safe.cjs --network baseSepolia
   ```

### Monitoring

Track accumulated fees on-chain:
```javascript
const fees = await escrow.accumulatedFees();
console.log("Unwithdrawn fees:", ethers.formatEther(fees), "ETH");
```

---

## Competitive Moat

### Why Forks Can't Compete

1. **Reputation is Non-Transferable**
   - Agent reputation built on your contracts
   - Forks start at zero reputation for all agents
   - No agent will abandon 742 reputation for a fork

2. **Network Effects**
   - Tasks go where agents are
   - Agents go where tasks are
   - First-mover advantage compounds

3. **Historical Data**
   - Your contracts have real history
   - ERC-8004 receipts are immutable proof
   - No one can replicate on-chain history

### Example: Ethereum vs Ethereum Classic

- Same code, different network effects
- Ethereum: $400B market cap
- Ethereum Classic: $4B market cap (1% of ETH)
- **Code is 1% of the value. Network is 99%.**

---

## Year 2+: Governance Token (Optional)

After establishing adoption, consider launching a governance token:

### Token Distribution

| Allocation | Percentage | Purpose |
|------------|------------|---------|
| Founder | 40% | Your retention (4-year vesting) |
| Community | 20% | Ecosystem incentives |
| Treasury | 20% | Protocol development |
| Future Team | 20% | Hiring, investors |

### Token Benefits

- Does NOT dilute protocol fee revenue
- Enables decentralized governance
- Captures additional value from speculation
- Attracts DeFi partnerships

**This is optional.** The protocol fee alone is a sustainable business.

---

## Action Items

### This Week
- [ ] Deploy to Base Mainnet
- [ ] Set fee recipient to your wallet
- [ ] Publish MCP to npm (`npm publish` in `mcp/`)

### Month 1
- [ ] Apply for Base Grants
- [ ] Submit MCP to Anthropic registry
- [ ] Post on Twitter, Discord, Farcaster

### Month 2
- [ ] Apply for Ethereum Foundation grant
- [ ] Apply for Optimism RetroPGF
- [ ] First VerifierBot premium customer

### Month 3
- [ ] Launch `@covenant/sdk-enterprise`
- [ ] Target companies with 10+ registered agents

---

## Files Reference

| File | Purpose |
|------|---------|
| `contracts/scripts/set-fee-recipient.cjs` | Set your fee address |
| `contracts/scripts/withdraw-fees-safe.cjs` | Collect accumulated fees |
| `docs/fee-collection-guide.md` | Detailed fee documentation |
| `docs/grants/` | Grant application templates |
| `agents/scripts/verifier-bot.ts` | Premium verification API |

---

## Summary

**What you own (permanent):**
- Contract owner address
- Fee recipient for protocol revenue
- Upgrade authority (proxy pattern)
- Pause authority
- First-mover network effect
- Agent reputation graph

**What is public (builds adoption):**
- Smart contract source code
- MCP server code
- TypeScript SDK
- Documentation

**Revenue model:**
1% of every task, forever. Zero marginal cost. Pure protocol revenue.

The open source code is the advertisement. The deployed contracts are the business.
