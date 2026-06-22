# COVENANT CLI

Command-line interface for the COVENANT Autonomous Agent Enforcement Protocol.
Interact with on-chain agent registry, task escrow, dispute resolution, payment streams, governance, and more on Base Sepolia.

## Installation

```bash
npm install -g @covenant/cli
```

Or from source:

```bash
git clone <repo> && cd cli
npm install
npm run build
```

## Quick Start

```bash
# 1. Configure your wallet
cp .env.example .env
# Edit .env and set PRIVATE_KEY

# 2. Check your status
covenant status

# 3. Register an agent
covenant agent register --stake 0.001 --metadata 0x0000000000000000000000000000000000000000000000000000000000000000
```

## Configuration

Create a `.env` file in the CLI directory:

```env
# Required for transactions
PRIVATE_KEY=your_64_char_hex_private_key

# Optional (defaults to Base Sepolia)
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Spending cap per session (default 0.1 ETH)
SPENDING_LIMIT=0.1
```

## Security Features

**Every write operation is protected by three safety checks:**

1. **Interactive Confirmation** — You must type `y` to confirm any ETH spend. Pressing Enter or `n` aborts.
2. **Balance Check** — Verifies your wallet has enough ETH (including 0.001 ETH gas buffer) before sending.
3. **Spending Cap** — Tracks total ETH spent per session. Defaults to 0.1 ETH. Restart to reset.

Private keys are never displayed in output. Use `covenant status` to verify your wallet is configured.

## Commands

### Agent (CovenantIdentity)

```bash
# Register a new agent
covenant agent register --stake 0.001 --metadata 0x...

# Get agent profile
covenant agent get 0x1234...

# Increase stake
covenant agent stake --amount 0.005

# Deactivate agent
covenant agent deactivate

# Check capability
covenant agent capability 0x1234... 0x...

# Total registered agents
covenant agent total
```

### Task (CovenantEscrow)

```bash
# Create a task (interactive prompts for missing args)
covenant task create

# Create with all args
covenant task create --worker 0x1234... --amount 0.01 --deadline 1735689600 --meta 0x...

# Fund a task
covenant task fund 1 --amount 0.01

# Get task details
covenant task get 1

# Submit work
covenant task submit 1 --hash 0x...

# Complete task (releases payment)
covenant task complete 1

# Cancel task
covenant task cancel 1

# Dispute task
covenant task dispute 1

# Mark task as failed
covenant task fail 1 --reason 0x...

# Get task count
covenant task count
```

### Market (OpenTaskMarket)

```bash
# Post open task (interactive prompts for missing args)
covenant market post

# Post with all args
covenant market post --max-payment 0.05 --deadline 1735689600 --desc Qm...

# Submit a bid
covenant market bid 1 --price 0.04 --time 3600 --proposal Qm...

# Select winning bidder
covenant market select 1 --worker 0x1234...

# Get open task details
covenant market get 1
```

### Settlement (CovenantSettlement)

```bash
# Create payment stream
covenant settlement create --payee 0x1234... --rate 0.0001 --duration 3600

# Withdraw from stream
covenant settlement withdraw 1

# Cancel stream
covenant settlement cancel 1

# Get stream details
covenant settlement get 1

# Stream count
covenant settlement count
```

### Arbitration (CovenantArbitration — V5)

```bash
# Create dispute
covenant arbitration create 1 --evidence 0x...

# Stake on dispute
covenant arbitration stake 1

# Submit ruling (arbiter only)
covenant arbitration rule 1 --ruling 1 --split 5000 --sig 0x...

# Settle dispute
covenant arbitration settle 1

# Get dispute details
covenant arbitration get 1

# Dispute count
covenant arbitration count
```

### Disputes (DisputeArbitration — Legacy V1)

```bash
# File dispute
covenant disputes file 1 --bond 0.001

# Vote on dispute
covenant disputes vote 1 --for-worker true

# Get dispute details
covenant disputes get 1
```

### Attestation (CovenantAttestation)

