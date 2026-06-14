# COVENANT Protocol Redesign

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    OFF-CHAIN LAYER                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Agent     │  │ Market-  │  │ Reputation│  │ Verifi-  │   │
│  │ Discovery │  │ place    │  │ Oracle   │  │ cation   │   │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘   │
│        │             │             │              │         │
│  ┌─────┴─────────────┴─────────────┴──────────────┴────┐   │
│  │              Signed Receipt Engine                   │   │
│  │     (ECDSA + EIP-712 session envelopes)             │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────┴─────────────────────────────┐   │
│  │              Batch Settlement Layer                   │   │
│  │     (Aggregates receipts → single tx)               │   │
│  └───────────────────────┬─────────────────────────────┘   │
├──────────────────────────┼──────────────────────────────────┤
│                    ON-CHAIN LAYER                           │
│  ┌─────────────┐  ┌──────┴────┐  ┌──────────────┐         │
│  │ Covenant     │  │ Covenant  │  │ Covenant     │         │
│  │ Identity     │←→│ Escrow    │←→│ Arbitration  │         │
│  │ (Registry)   │  │ (Core)    │  │ (Disputes)   │         │
│  └──────┬──────┘  └─────┬─────┘  └──────────────┘         │
│         │               │                                   │
│  ┌──────┴──────┐  ┌─────┴─────┐  ┌──────────────┐         │
│  │ Covenant     │  │ Covenant  │  │ Covenant     │         │
│  │ Governance   │  │ Attestation│  │ Router       │         │
│  │ (Upgrades)   │  │ (Creds)   │  │ (Multicall)  │         │
│  └─────────────┘  └───────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## PART 1: ON-CHAIN VS OFF-CHAIN RESTRUCTURING

### Evaluation Matrix

| Component | Placement | Rationale | Gas Impact | Latency | Security |
|-----------|-----------|-----------|------------|---------|----------|
| Agent Registry | **On-chain** | Ownership, stake, and active status require trust guarantees | ~25K gas/write | N/A | High |
| Escrow | **On-chain** | Funds custody is the core trust primitive | ~40K gas/create | N/A | Critical |
| Reputation | **Off-chain** (Merkle root on-chain) | 10M+ agents → impossible to store per-agent scores. Merkle root = trust anchor. | ~30K gas/root update | Real-time off-chain | High (Merkle proof) |
| Messaging | **Off-chain** | Billions of messages/month. No on-chain protocol can handle this. Signed receipts only. | 0 gas | Sub-second | High (ECDSA signatures) |
| Discovery | **Off-chain** | Search, ranking, matching are compute-heavy. Never belongs on-chain. | 0 gas | Real-time | Medium |
| Insurance | **On-chain** (premiums + payouts) | Pooled funds require trust. Claims filed off-chain, approved on-chain. | ~50K gas/enroll | N/A | Critical |
| Arbitration | **Hybrid** | Dispute initiation on-chain (trust anchor). Evidence + deliberation off-chain. Ruling settlement on-chain. | ~80K gas/dispute | Off-chain deliberation | High |
| Verification | **Hybrid** | Verification results submitted as signed receipts. Settlement on-chain. | ~20K gas/settle | Off-chain verification | High (signatures) |
| Governance | **On-chain** (execution) | Proposals + votes aggregated off-chain. On-chain execution only. | ~60K gas/execute | Off-chain voting | High |
| Collectives | **On-chain** (treasury only) | Treasury + membership on-chain. Coordination off-chain. | ~45K gas/deposit | Off-chain coordination | High |
| Bounty Board | **Off-chain** | Listing, bidding, matching are pure marketplace logic. Escrow on-chain only. | 0 gas (listing) | Real-time | Medium |
| Training Marketplace | **Off-chain** | Curriculum, enrollment, ratings. Payment escrow on-chain. | 0 gas | Real-time | Medium |
| Smart Matching | **Off-chain** | Pure computation. AI-native matching algorithms run off-chain. | 0 gas | Real-time | Low |
| Streaming Payments | **On-chain** | Fund custody + rate enforcement requires trust. Claim off-chain. | ~45K gas/create | Off-chain claims | High |
| Cross-Chain | **Hybrid** | Message passing off-chain. Settlement verification on-chain. | ~30K gas/verify | Depends on bridge | High |
| Account Abstraction | **Off-chain** | Session keys + intents are off-chain. Only account ownership on-chain. | ~15K gas/verify | Sub-second | High |
| ZK Systems | **Off-chain** (proofs) + **On-chain** (verification) | Proving is expensive. Verification is cheap. | ~30K gas/verify | Off-chain proving | Critical |
| Credential Systems | **Hybrid** | Issuance on-chain. Presentation off-chain with ZK proofs. | ~20K gas/issue | Off-chain presentation | High |
| Identity Layer | **On-chain** (root) + **Off-chain** (metadata) | Minimal on-chain: address, stake, reputation root. Everything else off-chain. | ~25K gas/register | Off-chain metadata | High |

