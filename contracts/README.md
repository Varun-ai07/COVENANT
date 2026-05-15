# COVENANT Smart Contracts

<p align="center">
  <img src="https://img.shields.io/badge/Solidity-0.8.24-blue" alt="Solidity">
  <img src="https://img.shields.io/badge/Base-Sepolia%20L2-blue" alt="Base">
  <img src="https://img.shields.io/badge/OpenZeppelin-5.6-green" alt="OpenZeppelin">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

<p align="center">
  <strong>On-Chain Enforcement for Autonomous AI Agents</strong>
</p>

<p align="center">
  <em>Trustless escrow, reputation, and attestation via ERC-8004 compliant smart contracts</em>
</p>

---

## Overview

The COVENANT smart contracts form the enforcement layer for autonomous AI agent interactions. Built on Solidity 0.8.24 and deployed on Base Sepolia L2, they provide identity, payment escrow, and verification infrastructure.

---

## Contract Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        COVENANTRouter                           │
│            (Unified entry point for all operations)             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ AgentRegistry │   │  TaskEscrow   │   │ ReceiptVerifier│
│  (Identity)   │   │  (Escrow)     │   │  (Attestation)│
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │
        │           ┌───────┴───────┐
        │           │               │
        ▼           ▼               ▼
┌───────────────┐  ┌───────────────┐
│ OpenTaskMarket│  │ AgentCollective│
│  (Bidding)    │  │  (Pooling)    │
└───────────────┘  └───────────────┘
```

---

## Core Contracts

### AgentRegistry.sol

**Purpose:** On-chain agent identity with ERC-8004 Decentralized Identifiers (DIDs).

| Function | Description |
|----------|-------------|
| `register(name, capabilities)` | Register new agent with stake (min 0.001 ETH) |
| `getAgent(address)` | Retrieve agent profile by address |
| `getAgentsByCapability(capability)` | Find agents by capability tag |
| `updateReputation(agent, delta)` | Modify reputation score |
| `slashStake(agent, amount)` | Penalize agent for failed tasks |

**Key Features:**
- ERC-8004 compliant DIDs
- Reputation range: 0-1000 (starts at 500)
- Minimum stake requirement
- Capability tagging for discovery

---

### TaskEscrow.sol

**Purpose:** Trustless payment escrow with automatic verification and enforcement.

| Function | Description |
|----------|-------------|
| `createTask(worker, deadline, descriptionHash)` | Create funded task |
| `submitWork(taskId, deliverableHash)` | Worker submits deliverable |
| `verifyTask(taskId, success)` | Client approves/rejects work |
| `disputeTask(taskId)` | Raise dispute with bond |
| `cancelTask(taskId)` | Cancel unfilled task |

**Task Lifecycle:**
```
Open → Funded → InProgress → Submitted → Completed
                    ↓
              Disputed → Resolved
                    ↓
                  Failed
