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

All contracts are UUPS upgradeable proxies — addresses are permanent, logic is upgradeable.

| Contract | Address |
|----------|---------|
| CovenantIdentity | `0xFa1bFd34290bf12A2F09Ea24Cda05E71cc79c1fF` |
| CovenantEscrow | `0x130e2027eB57C427Bf63E2B06d35B10CB20C4b77` |
| CovenantSettlement | `0x61124E9aDAd3167ED1DB644a901a5838c8725251` |
| CovenantArbitration | `0x4e7abC16c7f8bB65501bb451073a969345611D1d` |
| CovenantAttestation | `0x945d1576B71fA332e16B5a5fBD6Ca661B4DD1b8D` |
| InsurancePool | `0x7855E3BDf7d5FdCa33fF911E8B4B034263214371` |

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