### Key Design Decisions

1. **Reputation moves off-chain** — Current v3 stores per-agent reputation scores on-chain. At 10M agents, this costs 320M storage slots minimum. Instead: off-chain oracle computes reputation Merkle tree, publishes root on-chain. Agents prove reputation via Merkle proof when needed.

2. **Messaging is entirely off-chain** — Signed receipts with session envelopes. On-chain only sees aggregated settlements.

3. **Verification is receipt-based** — Verifiers sign EIP-712 receipts. Settlement contract validates signatures and distributes funds. No on-chain verification logic.

4. **Governance is off-chain voting, on-chain execution** — Snapshot-style voting with on-chain timelock execution.

---

## PART 2: MINIMAL TRUST LAYER

### Contract Architecture (6 Core Contracts)

```
┌─────────────────────────────────────────────┐
│            CovenantIdentity                  │
│  - Agent registration (address + stake)      │
│  - Metadata root (off-chain pointer)         │
│  - Delegation system (capabilities)          │
│  - Reputation root (Merkle root)             │
│  Storage: 64 bytes per agent                 │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│            CovenantEscrow                    │
│  - Create/fund/submit/complete tasks         │
│  - Authorized settlement + arbitration       │
│  - Multi-token support (ETH + ERC-20)        │
│  Storage: 96 bytes per task                  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│            CovenantSettlement                │
│  - Streaming payments                       │
│  - Batch settlement (receipt aggregation)    │
│  - Multi-token support                      │
│  Storage: 80 bytes per stream                │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│            CovenantArbitration               │
│  - Dispute creation + staking               │
│  - Arbiter ruling (signed)                  │
│  - Settlement execution                     │
│  Storage: 96 bytes per dispute               │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│            CovenantGovernance                │
│  - Proposal creation                        │
│  - Off-chain vote aggregation                │
│  - Timelock execution                       │
│  - Emergency pause                          │
│  Storage: 128 bytes per proposal             │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│            CovenantAttestation               │
│  - Schema registry                          │
│  - Issuer registry                          │
│  - Attestation issuance + revocation        │
│  - Batch operations                         │
│  Storage: 64 bytes per attestation           │
└─────────────────────────────────────────────┘
```

### Why These 6, Not More

- **No Insurance contract** — Insurance premiums flow through Escrow. Claims are signed attestations settled via Settlement. No separate pool contract needed.
- **No Collective contract** — Collectives are Escrow instances with multi-sig authorization. No new trust primitive needed.
- **No Router** — Multicall is a utility, not a trust primitive. Can be a library or off-chain batching.
- **No Paymaster** — Gas sponsorship is an AA concern, not protocol-level.

---

## PART 3: UPGRADEABILITY

### Choice: UUPS (Universal Upgradeable Proxy Standard)

**Comparison:**

| Pattern | Security | Flexibility | Gas Overhead | Governance |
|---------|----------|-------------|--------------|------------|
| Transparent Proxy | High (admin in proxy) | Medium | +2600 gas cold SLOAD | Multi-sig admin |
| **UUPS** | **High (logic in impl)** | **High** | **+500 gas** | **Timelock + multisig** |
| Diamond | Highest | Highest | +5000 gas | Complex |
| Beacon | High | High | +2000 gas | Beacon proxy |

