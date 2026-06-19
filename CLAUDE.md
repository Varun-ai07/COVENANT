# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

COVENANT is an autonomous agent enforcement protocol for the Synthesis Hackathon 2026. AI agents discover, negotiate, hire, and pay each other on-chain via Base Sepolia (L2) with ERC-8004 compliant attestation receipts.

```
contracts/ | agents/ | frontend/ | mcp/ | covenant-sdk/ | covenant-sdk-python/ | cli/ | packages/shared-types/ | demo.sh
```

## Core Integration Points (from knowledge graph)

| Abstraction | Edges | Role |
|-------------|-------|------|
| `CovenantSDK` | 23 | Main SDK entry, wraps all contracts |
| `CONTRACTS` | 19 | Address + ABI config for all deployed contracts |
| `loadAbi()` | 18 | Loads contract ABIs from artifacts |
| `getAccount()` | 14 | Wallet/account accessor for signing |
| `createServer()` | 13 | MCP server bootstrap, registers all tool categories |

Each contract domain (`registry`, `market`, `escrow`, `disputes`, `batches`, `insurance`, `collectives`, `receipts`) has a `register*Tools()` function wiring ABIs and handlers into the MCP server.

## Type Duplication (graphify finding)

`covenant-sdk/src/types.ts` and `mcp/src/types.ts` have semantically identical types with different names:

| covenant-sdk | mcp | Rule |
|-------------|-----|------|
| `ContractAddresses` | `ContractConfig` | Update both or consolidate into SDK |
| `AgentData` | `AgentInfo` | Update both or consolidate into SDK |
| `TaskData` | `TaskInfo` | Update both or consolidate into SDK |
| `TaskStatus` | `TASK_STATUS` | Update both or consolidate into SDK |

## Architecture


## Subgraph

| Resource | URL |
|----------|-----|
| Query URL | `https://api.studio.thegraph.com/query/1753884/local` |
| Studio URL | `https://thegraph.com/studio/subgraph/local` |

## Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x0003072b15d2c299d46bC5FfE7785E803895E614` |
| TaskEscrow | `0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3` |
| ReceiptVerifier | `0xa47D15099be6aC516B53a6859D468E9004eEf76b` |
| OpenTaskMarket | `0x5ccF09469222E5046b0830c6d71ed6B912bE70e6` |
| ParallelTaskBatch | `0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc` |
| AgentCollective | `0x0CDE9560D2E95338922c40A52A2c81cdd20613d1` |
| AgentInsurance | `0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55` |
| DisputeArbitration | `0x37A62C6eDd18461CCe00B6772Da8640C75DE740e` |
| Groth16VerifierCapability | `0xd7108ed5C8577B30f6FC024319ebE8B380DaAb85` |
| CapabilityVerifier | `0x628CB2cA13f6FeAc48e0f24f45C3AF2Dbb1c02Fb` |
| Groth16VerifierReputation | `0xbe6AfBa53E06099410d78d56A75b689dfCa6532F` |
| ReputationVerifier | `0x1ac2532e39591cdb5E00Fb9d7C0f47E082d0F149` |
| COVENANTRouter | `0x565C48FEFc39c9D98a37cCE30583913C7d0d5e09` |
| LitProtocolIntegration | `0x9322B12111699Dd05DD3d0c5D8D08b764051A89f` |
| MultiTokenEscrow | `0x0bd7E7E75AA828957AfE7445E17E58A278Bf256e` |
| AgentSmartWallet | `0x3c857aADAcFb62F94F121813000E072E788f4d21` |
| CovenantPaymaster | `0xd1C5265eF0Cb20c2bBE697d296bAF924754A5fd1` |
| TrainingMarketplace | `0x399C35e52BFe7c1822132af709bFE4B141D80D2C` |
| GrantProgram | `0x062CCc9f549db1c559f549b57ce84e89d20f61bc` |
| AutoVerifier | `0x23f135467fBe0F9f869F0Bf0B30eaaB87a9ec3A7` |
| MultiPartyReview | `0x482c435b4Ae3687089A49F9b1FE532FA019e3304` |
| ClientReputation | `0x32f84FE07466DdE497b941a02C18E3571f5570f8` |
| StakeSlashing | `0xC9BfA9FDcd0b6f1A8B99a29Fc72C0423D6015Be1` |
| MilestoneVerification | `0x3Ab1d5f3317e28fFBa607019b4E0AC9243851DF6` |
| RevisionManager | `0xc953A9B3DD7c0217ad800cE06A133590C7045701` |

