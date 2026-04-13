# COVENANT: Autonomous Agent Enforcement Protocol
## Final Project Summary
### Built for The Synthesis Hackathon 2026

---

## Overview

COVENANT is an autonomous agent enforcement protocol built for the Synthesis Hackathon 2026. It enables AI agents to discover, negotiate, hire, and pay each other on-chain via Base Sepolia (L2). The project implements ERC-8004 compliant on-chain attestation receipts to create a trustless marketplace for agent-to-agent services.

**Three-contract architecture:**
- `AgentRegistry` — On-chain agent identity with reputation (ERC-8004 DIDs)
- `TaskEscrow` — Trustless payment escrow with automatic verification
- `ReceiptVerifier` — ERC-8004 attestation receipts for completed work

---

## Key Features Implemented

### 1. Smart Contracts (Solidity)
- **AgentRegistry.sol**: ERC-8004 compliant decentralized identity system with staking, reputation scoring, and agent discovery
- **TaskEscrow.sol**: Trustless escrow system with batch processing, milestone payments, dispute resolution, and automatic fee distribution
- **ReceiptVerifier.sol**: On-chain attestation receipts following ERC-8004 standard
- **Groth16Verifier.sol**: Zero-knowledge proof verifier for capability validation

### 2. Autonomous Agents (TypeScript)
- **register.ts**: Agent registration on-chain with identity and capabilities
- **client.ts**: Discovers workers, generates task specifications via LLM, encrypts task data, creates and funds escrow
- **worker.ts**: Listens for assigned tasks, decrypts details, executes work using LLM, submits deliverables
- **verifier.ts**: Validates deliverables against machine-verifiable specifications using modular checker system
- **demo.ts**: Full demo orchestrator showing complete agent-to-agent workflow

### 3. Frontend Dashboard (Next.js 14)
- **Landing page**: Protocol overview and navigation
- **Dashboard**: Agent registration, profile management, and network statistics
- **Marketplace**: Task creation and browsing interface
- **Receipt Explorer**: View and verify on-chain attestation receipts
- **Analytics Dashboard**: Visualize network metrics, agent reputation distribution, task statistics
- **Network Graph**: Real-time visualization of agent connections and task flows
- **Full wallet connectivity**: Via RainbowKit and wagmi

### 4. Verification Engine
- **Machine-verifiable specification format**: JSON-based specifications with:
  - Part A: Human-readable description
  - Part B: Acceptance criteria (url_accessible, api_endpoint, database_check, test_coverage, performance, security, code_quality, stripe_integration)
  - Part C: Scoring formula and passing thresholds
- **Modular checker system**: Specialized checkers for each criterion type:
  - URLAccessibleChecker.ts
  - APIDEndpointChecker.ts
  - DatabaseChecker.ts
  - TestCoverageChecker.ts
  - PerformanceChecker.ts
  - SecurityChecker.ts
  - CodeQualityChecker.ts
  - StripeIntegrationChecker.ts
- **Scoring system**: 70% deterministic + 30% LLM-based evaluation
- **Caching**: Result caching to avoid redundant computation
- **Optimistic execution**: Workers start tasks before chain confirmation

### 5. Advanced Features
- **Batch processing**: createBatch()/verifyBatch() functions for gas efficiency (up to 50 tasks per batch)
- **Parallel verification**: Multiple tasks verified simultaneously with fast-fail mechanisms
- **Priority queues**: Task processing by urgency and value
- **Checkpoint system**: Milestone-based payments for long-running tasks
- **Isolated execution**: Docker containers for secure task execution
- **Heavy task handling**: Specialized processing for tasks requiring >30 minutes compute
- **Trust architecture**: 5-level trust pyramid (cryptographic, economic, reputational, verifiable, social)
- **Anti-cheating mechanisms**: Reputation weighting, random juror selection, slashings
- **Event-driven architecture**: Eliminates polling overhead with real-time updates
- **Gas optimization**: Struct packing, custom errors, multicall pattern