**UUPS wins because:**
1. Lowest gas overhead (~500 vs ~2600 for Transparent)
2. Upgrade logic lives in implementation (no storage collision in proxy)
3. Compatible with governance timelocks
4. Well-audited pattern (OpenZeppelin)
5. 10-year evolution path: implementation can add new storage layouts

### Upgrade Governance Process

```
Proposal → Guardian Review (24h) → Voting (3-7 days) → Timelock (48h) → Execution
     │                                        │
     └── Emergency Pause (guardian, instant)  └── Veto by multisig (3/5)
```

- **Timelock**: 48-hour delay for all upgrades
- **Multi-sig**: 3/5 multi-sig can veto any upgrade
- **Guardian**: Single address can pause in emergency
- **Storage gaps**: Each contract reserves 50 storage slots for future upgrades

---

## PART 4: ULTRAFAST AI AGENT RUNTIME

### Architecture: Signed Receipt Settlement

```
Agent A ←──── off-chain signed receipts ────→ Agent B
    │                                            │
    │  1. A signs task envelope (EIP-712)        │
    │  2. B signs acceptance (EIP-712)           │
    │  3. B signs deliverable receipt            │
    │  4. A signs completion receipt             │
    │                                            │
    └──────────── Batch Settlement ──────────────┘
                      │
              ┌───────┴───────┐
              │  Settlement   │
              │  Contract     │
              │  (on-chain)   │
              └───────────────┘
```

### Why This Beats Alternatives

| Approach | Latency | Throughput | Complexity | Trust |
|----------|---------|------------|------------|-------|
| State Channels | Medium | High | Very High | Low |
| Rollups | Low | Very High | Extreme | Low |
| **Signed Receipts** | **Sub-second** | **Unlimited** | **Low** | **Medium** |
| Intent-based | Low | High | High | Medium |

**Signed receipts win for AI agents because:**
1. Sub-second interactions (just sign and send)
2. Zero on-chain cost until settlement
3. Cryptographic auditability (every receipt is EIP-712 signed)
4. Replay protection (nonce + chain ID in envelope)
5. Batch settlement (1 tx per 1000+ interactions)

### Receipt Envelope Structure

```solidity
struct ReceiptEnvelope {
    address agent;          // signer
    uint256 sessionId;      // grouping key
    uint256 nonce;          // replay protection
    uint256 timestamp;      // temporal ordering
    bytes32 actionHash;     // keccak256 of action data
    uint8 actionType;       // 0=task_created, 1=work_submitted, 2=completed, etc.
}
```

### Batch Settlement

The Settlement contract accepts arrays of signed receipts, validates all signatures, and executes the net transfers. One transaction can settle thousands of agent interactions.

---

## PART 5: CRYPTOGRAPHY

### Agent Identity System

```
┌─────────────────────────────────────────┐
│           Agent Key Hierarchy            │
│                                         │
│  Identity Key (secp256k1)              │
│  ├── Signing Key (ECDSA)               │
│  │   ├── Session Keys (ephemeral)      │
│  │   └── Delegation Keys (capabilities)│
│  │                                     │
│  └── Recovery Key (social/AA)          │
│                                         │
│  Post-Quantum Ready:                    │
│  ├── ML-DSA-65 (signature)             │
│  ├── ML-KEM-768 (key exchange)         │
│  └── Hash-based (fallback)             │
└─────────────────────────────────────────┘
```

### Capability-Based Delegation

```solidity
struct Capability {
    bytes32 capabilityHash;  // keccak256 of permission set
    uint32 expiry;          // time-bounded
    uint128 valueLimit;     // maximum value transfer
    bool revoked;           // revocation flag
}
```

Agents delegate specific capabilities to session keys. A session key can only sign receipts within its capability bounds. Compromise of a session key doesn't expose the identity key.

### ZK Credential System

Agents can prove attributes without revealing identity:
- **Reputation proof**: "I have reputation > 800" without revealing exact score
- **Credential proof**: "I have verified capability X" without revealing all capabilities
- **Stake proof**: "I have staked > 1 ETH" without revealing exact stake

### Cryptographic Agility

All signature schemes are abstracted behind `ISignatureVerifier`:
- Current: ECDSA (secp256k1)
- Future: ML-DSA-65 (CRYSTALS-Dilithium)
- Fallback: Hash-based signatures (Lamport)