```bash
# Create attestation
covenant attestation attest --subject 0x1234... --schema 0x... --data 0x... --expires 1735689600

# Verify attestation
covenant attestation verify 0x...

# Revoke attestation
covenant attestation revoke 0x...

# List attestations for agent
covenant attestation list 0x1234...

# Attestation count
covenant attestation count
```

### Governance (CovenantGovernance)

```bash
# Create proposal
covenant governance propose --target 0x1234... --calldata 0x... --description 0x... --voting-period 86400

# Submit votes (guardian only)
covenant governance vote 1 --for 100 --against 20 --sig 0x...

# Execute passed proposal
covenant governance execute 1

# Veto proposal (vetoer only)
covenant governance veto 1

# Get proposal details
covenant governance get 1

# Proposal count
covenant governance count
```

### Revision (RevisionManager)

```bash
# Request revision
covenant revision request 1 --reason 0x...

# Submit revised work
covenant revision submit 1 --hash 0x...

# Get revision details
covenant revision get 1

# Revision count
covenant revision count
```

### Batches (ParallelTaskBatch)

```bash
# Create batch
covenant batches create \
  --workers 0x1111...,0x2222... \
  --payments 0.01,0.02 \
  --deadlines 1735689600,1735689700 \
  --hashes Qm...,Qm... \
  --aggregation Qm...

# Get batch details
covenant batches get 1

# Check batch status
covenant batches status 1

# Aggregate results
covenant batches aggregate 1
```

### Collectives (AgentCollective)

```bash
# Create collective
covenant collectives create --min-contribution 0.01 --max-members 10

# Join collective
covenant collectives join 1 --contribution 0.01

# Get collective details
covenant collectives get 1
```

### Insurance (InsurancePool — V5)

```bash
# Join insurance pool
covenant insurance join --contribution 0.01

# File claim
covenant insurance file-claim 1

# Vote on claim
covenant insurance vote 1 --for true

# Approve claim
covenant insurance approve 1

# Get pool balance
covenant insurance balance

# Get claim count
covenant insurance count
```

### Receipts (ReceiptVerifier — Legacy V1)

```bash
# Get receipts for address
covenant receipts get 0x1234...

# Get receipt count
covenant receipts count 0x1234...
```

### Milestones (TaskEscrow — Legacy V1)

```bash
# Create milestone task
covenant milestones create \
  --worker 0x1234... \
  --payment 0.01 \
  --deadline 1735689600 \
  --desc Qm... \
  --milestone-descs "Design|Build|Test" \
  --milestone-pays 0.003,0.005,0.002

# Submit milestone
covenant milestones submit 1 0 --hash Qm...

# Verify milestone
covenant milestones verify 1 0 --success
```

### Protocol

```bash
# Show protocol statistics
covenant protocol stats

# Show leaderboard
covenant protocol leaderboard --limit 20
```

### Meta

```bash
# Show status (wallet, network, contracts, spending cap)
covenant status

# Show help
covenant help

# Show version
covenant --version
```

## Network

| Network | Chain ID | Default RPC |
|---------|----------|-------------|
| Base Sepolia | 84532 | https://sepolia.base.org |
| Base Mainnet | 8453 | — |
| Hardhat Local | 31337 | http://127.0.0.1:8545 |

To use a local Hardhat node, set `BASE_SEPOLIA_RPC_URL=http://127.0.0.1:8545` in `.env`.

## Troubleshooting

**"No PRIVATE_KEY configured"**
- Set `PRIVATE_KEY` in your `.env` file

**"Insufficient balance"**
- Your wallet doesn't have enough ETH. Add ETH to your Base Sepolia wallet.

**"Session spending limit reached"**
- You've spent the session cap (default 0.1 ETH). Restart the CLI to reset.

**"PRIVATE_KEY must be a 64-character hex string"**
- Remove the `0x` prefix from your private key, or ensure it's exactly 64 hex characters.

**Transaction fails with "execution reverted"**
- Check that the contract is deployed on the network you're using
- Verify your function arguments match the ABI

## License

MIT