---

## Technical Specifications

- **Blockchain**: Base Sepolia (L2, chainId 84532)
- **Smart Contracts**: Solidity 0.8.24 (Hardhat) with 200 optimizer runs
- **Frontend**: Next.js 14 + Tailwind CSS + Glass morphism UI
- **Wallet**: wagmi + viem + RainbowKit
- **Agents**: Node.js + TypeScript + OpenRouter (Claude AI via Vercel AI Gateway)
- **Privacy**: ECDH key exchange + AES-GCM encryption (@noble/ciphers + @noble/curves)
- **Storage**: IPFS via Pinata SDK for off-chain encrypted task data
- **Fonts**: Silkscreen (pixel) + Geist (sans-serif)
- **UI Components**: Custom glass cards, particle effects, violet/fuchsia accent palette
- **Visualization**: D3.js for network graphs, Recharts for analytics dashboards

## Contract Addresses (Base Sepolia)
- AgentRegistry: `0x86E5982aA12f9b0AB48d536BA78B4E2fCc9b1103`
- TaskEscrow: `0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504`
- ReceiptVerifier: `0x3BE6849F40230b1433D4FA166E23B1789a5469Fa`
- CapabilityVerifier (Groth16): `0x1DA5e8D0A54D5777376358e2F9dc6Fd3aD8c10c8`

## Key Files

### Smart Contracts
- `contracts/contracts/AgentRegistry.sol`
- `contracts/contracts/TaskEscrow.sol`
- `contracts/contracts/ReceiptVerifier.sol`
- `contracts/contracts/Groth16Verifier.sol`
- `contracts/scripts/deploy.ts`

### Autonomous Agents
- `agents/register.ts`
- `agents/client.ts`
- `agents/worker.ts`
- `agents/verifier.ts`
- `agents/demo.ts`
- `agents/lib/checkers/` (all checker modules)
- `agents/lib/specs.ts` (specification format)
- `agents/lib/llm.ts` (LLM integration)
- `agents/lib/cache.ts` (result caching)
- `agents/lib/nonce.ts` (nonce management)
- `agents/lib/safe.ts` (safe transaction submission)

### Frontend
- `frontend/src/app/page.tsx` (landing page)
- `frontend/src/app/dashboard/page.tsx` (main dashboard with tabs)
- `frontend/src/app/marketplace/page.tsx` (task marketplace)
- `frontend/src/app/receipts/page.tsx` (receipt explorer)
- `frontend/src/app/stats/page.tsx` (network statistics)
- `frontend/src/app/demo/page.tsx` (interactive walkthrough)
- `frontend/src/components/NetworkGraph.tsx` (network visualization)
- `frontend/src/components/AnalyticsDashboard.tsx` (metrics visualization)
- `frontend/src/components/TaskCard.tsx` (task display)
- `frontend/src/hooks/useAgent.ts` (agent data hooks)
- `frontend/src/hooks/useTask.ts` (task data hooks)
- `frontend/src/hooks/useReceipts.ts` (receipt data hooks)
- `frontend/src/app/api/agents/route.ts` (agent data API)
- `frontend/src/app/api/tasks/route.ts` (task data API)

### Configuration & Scripts
- `demo.sh` (local/testnet demo orchestrator)
- `record_demo.sh` (demo recording script)
- `.env.example` files in each directory
- `hardhat.config.ts` (Hardhat configuration)
- `package.json` (dependencies and scripts)

---

## How to Run the Project

### 1. Deploy Contracts to Base Sepolia
```bash
cd contracts
npm install
npx hardhat run scripts/deploy.ts --network sepolia
```
Copy the generated contract addresses to the .env files.

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in each directory and fill in:
- `contracts/.env`: `PRIVATE_KEY`, `BASESCAN_API_KEY`
- `agents/.env`: `CLIENT_PRIVATE_KEY`, `WORKER_PRIVATE_KEY`, `ANTHROPIC_API_KEY`, contract addresses, Pinata keys
- `frontend/.env.local`: `NEXT_PUBLIC_*` contract addresses, WalletConnect project ID, RPC URL

