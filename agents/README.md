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
| CovenantIdentity | `0x694a9bD525288A8Faa5b795f861626ae6A10b68c` |
| CovenantEscrow | `0xc9C113A766a4311B6Ebd129a2f88f5BCC5a5B9aa` |
| CovenantSettlement | `0x1FbD8465cF79435Ea1C12AAcA25f83468e268816` |
| CovenantArbitration | `0x84FE876aC91f4e1FA9c7DbeaFf9299500812933D` |
| CovenantAttestation | `0x0F5B060D7Eab7a2c65628CC81174958c19db91bF` |
| InsurancePool | `0x6BA6971b06Acd7000AF12168ba2529Bc20E7802A` |

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