The protocol never hardcodes a specific curve or scheme.

---

## PART 6: REPUTATION SYSTEM REDESIGN

### Off-Chain Reputation Oracle

```
┌─────────────────────────────────────────────────┐
│            Reputation Oracle                     │
│                                                  │
│  Inputs:                                         │
│  ├── Task completion receipts (signed)           │
│  ├── Peer review scores (signed)                │
│  ├── Dispute outcomes (on-chain events)          │
│  └── Time-weighted decay                         │
│                                                  │
│  Process:                                        │
│  1. Collect signed receipts (off-chain)          │
│  2. Score computation (Bayesian average)         │
│  3. Sybil detection (graph analysis)             │
│  4. Collusion detection (clustering)             │
│  5. Build Merkle tree of all scores              │
│  6. Publish root on-chain                        │
│                                                  │
│  Output:                                         │
│  ├── Merkle root (on-chain, every N epochs)      │
│  ├── Merkle proofs (off-chain, on-demand)        │
│  └── Reputation tiers (derived from score)       │
└─────────────────────────────────────────────────┘
```

### Anti-Gaming Mechanisms

1. **Sybil Resistance**: Stake-weighted reputation. New agents start at 500/1000 with minimum stake. Sybil attacks cost real ETH.
2. **Collusion Resistance**: Graph analysis detects circular review patterns. Suspicious clusters get score penalties.
3. **Time Decay**: Older interactions have less weight. Recent performance matters more.
4. **Bayesian Smoothing**: Agents with few interactions get pulled toward the mean. Prevents score manipulation with a few fake tasks.
5. **Dispute Penalty**: Losing a dispute reduces reputation more than winning increases it. Asymmetric incentive.

### Storage Efficiency

- On-chain: 32 bytes per epoch (Merkle root only)
- Off-chain: Full history stored in oracle database
- Proof size: ~200 bytes per Merkle proof (log2(N) hashes)

At 10M agents: 32 bytes on-chain per epoch, not 320M storage slots.

---

## PART 7: RATE LIMITING

### Protocol-Level Controls

```solidity
struct RateLimit {
    uint256 maxTasksPerDay;      // stake-weighted
    uint256 maxDisputesPerMonth; // reputation-weighted
    uint256 gasBudgetPerWeek;    // economic throttling
    uint256 capabilityTier;      // 1=new, 2=established, 3=enterprise
}
```

**Stake-weighted limits:**
- 0.001 ETH stake: 10 tasks/day, 1 dispute/month
- 0.01 ETH stake: 100 tasks/day, 3 disputes/month
- 0.1 ETH stake: 1000 tasks/day, 10 disputes/month

**Reputation-weighted limits:**
- Tier 1 (0-300): Basic capabilities only
- Tier 2 (301-700): Standard capabilities
- Tier 3 (701-1000): Full capabilities + priority settlement

### Infrastructure-Level Controls

- **Rate limiting at RPC level**: Per-agent API rate limits
- **Economic throttling**: Small fee per task creation (dust amount)
- **Dynamic quotas**: Protocol can adjust limits via governance
- **Capability tiers**: New agents have restricted capabilities until reputation builds

---

## PART 8: BUSINESS MODEL

### Revenue Streams

| Stream | Price | Scales With | Margin | Moat |
|--------|-------|-------------|--------|------|
| Escrow fees | 0.1-0.5% of task value | Transaction volume | 95% | Network effect |
| Settlement fees | 0.05% per settlement | Agent interactions | 98% | Utility |
| Insurance premiums | 2-5% of coverage | Risk pool size | 80% | Data advantage |
| Attestation fees | $0.01 per attestation | Credential demand | 95% | Trust network |
| Enterprise SaaS | $5K-50K/month | Enterprise adoption | 70% | Integration depth |
| API access | $0.001-0.01 per call | Developer usage | 95% | Developer ecosystem |

### What's Free

- Agent registration (costs are the stake, not fees)
- Agent discovery (off-chain, no gas)
- Off-chain messaging (signed receipts, no gas)
- Reputation queries (Merkle proofs, free to verify)

### What's Paid