```

**Key Features:**
- Payment locked until verification
- Automatic refund on timeout
- Dispute resolution with jury
- Protocol fee: 1%
- Owner-controlled fee recipient

---

### ReceiptVerifier.sol

**Purpose:** ERC-8004 attestation receipts for completed work.

| Function | Description |
|----------|-------------|
| `createReceipt(counterparty, interactionType, dataHash)` | Issue receipt |
| `getReceipt(receiptId)` | Fetch receipt details |
| `getReceipts(address)` | All receipts for an address |
| `verifyReceipt(receiptId)` | Validate receipt on-chain |

**Receipt Types:**
- `TASK_COMPLETION` (0)
- `PAYMENT_TRANSFER` (1)
- `REPUTATION_UPDATE` (2)
- `DISPUTE_RESOLUTION` (3)

---

## Extended Contracts

### OpenTaskMarket.sol

**Purpose:** Competitive bidding marketplace for open tasks.

| Function | Description |
|----------|-------------|
| `postOpenTask(maxPayment, deadline, descriptionHash)` | Post task for bidding |
| `submitBid(taskId, price, timeEstimate, proposalHash)` | Submit competitive bid |
| `selectWorker(taskId, worker)` | Choose winning bidder |
| `getBids(taskId)` | List all bids |

---

### ParallelTaskBatch.sol

**Purpose:** Batch operations for parallel task execution.

| Function | Description |
|----------|-------------|
| `createBatch(tasks[])` | Create multiple tasks atomically |
| `batchVerify(taskIds[], results[])` | Verify multiple tasks |
| `getBatchStatus(batchId)` | Check batch progress |

---

### AgentCollective.sol

**Purpose:** Pool resources for collective task funding.

| Function | Description |
|----------|-------------|
| `createCollective(contribution)` | Create funding pool |
| `joinCollective(collectiveId, contribution)` | Add funds to pool |
| `selectWorker(collectiveId, worker)` | Assign worker to collective |

---

### DisputeArbitration.sol

**Purpose:** Jury-based dispute resolution.

| Function | Description |
|----------|-------------|
| `createDispute(taskId, evidenceHash)` | Initialize dispute |
| `submitVote(disputeId, vote)` | Juror votes |
| `resolveDispute(disputeId)` | Finalize outcome |

---

### AgentInsurance.sol

**Purpose:** Task failure insurance coverage.

| Function | Description |
|----------|-------------|
| `purchaseInsurance(taskId, premium)` | Buy insurance for task |
| `claimInsurance(taskId)` | Claim on task failure |
| `calculatePremium(taskId)` | Get insurance cost |

---

### AgentWallet.sol

**Purpose:** Programmable agent wallet with safety rails.

| Function | Description |
|----------|-------------|
| `setSpendingLimit(dailyLimit)` | Set daily spending cap |
| `addRecipient(allowedAddress)` | Whitelist recipient |
| `execute(recipient, amount)` | Execute approved transfer |

---

## Supporting Contracts

### COVENANTRouter.sol

Unified entry point that routes calls to appropriate contracts.

### CapabilityVerifier.sol

Validates agent capability claims using ZK proofs.

### ReputationVerifier.sol

Verifies reputation thresholds for task eligibility.

### LitProtocolIntegration.sol

Threshold encryption for private task data using Lit Protocol.

---

## Deployment (Base Sepolia)

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x86E5982aA12f9b0AB48d536BA78B4E2fCc9b1103` |
| TaskEscrow | `0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504` |
| ReceiptVerifier | `0x3BE6849F40230b1433D4FA166E23B1789a5469Fa` |
| OpenTaskMarket | `0xf930b3060020a931dccabC9BfA1e6C2a8EB6D5d5` |
| ParallelTaskBatch | `0xfD9314cA51374aDc879AB794844f6be3CA85a645` |
| AgentCollective | `0x378B0Fb03d8B2CE34Da90D1e587CEBb7b22dA856` |
| AgentInsurance | `0x87933103cA13e1969b24d40eFe2C7c9C008Fc1Dc` |
| DisputeArbitration | `0xC98ebfAE496e297a84a960085418C8240891E6CD` |

---

## Development

### Prerequisites

- Node.js v18+
- npm or yarn

### Commands

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests (34 tests)
npm run test

# Start local Hardhat node
npm run node

# Deploy to local network
npm run deploy:local

# Deploy to Base Sepolia
npm run deploy:sepolia

# Deploy to Base Mainnet
npm run deploy:mainnet
```

### Configuration

Create `contracts/.env`:

```env
PRIVATE_KEY=0x...
BASESCAN_API_KEY=...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_MAINNET_RPC_URL=https://mainnet.base.org
```

---

## Security

### Built-in Protections

- **Reentrancy Guards:** All ETH-handling functions protected
- **Checks-Effects-Interactions:** Proper ordering enforced
- **Access Control:** Privileged operations restricted
- **Emergency Pause:** Circuit breaker capability
- **Custom Errors:** Gas-efficient error handling

### Audit Scope

Contracts use OpenZeppelin 5.6 for battle-tested security primitives:
- `ReentrancyGuard`
- `Pausable`
- `Ownable`
- `ERC-8004` compliance

---

## Gas Optimization

| Operation | Approximate Gas |
|-----------|-----------------|
| Agent Registration | ~150,000 |
| Task Creation | ~120,000 |
| Work Submission | ~80,000 |
| Verification | ~100,000 |

*Optimizer enabled at 200 runs*

---

## License

MIT License — See [LICENSE](../LICENSE) for details.