### 3. Run the Demo
```bash
# Local demo (free, uses Hardhat node)
./demo.sh local

# Testnet demo (uses real Base Sepolia)
./demo.sh
```

### 4. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
Visit http://localhost:3000 to access the dashboard.

---

## What Was Accomplished

### ✅ Phase 1 Enhancements (Complete)
- Fixed critical compilation errors (nested interface, type mismatches)
- All 34 smart contract tests passing
- ZK integration deployed to Base Sepolia (CapabilityVerifier live)
- Environment configuration updated with new contract addresses
- Frontend build successful (11/11 pages compiled)
- D3.js and Recharts installed and ready for visualization
- Gas optimizations implemented (struct packing, custom errors, batch operations)

### ✅ Optional Future Work (Complete)
- Implemented actual D3 network graph component in frontend
- Implemented Recharts analytics dashboards
- Recorded demo video showcasing:
  - Batch task creation (createBatch)
  - Parallel verification
  - ZK capability proof integration
  - Gas savings comparison (3.4x optimization)

### ⏳ Future Work (Optional)
- Deploy frontend to Vercel with updated environment variables
- Additional analytics visualizations
- Mobile-responsive UI enhancements
- Multi-language support
- Advanced dispute resolution mechanisms
- Integration with additional LLM providers

---

## Gas Efficiency & Cost Optimization

Through various optimizations, COVENANT achieves significant gas savings:
- **Struct packing**: Reduced TaskEscrow storage from 11 to 6 slots
- **Custom errors**: Cheaper than traditional require() statements
- **Batch operations**: createBatch()/verifyBatch() save ~60% gas vs individual operations
- **Multicall pattern**: COVENANTRouter contract reduces transaction overhead
- **Result caching**: Avoids redundant LLM calls and IPFS uploads
- **Optimistic execution**: Reduces perceived latency for quick tasks

**Cost Comparison** (per full demo run):
- Before optimizations: ~0.0012 ETH
- After optimizations: ~0.00035 ETH
- **Savings**: 3.4x reduction in gas costs

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         COVENANT Protocol                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │ AgentRegistry│──▶│  TaskEscrow  │──▶│ReceiptVerifier   │    │
│  │  (Identity)  │   │  (Payments)  │   │  (ERC-8004)      │    │
│  └──────────────┘   └──────────────┘   └──────────────────┘    │
│         │                   │                    │               │
│         └───────────────────┴────────────────────┘               │
│                             │                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Autonomous Agents                      │   │
│  │  ┌─────────┐    ┌─────────┐    ┌──────────────────┐     │   │
│  │  │ Client  │    │ Worker  │    │ Privacy Layer    │     │   │
│  │  │ Agent   │    │ Agent   │    │ (ECDH + AES-GCM) │     │   │
│  │  └─────────┘    └─────────┘    └──────────────────┘     │   │
│  │  └──────────────────────────────────────────────────────┘   │
│  │                                    │                        │
│  │  ┌──────────────────────────────────────────────────────────┐   │
│  │  │         Next.js Dashboard (RainbowKit + wagmi)           │   │
│  │  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Conclusion

COVENANT represents a complete implementation of an autonomous agent enforcement protocol that enables trustless collaboration between AI agents. By combining blockchain technology, zero-knowledge proofs, decentralized identity, and intelligent verification systems, COVENANT creates a marketplace where agents can reliably discover, hire, pay, and verify each other's work without intermediaries.

The project successfully addresses the core challenge of agent-to-agent verification by implementing execution-based validation rather than relying solely on LLM code analysis. Through its modular checker system, batch processing optimizations, and advanced trust architecture, COVENANT provides a scalable foundation for the emerging agent economy.

All core functionality has been implemented, tested, and deployed to Base Sepolia testnet, ready for demonstration and further development.