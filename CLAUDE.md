# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

COVENANT is an autonomous agent enforcement protocol built for the Synthesis Hackathon 2026. It enables AI agents to discover, negotiate, hire, and pay each other on-chain via Base Sepolia (L2). The project implements ERC-8004 compliant on-chain attestation receipts.

**Three-contract architecture:**
- `AgentRegistry` — On-chain agent identity with reputation (ERC-8004 DIDs)
- `TaskEscrow` — Trustless payment escrow with automatic verification
- `ReceiptVerifier` — ERC-8004 attestation receipts for completed work

## Directory Structure

```
COVENANT/
├── contracts/       # Solidity (Hardhat) - Base Sepolia
├── agents/          # Agent Scripts (Node.js/TS + Viem)
├── frontend/        # Next.js 14 Dashboard (RainbowKit + Wagmi)
├── .claude/         # Local Skills (Superpowers, Excalidraw, UI-UX Pro)
└── demo.sh          # Orchestrator (./demo.sh local)
```
---

---

## 🤖 Intelligence & Vision Workflow

### Model Mapping (OpenRouter)
| Task Type | Optimal Model |
| :--- | :--- |
| **Primary Brain / Logic** | `openrouter/hunter-alpha` |
| **Vision & Depth Analysis** | `openrouter/healer-alpha` |
| **3D / Three.js Generation** | `google/gemma-3-27b-it:free` |

### 3D Background Protocol
- **Trigger:** When providing 3 images for a 3D background/UI.
- **Action:** Spawn a subagent using **Healer-Alpha** to define layer depths and occlusion.
- **Coding:** Use **Gemma 3 Free** to generate the Three.js/React Three Fiber boilerplate.
- **Final Review:** **Hunter-Alpha** must verify the code integrates with the COVENANT frontend theme.

---

## 🔧 Installed Skills & Capabilities
- **Superpowers (`/superpowers`)**: Use `brainstorm` -> `write-plan` -> `execute-plan` for all core protocol features.
- **Excalidraw (`/excalidraw`)**: Generate architecture diagrams for agent-to-agent negotiation flows.
- **UI-UX Pro Max**: Audit all frontend components for accessibility and "Agency-grade" aesthetics.
- **Supabase CLI**: Use `npx supabase` for local DB management, migrations, and Edge Functions.

---

## 💻 Common Commands

### Contracts (`cd contracts`)
- `npx hardhat compile` | `npx hardhat test`
- `npx hardhat node` (Local node on 8545)

### Agents (`cd agents`)
- `npx tsx demo.ts` (Full protocol demo)
- `npx tsx register.ts` (Register agent on-chain)

### Frontend (`cd frontend`)
- `npm run dev` (Local dashboard on :3000)
- `npm run lint` (Run before committing)

---

## 🔐 Key Technical Specs
- **Solidity:** 0.8.24 (Optimizer: 200)
- **Privacy:** ECDH + AES-GCM (@noble/ciphers)
- **Storage:** Pinata SDK (IPFS)
- **Chain:** Base Sepolia (84532)

## 📍 Contract Addresses (Base Sepolia)
- **AgentRegistry**: `0x86E5982aA12f9b0AB48d536BA78B4E2fCc9b1103`
- **TaskEscrow**: `0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504`
- **ReceiptVerifier**: `0x3BE6849F40230b1433D4FA166E23B1789a5469Fa`

## Common Commands

### Contracts (`cd contracts`)
```bash
npm install
npx hardhat compile          # Compile contracts
npx hardhat test             # Run all 34 tests
npx hardhat node             # Start local blockchain (port 8545)
npx hardhat run scripts/deploy.js --network localhost
```

### Agents (`cd agents`)
```bash
npm install
npx tsx demo.ts              # Full demo (client → worker → verify)
npx tsx register.ts          # Register an agent
npx tsx client.ts            # Run client agent only
npx tsx worker.ts            # Run worker agent only
```

### Frontend (`cd frontend`)
```bash
npm install
npm run dev                  # Dev server on localhost:3000
npm run build                # Production build
npm run lint                 # ESLint
```

### Full Demo
```bash
chmod +x demo.sh
./demo.sh local              # Local demo (free, unlimited, starts Hardhat node)
./demo.sh                    # Live Base Sepolia demo (requires funded wallet)
```

## Key Technical Details

- **Solidity version:** 0.8.24 with optimizer (200 runs)
- **Networks:** Base Sepolia (chainId 84532), Base mainnet (8453), localhost (31337)
- **Agent runtime:** TypeScript via `tsx`, uses `viem` for blockchain interaction
- **LLM integration:** Anthropic SDK + OpenRouter in `agents/lib/llm.ts`
- **Privacy:** ECDH key exchange + AES-GCM encryption via `@noble/ciphers` and `@noble/curves`
- **IPFS storage:** Pinata SDK for off-chain encrypted task data
- **Frontend:** Next.js 14 Pages Router, Tailwind CSS, wagmi + RainbowKit for wallet connection

## Environment Setup

Each subdirectory has its own `.env` file:
- `contracts/.env` — `PRIVATE_KEY`, `BASESCAN_API_KEY`
- `agents/.env` — `CLIENT_PRIVATE_KEY`, `WORKER_PRIVATE_KEY`, `ANTHROPIC_API_KEY`, contract addresses, Pinata keys
- `frontend/.env.local` — `NEXT_PUBLIC_*` contract addresses, WalletConnect project ID

Copy from `.env.example` in each directory and fill in values.

## Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x86E5982aA12f9b0AB48d536BA78B4E2fCc9b1103` |
| TaskEscrow | `0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504` |
| ReceiptVerifier | `0x3BE6849F40230b1433D4FA166E23B1789a5469Fa` |
