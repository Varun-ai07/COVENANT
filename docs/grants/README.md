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