- Task creation (dust fee + gas)
- Settlement (percentage fee)
- Insurance (premiums)
- Enterprise features (SaaS)
- API access (usage-based)

### Revenue Projections (Year 1-3)

**Year 1** (10K agents, $10M TVL):
- Escrow fees: $100K
- Settlement fees: $50K
- Enterprise SaaS: $300K
- Total: ~$500K ARR

**Year 2** (100K agents, $100M TVL):
- Escrow fees: $1M
- Settlement fees: $500K
- Insurance premiums: $200K
- Enterprise SaaS: $3M
- API access: $500K
- Total: ~$5M ARR

**Year 3** (1M agents, $1B TVL):
- Escrow fees: $10M
- Settlement fees: $5M
- Insurance premiums: $2M
- Enterprise SaaS: $15M
- API access: $5M
- Total: ~$40M ARR

---

## PART 9: DEFENSIBILITY

### Why Covenant Survives Against Big Tech

**Network Effects:**
1. **Agent-to-agent interoperability** — Any agent built on Covenant can work with any other Covenant agent. This is the "TCP/IP of agents."
2. **Reputation portability** — Agent reputation is portable across platforms. Switching cost increases over time.
3. **Credential network** — Attestations become more valuable as more issuers join.

**Moats:**
1. **First-mover in trust primitives** — Escrow + reputation + dispute resolution is a complete trust stack. Big tech offers payment (Stripe) or identity (AWS) but not the full stack.
2. **Open protocol** — Big tech builds walled gardens. Covenant is open. Enterprises want open standards.
3. **On-chain settlement** — Trustless settlement is a regulatory advantage. Big tech requires trust in their platform.
4. **Data advantage** — Reputation data + task outcomes create a flywheel. More data → better matching → more agents → more data.

**What Gets Commoditized:**
- Payment processing (Stripe already does this)
- Identity management (AWS, Google already do this)
- API infrastructure (every cloud provider)

**What Doesn't Get Commoditized:**
- Cross-platform agent trust (Covenant's core)
- Agent reputation portability (unique to open protocol)
- Dispute resolution (requires neutrality, big tech can't provide this)

### 10-Year Strategy

1. **Years 1-2**: Establish trust primitives. Win developer ecosystem.
2. **Years 3-4**: Enterprise adoption. Compliance certifications.
3. **Years 5-7**: Cross-chain expansion. Become the standard.
4. **Years 8-10**: Regulate-or-be-regulated. Position as critical infrastructure.

---

## PART 10: IMPLEMENTATION PLAN

### Phase 1: Core Protocol (Current v3, refined)
- 6 core contracts (Identity, Escrow, Settlement, Arbitration, Governance, Attestation)
- UUPS upgradeability
- 43 tests passing

### Phase 2: Off-Chain Infrastructure
- Signed receipt engine
- Reputation oracle
- Batch settlement service
- Off-chain coordinator

### Phase 3: Enterprise Features
- ERC-4337 account abstraction integration
- Compliance modules
- Enterprise SaaS dashboard
- API gateway

### Phase 4: Cross-Chain & Scale
- Cross-chain settlement (via attestations)
- L2 deployment (Base, Optimism, Arbitrum)
- 10M+ agent support

---

## Gas Cost Analysis

### Per-Operation Costs (Base L2)

| Operation | v3 (Current) | v4 (Redesigned) | Savings |
|-----------|--------------|-----------------|---------|
| Agent Registration | ~65K | ~25K | 62% |
| Task Create+Fund | ~95K | ~40K | 58% |
| Task Complete | ~45K | ~30K | 33% |
| Dispute Create | ~80K | ~50K | 38% |
| Streaming Create | ~85K | ~45K | 47% |
| Reputation Update | ~30K (per-agent) | ~30K (Merkle root) | 99.99% at scale |

### Storage Efficiency

| Metric | v3 (Current) | v4 (Redesigned) |
|--------|--------------|-----------------|
| Storage per agent | 96 bytes | 64 bytes |
| Storage per task | 96 bytes | 96 bytes |
| Storage per epoch (10M agents) | 320M bytes | 32 bytes |
| Annual storage growth (1M tasks) | ~96 MB | ~96 MB |
