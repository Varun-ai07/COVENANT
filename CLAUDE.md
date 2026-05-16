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
├── graphify-out/    # Knowledge graph output (report, JSON, visualization)
├── .graphifyignore  # Graphify exclusion rules
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
- **Graphify (`/graphify`)**: Knowledge graph for the codebase. **Always run `/graphify .` first** when exploring, querying, or understanding the COVENANT codebase. Use `graphify query "..."` for architecture questions, `graphify path "A" "B"` to trace connections between modules, and `graphify explain "X"` to understand specific concepts.
- **Superpowers (`/superpowers`)**: Use `brainstorm` -> `write-plan` -> `execute-plan` for all core protocol features.
- **Excalidraw (`/excalidraw`)**: Generate architecture diagrams for agent-to-agent negotiation flows.
- **UI-UX Pro Max**: Audit all frontend components for accessibility and "Agency-grade" aesthetics.
- **Supabase CLI**: Use `npx supabase` for local DB management, migrations, and Edge Functions.

### Graphify Usage Guide
Graphify transforms the COVENANT codebase into a queryable knowledge graph with community detection, cross-module relationship mapping, and audit trails.

**Building the graph:**
```bash
/graphify .                        # Build full knowledge graph
/graphify . --update               # Incremental update (changed files only)
/graphify . --mode deep            # Aggressive relationship extraction
/graphify . --cluster-only         # Re-run clustering on existing graph
```

**Querying the graph (use before any deep code exploration):**
```bash
graphify query "how does TaskEscrow verify deliverables?"
graphify query "what connects AgentRegistry to ReceiptVerifier?"
graphify path "AgentRegistry" "ReceiptVerifier"    # Trace module connections
graphify explain "VerificationPipeline"            # Understand a concept
```

**Auto-rebuild:** Git hooks installed — the graph auto-updates after every commit and branch switch.

**When to use Graphify (ALWAYS prefer over raw file reading):**
- Before implementing new features (understand existing architecture)
- Before code reviews (trace cross-module dependencies)
- Before debugging (map the call chain)
- When answering "how does X work?" questions
- When planning refactors (identify all dependents)

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

### Core Protocol
| Contract | Address |
|----------|---------|
| AgentRegistry | `0xB215589dA259A98eEE8BF39739F6255131ac33A1` |
| TaskEscrow | `0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3` |
| ReceiptVerifier | `0xa47D15099be6aC516B53a6859D468E9004eEf76b` |

### Market & Batching
| Contract | Address |
|----------|---------|
| OpenTaskMarket | `0x5ccF09469222E5046b0830c6d71ed6B912bE70e6` |
| ParallelTaskBatch | `0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc` |

### Collective & Insurance
| Contract | Address |
|----------|---------|
| AgentCollective | `0x0CDE9560D2E95338922c40A52A2c81cdd20613d1` |
| AgentInsurance | `0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55` |

### Dispute Resolution
| Contract | Address |
|----------|---------|
| DisputeArbitration | `0x37A62C6eDd18461CCe00B6772Da8640C75DE740e` |

### ZK Verifiers
| Contract | Address |
|----------|---------|
| Groth16VerifierCapability | `0xd7108ed5C8577B30f6FC024319ebE8B380DaAb85` |
| CapabilityVerifier | `0x628CB2cA13f6FeAc48e0f24f45C3AF2Dbb1c02Fb` |
| Groth16VerifierReputation | `0xbe6AfBa53E06099410d78d56A75b689dfCa6532F` |
| ReputationVerifier | `0x1ac2532e39591cdb5E00Fb9d7C0f47E082d0F149` |

### Router & Integration
| Contract | Address |
|----------|---------|
| COVENANTRouter | `0x565C48FEFc39c9D98a37cCE30583913C7d0d5e09` |
| LitProtocolIntegration | `0x9322B12111699Dd05DD3d0c5D8D08b764051A89f` |

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

### Knowledge Graph (Graphify)
```bash
/graphify .                        # Build full codebase knowledge graph
/graphify . --update               # Incremental update (changed files only)
/graphify . --mode deep            # Deep extraction with rich INFERRED edges
graphify query "how does verification work?"   # Query the graph
graphify path "AgentRegistry" "TaskEscrow"     # Trace connections
graphify explain "VerificationPipeline"        # Explain a concept
graphify hook status               # Check git hooks are installed
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

## Enhanced Verification System

COVENANT implements a comprehensive verification system with multi-stage validation, specialized checkers, and query resolution.

### Key Components

1. **Multi-Stage Validation Pipeline** - Automated gatekeeping, specialized checkers, and LLM evaluation
2. **Specialized Checkers** - Type-specific validation for different deliverable formats
3. **Query Resolution** - Worker questions during task execution with encrypted communication
4. **Evidence-Based Verification** - Audit trails and deterministic scoring with LLM-weighted evaluation
5. **ZK Capability Proofs** - Zero-knowledge verification of agent capabilities

### Specialized Checkers

- **ThreeJSChecker** - Validates 3D graphics/Three.js deliverables
- **URLAccessibleChecker** - Verifies web application accessibility
- **APIDEndpointChecker** - Validates API endpoint functionality
- **DatabaseChecker** - Checks database schema and queries
- **TestCoverageChecker** - Ensures adequate test coverage
- **PerformanceChecker** - Validates performance benchmarks
- **SecurityChecker** - Checks for security vulnerabilities
- **CodeQualityChecker** - Evaluates code quality metrics
- **StripeIntegrationChecker** - Validates Stripe payment integration
- **FullStackChecker** - Comprehensive full-stack application validation
- **CodeChecker** - General code deliverable validation
- **ResearchChecker** - Research report evaluation
- **DataChecker** - Data analysis deliverable validation
- **TextChecker** - Text-based deliverable validation
- **GenericChecker** - Fallback validation for all other deliverables

### Query Resolution System

Workers can submit queries during task execution for:
- Specification clarification
- Resource issues
- Feasibility concerns

Clients receive encrypted queries and provide encrypted responses on-chain.

### Verification Scoring

Uses weighted scoring system:
- 40% Deterministic checks (automated validation)
- 60% LLM evaluation (qualitative assessment)
- Minimum 75% passing threshold for approval

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
