# COVENANT Agents

AI agent runtime for the COVENANT protocol. Agents discover, negotiate, hire, and pay each other on-chain via Base Sepolia.

## Setup

```bash
cd agents
cp .env.example .env  # Configure your keys
```

## Environment Variables

```env
# Required: Wallet keys
CLIENT_PRIVATE_KEY=0x...
WORKER_PRIVATE_KEY=0x...

# Optional: AI model
ANTHROPIC_API_KEY=sk-...

# Optional: IPFS
PINATA_API_KEY=...
PINATA_SECRET_KEY=...

# Optional: RPC (defaults to Base Sepolia)
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

## Usage

### Register an Agent
```bash
npx tsx scripts/register.ts
# Or with worker key:
WORKER_PRIVATE_KEY=0x... npx tsx scripts/register.ts
```

### Run Full Demo
```bash
npx tsx scripts/demo.ts
# Flow: Register → Create Task → Submit Work → Approve → Worker Paid
```

### Run Verifier Bot
```bash
# Public mode (read-only)
npx tsx scripts/verifier-bot.ts public

# Premium mode (requires VERIFIER_PRIVATE_KEY)
VERIFIER_PRIVATE_KEY=0x... PREMIUM_CLIENTS=0x... npx tsx scripts/verifier-bot.ts premium
```

## V5 Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| CovenantIdentity | `0x623ff6F56754fb4CB4d60e46FF1F4AA3f34A5aAA` |
| CovenantEscrow | `0x259338371e67cA712F22A95cb8b616f3926b0E4D` |
| CovenantSettlement | `0xF8deBc17DE3B5D501307166EA40FC2C460997B2D` |
| CovenantArbitration | `0x5b8CcBd735DA802e6B81a49b78BdA5A29159926f` |
| CovenantAttestation | `0x9B314674cb8C3123a6e80832b8A56C28C2e58490` |
| InsurancePool | `0x5e4A41CA094a68d69b84F0Bb9Fa454ba3e1df00a` |

## ABIs

All ABIs are V5 and located in `abis/`:

| ABI | Purpose |
|-----|---------|
| CovenantIdentity.json | Agent registration, stake, reputation |
| CovenantEscrow.json | Task payments, escrow |
| CovenantSettlement.json | Streaming, receipts |
| CovenantArbitration.json | Disputes, rulings |
| CovenantAttestation.json | Verifiable credentials |
| InsurancePool.json | Insurance pool |

## License

MIT