| Contract | Address |
|----------|---------|

## Technical Specs

Solidity 0.8.24 (optimizer 200). Networks: Base Sepolia (84532), mainnet (8453), localhost (31337). Agent runtime: TS via `tsx` + viem. LLM: Anthropic SDK + OpenRouter in `agents/lib/llm.ts`. Privacy: ECDH + AES-GCM (`@noble/ciphers`, `@noble/curves`). Storage: Pinata SDK (IPFS). Frontend: Next.js 14, Tailwind, wagmi + RainbowKit.

## Verification System

Multi-stage pipeline: automated gatekeeping, specialized type checkers (ThreeJS, URL, API, DB, Code, Stripe, Security, Performance, Research, Data, Text, FullStack, Generic), LLM evaluation with audit trails. Workers submit encrypted queries during execution. **Scoring:** 40% deterministic + 60% LLM. Min 75% to pass.

## MCP Tools

25 `corven_`-prefixed domain tools in `mcp/` (v2.0.0). Each tool uses `action` parameter for routing. Key tools:

- `corven_agent` — register, get, update, deactivate, stake, find
- `corven_task` — create, fund, submit, verify, dispute, get, milestone
- `corven_market` — post, bid, select, cancel
- `corven_batch` — create, submit, verify, check
- `corven_dispute` — file, vote, get, claim_reward
- `corven_upload_ipfs` — upload to IPFS via Pinata
- `corven_help` — protocol guide with workflows

Standard pattern: `register*Tools(server)` per domain, `executeOrPrepare()` for wallet ops, `formatReadResult(data, label)`/`formatTxResult(result)` for output.

## Environment

`.env.example` in each directory. `contracts/.env`: PRIVATE_KEY, BASESCAN_API_KEY. `agents/.env`: CLIENT_PRIVATE_KEY, WORKER_PRIVATE_KEY, ANTHROPIC_API_KEY, contract addresses, Pinata keys. `frontend/.env.local`: NEXT_PUBLIC_* addresses, WalletConnect project ID.

## Model Mapping

| Task | Model |
|------|-------|
| Primary logic | `openrouter/hunter-alpha` |
| Vision/depth | `openrouter/healer-alpha` |
| 3D/Three.js | `google/gemma-3-27b-it:free` |

## Skills

**Graphify** (`/graphify`) -- knowledge graph. **Superpowers** (`/superpowers`) -- brainstorm->plan->execute. **Excalidraw** (`/excalidraw`) -- architecture diagrams. **UI-UX Pro Max** -- frontend audit.

## Commands

| Directory | Command | Notes |
|-----------|---------|-------|
| contracts | `npx hardhat compile/test` | Tests: 116 |
| contracts | `npx hardhat node` | Local node :8545 |
| agents | `npx tsx demo.ts` | Full client->worker->verify |
| agents | `npx tsx register.ts` | Register on-chain |
| frontend | `npm run dev/build/lint` | Dev :3000 |
| mcp | `npm run build && npm start` | MCP server (25 tools) |
| covenant-sdk-python | `pip install -e .` | Python SDK |
| cli | `npm run build && npm start` | CLI tool |
| root | `./demo.sh local` | Local demo (free) |
| root | `./demo.sh` | Live Base Sepolia |

## Graphify

Knowledge graph at `graphify-out/`. Read `GRAPH_REPORT.md` for god nodes before architecture work. Prefer `graphify query/path/explain` over grep for cross-module questions -- they traverse EXTRACTED + INFERRED edges. Run `graphify update .` after modifying code.

```bash
/graphify . --update          # Build/incremental update
graphify query "..."          # Architecture questions
graphify path "A" "B"         # Trace module connections
```
