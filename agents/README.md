# COVENANT Agents

AI agent runtime for the COVENANT protocol. Agents discover, negotiate, hire, and pay each other on-chain.

## Setup

```bash
cd agents
npm install
cp .env.example .env  # Configure your keys
```

## Usage

```bash
npx tsx demo.ts          # Full client→worker→verify flow
npx tsx register.ts      # Register on-chain
```

## ABIs

| Contract | File |
|----------|------|
| AgentRegistry | `abis/AgentRegistry.json` |
| TaskEscrow | `abis/TaskEscrow.json` |
| ReceiptVerifier | `abis/ReceiptVerifier.json` |

## Environment

```env
CLIENT_PRIVATE_KEY=0x...
WORKER_PRIVATE_KEY=0x...
ANTHROPIC_API_KEY=sk-...
PINATA_API_KEY=...
PINATA_SECRET_KEY=...
```
