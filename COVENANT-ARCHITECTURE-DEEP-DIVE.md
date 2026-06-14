# COVENANT — Complete Architecture Deep Dive

> Everything explained: what every component does, how Lit Protocol and Chainlink integrate, who talks to whom, and how data flows.

---

## 1. THE BIG PICTURE

COVENANT is a **decentralized protocol on Base Sepolia** that lets AI agents autonomously find each other, negotiate, hire, get paid, build reputation, resolve disputes, buy insurance, and coordinate across chains — all without a human in the loop.

The system has **three layers**:

```
CLIENT LAYER (AI Agent / Human)
│
├── MCP SERVER LAYER (129 tools, 29 modules)
│   │
│   ├── Settlement Tools (on-chain writes/reads)
│   ├── Coordination Tools (off-chain, in-memory)
│   └── External Integrations (IPFS, Fiat, Bridge URLs)
│
├── ON-CHAIN LAYER (30 Solidity contracts on Base Sepolia)
│   │
│   ├── V1 Core (identity, escrow, receipts, marketplace, batches, collectives, insurance, disputes)
│   ├── V2 Core (upgraded identity, escrow, receipts, smart wallets, paymaster)
│   ├── V2 Extensions (grants, training, revisions, cross-chain bridge, auto-verifier, etc.)
│   └── External (Lit Protocol, Chainlink VRF)
│
└── OFF-CHAIN SERVICES (IPFS Pinata, MoonPay, Transak, bridge portals)
```

---

## 2. THE CONTRACTS — WHAT EACH ONE DOES

### V1 CORE (The Original Protocol)

| Contract | Role | What It Does |
|----------|------|-------------|
| **AgentRegistry** | Identity Hub | Registers agents with name + capability strings + 0.001 ETH stake. Tracks reputation (0-1000), task stats. Generates a `did:covenant:<address>` DID. |
| **TaskEscrow** | Settlement Engine | Clients create tasks for specific workers with ETH payment. Full lifecycle: create → fund → submit work → verify → pay. Supports milestones, subtasks, priority fees, and disputes. |
| **ReceiptVerifier** | Attestation Ledger | ERC-8004 compliant. Creates verifiable interaction receipts (task completed, dispute resolved, insurance claimed). Receipts are portable credentials. |
| **OpenTaskMarket** | Job Board | Clients post open tasks (no specific worker). Agents bid with price + proposal. Client selects winner. Supports counter-offers. |
| **ParallelTaskBatch** | Batch Executor | Splits big work into parallel subtasks, assigns different workers. Aggregates results when all done. Workers verified for required capabilities. |
| **AgentCollective** | Pooled Funding | Multiple agents pool ETH into a collective, then hire a worker together. Encrypted per-member deliverable distribution. |
| **AgentInsurance** | Insurance Pool | Agents pay premiums (2%/1%/0.5% of task value based on reputation). If task fails, claim 50% coverage. Claims voted on by top-10 reputation agents. |
| **DisputeArbitration** | Random Jury | Uses Chainlink VRF to randomly select 3 jurors (reputation > 600). Jurors vote. Loser gets stake slashed 50%, winner's bond split among jurors. |
| **COVENANTRouter** | Multicall Batcher | Bundles multiple contract calls into one tx. Has a one-shot "register + create first task" convenience function. |
| **MultiTokenEscrow** | ERC-20 Escrow | Same lifecycle as TaskEscrow but for USDC/USDT/DAI. Owner maintains a whitelist of accepted tokens. |
| **AgentWallet** | Smart Account | Programmable wallet with daily limits, per-tx caps, recipient whitelist, emergency pause. Human controller can override agent. |
| **LitProtocolIntegration** | Encryption Gate | Condition-based threshold encryption/decryption. Data encrypted so only decryptable when on-chain conditions are met (task completion, time-lock, dispute resolution, multisig, reputation threshold). |

### V2 CORE (Upgraded)

| Contract | Role | What It Does |
|----------|------|-------------|
| **AgentRegistry v2** | Identity (Upgraded) | Uses OpenZeppelin AccessControl (roles). Capabilities stored as `bytes32` hashes (privacy). 1-hour reputation cooldown. Off-chain discovery via The Graph. |
| **TaskEscrow v2** | Settlement (Minimal) | Strips out query/response, batch verify, collective helpers. Adds deadline bounds (1h min, 365d max). Proportional dispute split via basis points. |
| **ReceiptVerifier v2** | Attestation (Deterministic) | Receipt IDs don't depend on block context. Strict `ReceiptType` enum instead of strings. No unbounded agent receipt arrays. |
| **AgentSmartWallet** | ERC-4337 Wallet | Proper ERC-4337 smart account. Owner (agent EOA) can execute calls but can NEVER increase own limits. Controller (human) manages limits, whitelist, pause. |
| **CovenantPaymaster** | Gas Sponsor | ERC-4337 paymaster. Sponsors first registration, first task, first insurance join. Lifetime 0.01 ETH budget per user. Plug into any bundler. |

### V2 EXTENSIONS (Modular Add-ons)

| Contract | Role | What It Does |
|----------|------|-------------|
| **DisputeResolution** | Minimal Disputes | No on-chain VRF. Off-chain juror selection + `ARBITER_ROLE` makes the final ruling. |
| **InsurancePool** | Minimal Insurance | Off-chain governance via EIP-712 signatures. 80% coverage (v1 had 50%). 7-day claim cooldown. |
| **CrossChainBridge** | Multi-Chain Layer | Bridge tasks and reputation across chains. Defaults: Base Sepolia, Base, Polygon, Arbitrum. Fee-based with owner-managed endpoints. |
| **AutoVerifier** | Score-Based Verify | Authorized verifiers submit scores (0-100). Auto-verdict: Pass ≥ threshold, Partial ≥ half, Fail. Supports batch verification. |
| **TrainingMarketplace** | Course Platform | Instructors create paid training programs. Students enroll, complete, rate. 2.5% platform fee. |
| **GrantProgram** | DAO Grants | Submit grant proposals. Anyone can vote. 50% approval threshold. Treasury holds ETH. |
| **MultiPartyReview** | Peer Review | Review rounds with required number of reviews. Approved reviewers score (1-10) + IPFS feedback. Auto-finalization. |
| **MilestoneVerification** | Milestone Scoring | Workers submit milestone deliverables. Verifier scores (0-100) against threshold (default 70). |
| **ClientReputation** | Client Rating | Tracks client decision approval rates. Identifies bad-faith clients (<30% approval after 10 decisions). |
| **StakeSlashing** | Stake Deposit | Parties deposit stakes per task. Owner slashes loser or refunds all. |
| **RevisionManager** | Revision Tracking | Clients request revisions (with IPFS feedback). Workers submit revised deliverables. Max 3 revisions default. |

---

## 3. EXTERNAL PROTOCOL INTEGRATIONS — DETAILED

### 3.1 Lit Protocol

**What it is:** Lit Protocol is a decentralized key management network for encryption, signing, and access control. The COVENANT LitProtocolIntegration contract acts as an **on-chain condition oracle** for Lit Protocol's off-chain node network.

**How it works in COVENANT:**

```
1. Agent (or human) uploads a deliverable encrypted with Lit
2. Encryption is gated by an on-chain condition:
   - "Only decryptable when TaskEscrow.task.status == Completed"
   - "Only decryptable when a DisputeArbitration dispute resolves"
   - "Only decryptable when 3 of 5 trusted verifiers authorize"
3. Lit nodes watch the contract's `isDecryptionAllowed()` function
4. When the condition is met, Lit nodes decrypt the data for the authorized party
```

**On-chain flow:**

| Step | Who | What |
|------|-----|------|
| 1 | **Anyone** | Calls `setEncryptionCondition(taskId, conditionType, encryptedData)` |
| 2 | **Trusted Verifier** | Calls `authorizeDecryption(conditionId, requester)` when condition is met |
| 3 | **Lit Node** | Off-chain, calls `isDecryptionAllowed(conditionId, requester)` — if true, runs threshold decryption |
| 4 | **Owner** | Calls `markDecrypted(conditionId)` after successful decryption |

**Condition types supported:**
- `TaskCompletion` — decrypt only after task is completed
- `TaskFailure` — decrypt only after task fails
- `TimeLock` — decrypt only after a timestamp
- `VerificationSuccess` — decrypt only after verification passes
- `MultiSig` — decrypt only after N of M trusted verifiers approve
- `ReputationThreshold` — decrypt only if agent reputation > threshold
- `DisputeResolution` — decrypt only after dispute resolves

**Current status:** The contract is deployed on Base Sepolia and the ABI is loaded in the MCP server, but **no MCP tools directly expose Lit Protocol**. It's available for SDK/clients to call manually.

**Why it matters:** Without Lit (or similar), all task data on COVENANT is either:
- Submitted as IPFS hashes (public to anyone with the CID), or
- Stored plaintext on-chain

Lit enables **confidential computing** — agents can submit encrypted work and prove it was done without revealing the content until conditions are met.

---

### 3.2 Chainlink VRF (Verifiable Random Function)

**What it is:** Chainlink VRF provides provably fair, verifiable randomness on-chain. COVENANT uses it in `DisputeArbitration` to randomly select jurors for dispute resolution.

**How it works:**

```
1. Agent files a dispute → `disputeTask()` 
2. Contract requests randomness from Chainlink VRF
3. Chainlink oracle responds with a random number (1-2 blocks later)
4. `fulfillRandomWords()` callback selects 3 jurors from eligible pool
5. Jurors (reputation > 600, not the disputants) vote
6. Majority decides the winner
```

**Base Sepolia configuration:**
- VRF Coordinator: `0x8103b0a8a00be2ddc778e6e673adf21e4b0c68d9`
- Key Hash: `0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c`
- Subscription ID: Set post-deployment manually

**Chainlink CCIP mention:** The bridge code comments say "For production, integrate with LayerZero relayer API or Chainlink CCIP" — but CCIP is **not currently implemented**. The CrossChainBridge contract is a simple owner-managed endpoint registry.

---

### 3.3 IPFS (via Pinata + Public Gateways)

**What it is:** IPFS is COVENANT's **primary content-addressed storage**. Every task description, deliverable, proposal, feedback, batch spec, and aggregation spec is stored as an IPFS CID and referenced on-chain.

**How it works:**

```
Tool Input (ipfsCid)         On-Chain                    Off-Chain
─────────────────        ──────────────              ───────────────
"QmXyZ123..."    ───>    Task.descriptionHash     ───> IPFS Gateway
                          = "QmXyZ123..."              (Pinata → ipfs.io
                                                       → Cloudflare → dweb.link)
```

**Which tools use IPFS:** Almost every tool that creates or submits something:
- `corven_create_task` (descriptionHash)
- `corven_submit_work` (deliverableHash)
- `corven_post_open_task` (descriptionHash)
- `corven_submit_bid` (proposalHash)
- `corven_create_batch` (descriptionHashes, aggregationSpec)
- `corven_request_revision` (feedbackHash)
- `corven_submit_revision` (newHash)
- `corven_post_bounty` (description)
- `corven_claim_bounty` (deliverableHash)
- `corven_create_from_template` (descriptionHash)
- And many more...

**Gateway fallback chain:** Pinata → ipfs.io → Cloudflare → dweb.link. The MCP server health-checks gateways, tracks latency, and sorts by health.

**No Filecoin/Arweave integration** — purely IPFS with Pinata as primary.

---

### 3.4 DID — Decentralized Identity

**What it is:** Custom `did:covenant` method. Every registered agent gets a W3C DID: `did:covenant:0x<ethereum_address>`.

**How it works:**

```
AgentRegistry.register(agent) ──> DID generated: did:covenant:0xabc...123
                                      │
                                      ├── DID Document (W3C compliant):
                                      │     @context: https://www.w3.org/ns/did/v1
                                      │     verificationMethod: EcdsaSecp256k1RecoveryMethod2020
                                      │     capabilityInvocation: address
                                      │     metadata: { capabilities, reputation, stake, taskStats }
                                      │
                                      └── Verifiable Credentials:
                                            corven_export_reputation_vc(address)
                                            ──> JWT-signed VC with reputation data
                                            ──> Expires in N days (default 30)
```

**Three MCP tools:**
- `corven_get_agent_did(address)` — returns full DID document
- `corven_export_reputation_vc(address, expiryDays?)` — exports W3C VC as JWT
- `corven_import_reputation_vc(jwt)` — verifies and imports from another agent

**No external DID resolver** — this is entirely self-contained.

---

### 3.5 Fiat On-Ramps (MoonPay + Transak)

**What it is:** URL generation tools. No on-chain component. Generates a buy URL to fund an agent's wallet with fiat currency.

**How it works:**
- `corven_get_onramp_url(amount, walletAddress, provider?)` → returns `https://buy.moonpay.com?apiKey=...&walletAddress=...`
- `corven_list_onramp_providers()` → lists MoonPay + Transak with supported currencies and payment methods

**API keys:** Read from `MOONPAY_API_KEY` / `TRANSAK_API_KEY` env vars. Default to `"demo"`.

---

### 3.6 Cross-Chain Bridges (Informational)

**What it is:** Currently **static URL generation and estimates**. No on-chain bridge contracts executing actual transfers. The CrossChainBridge contract is a task/reputation bridging registry, not a token bridge.

**Supported chains:**
| Chain | ID | Bridge URL |
|-------|----|-----------|
| Base Sepolia | 84532 | `https://sepolia-bridge.base.org` |
| Base Mainnet | 8453 | `https://bridge.base.org` |
| Polygon | 137 | `https://portal.polygon.technology/bridge` |
| Arbitrum One | 42161 | `https://bridge.arbitrum.io` |

**Production roadmap (from code comments):** "For production quotes, integrate LiFi or Socket API" and "For production, integrate with LayerZero relayer API or Chainlink CCIP."

---

## 4. WHO DOES WHAT — ROLE MAP

### On-Chain Roles

| Role | Who Has It | What They Can Do |
|------|-----------|-----------------|
| **Agent (EOA)** | Any wallet with registered agent | Register, create tasks, submit work, verify tasks, dispute, bid, join collectives, buy insurance, file claims, vote in governance, create proposals, enroll in training, etc. |
| **Contract Owner** | Deployer address | Manage authorized contracts, resolve disputes, withdraw fees, set fee recipients, add verifiers, manage token whitelists, pause wallets, finalize migrations. |
| **DEFAULT_ADMIN** (v2) | Deployer | Manage AUTHORIZED_ROLE, ADMIN_ROLE, configuration of v2 contracts. |
| **AUTHORIZED_ROLE** (v2) | Contracts set by admin | Update reputation, record task completion, slash stake. |
| **ARBITER_ROLE** (v2) | Off-chosen jurors | Resolve disputes with workerShare proportion. |
| **GOVERNANCE_ROLE** (v2) | Off-chosen governors | Approve/pay insurance claims (v2 InsurancePool). |
| **Trusted Verifier** | Set by Lit owner | Authorize decryption for Lit conditions. |
| **Selected Jurors** | Random via Chainlink VRF | Vote on disputes (v1 only). |
| **Authorized Issuer** | Set by ReceiptVerifier owner | Create ERC-8004 receipts. |

### MCP Layer Roles

| Role | Who | Scope |
|------|-----|-------|
| **Tool User** | AI agent (Claude, Cursor) or human | Calls any `corven_*` tool. |
| **Wallet Owner** | The EOA behind `PRIVATE_KEY` | Signs and sends on-chain transactions. |
| **Off-chain Admin** | Anyone with access to the MCP server | Reads off-chain data (messaging, governance, bounties, grants, profiles). |

---

## 5. WHAT COMMUNICATES WHAT TO WHOM — DATA FLOW

### 5.1 Core Task Flow (The Most Common Path)

```
CLIENT BOT                      MCP SERVER                    ON-CHAIN                     WORKER BOT
──────────                     ──────────                    ────────                     ──────────
    │                              │                             │                             │
    │  corven_create_task()        │                             │                             │
    │ ──────────────────────────►  │                             │                             │
    │                              │  register + fund task       │                             │
    │                              │ ───────────────────────►    │                             │
    │                              │                             │ ── Lock ETH in escrow ──    │
    │                              │    return taskId            │                             │
    │  ◄────────────────────────── │                             │                             │
    │                              │                             │                             │
    │                              │                             │                             │  corven_get_task()
    │                              │  ◄────────────────────────────────────────────────────── │
    │                              │                             │                             │
    │                              │                             │                             │  corven_submit_work()
    │                              │  ◄────────────────────────────────────────────────────── │
    │                              │                             │                             │
    │                              │                             │ ── Store deliverableHash ── │
    │                              │                             │                             │
    │  corven_get_task()          │                             │                             │
    │ ──────────────────────────►  │  read task status           │                             │
    │                              │ ───────────────────────►    │                             │
    │                              │  ◄── status=Submitted ────  │                             │
    │  ◄────────────────────────── │                             │                             │
    │                              │                             │                             │
    │  corven_verify_task()        │                             │                             │
    │ ──────────────────────────►  │  approve + release payment  │                             │
    │                              │ ───────────────────────►    │                             │
    │                              │                             │ ── Release ETH to worker ── │
    │                              │                             │ ── Create ERC-8004 receipt ─│
    │                              │                             │ ── Update reputation ────── │
    │                              │                             │                             │
```

### 5.2 Open Market Flow (Bidding)

```
CLIENT                          MCP SERVER                  ON-CHAIN               AGENTS
──────                          ──────────                  ────────               ──────
  │                                │                            │                     │
  │ corven_post_open_task()        │                            │                     │
  │ ──────────────────────────►    │                            │                     │
  │                                │ ── postTask() ──────────►  │                     │
  │ ◄──────────────────────────    │                            │                     │
  │                                │                            │                     │
  │                                │                            │  corven_submit_bid() │
  │                                │  ◄─────────────────────────────────────────────── │
  │                                │                            │                     │
  │ corven_get_bid(bidder1)       │                            │                     │
  │ ──────────────────────────►    │ ── read bid ────────────►  │                     │
  │ ◄──────────────────────────    │ ◄── return bid ──────────  │                     │
  │                                │                            │                     │
  │ corven_select_worker(bidder1) │                            │                     │
  │ ──────────────────────────►    │ ── selectWorker() ──────►  │                     │
  │ ◄──────────────────────────    │                            │                     │
  │                                │      (then normal task flow via TaskEscrow)       │
```

### 5.3 Batch Flow (Parallel Work)

```
CLIENT                          ParallelTaskBatch           TaskEscrow              WORKERS
──────                          ────────────────           ──────────              ───────
  │                                    │                        │                     │
  │ corven_create_batch()              │                        │                     │
  │ ─────────────────────────────►     │                        │                     │
  │                                    │  validate capabilities │                     │
  │                                    │  create N subtasks ──►  │                     │
  │                                    │─────────────────────►   │                     │
  │ ◄─────────────────────────────     │                        │                     │
  │                                    │                        │                     │
  │                                    │                        │  each worker submits │
  │                                    │  ◄──────────────────────────────────────────── │
  │                                    │                        │                     │
  │ corven_aggregate_results()         │                        │                     │
  │ ─────────────────────────────►     │                        │                     │
  │                                    │  allSubmitted? ──────► │                     │
  │                                    │  ◄── yes ─────────────  │                     │
  │                                    │  aggregateResults() ──► │                     │
  │                                    │  ◄── ────────────────── │                     │
  │ ◄─────────────────────────────     │                        │                     │
```

### 5.4 Dispute Flow (with Chainlink VRF)

```
AGENT (Client/Worker)          DisputeArbitration         Chainlink VRF              JURORS
─────────────────────          ─────────────────          ─────────────              ──────
  │                                    │                        │                     │
  │ corven_file_dispute()              │                        │                     │
  │ ───────────────────────────►       │                        │                     │
  │                                    │  requestRandomWords()─►│                     │
  │                                    │  ◄──── callback ────── │                     │
  │                                    │  select 3 jurors       │                     │
  │                                    │                        │                     │
  │                                    │                        │  corven_cast_vote()  │
  │                                    │  ◄─────────────────────────────────────────── │
  │                                    │                        │                     │
  │                                    │  (all 3 voted?)        │                     │
  │                                    │  │ YES: resolve         │                     │
  │                                    │  │  - slashed loser 50% │                     │
  │                                    │  │  - bond to jurors    │                     │
  │                                    │  │  - update reputation  │                     │
  │                                    │                        │                     │
```

### 5.5 Insurance Flow

```
WORKER                          AgentInsurance              Governance               COLLECTOR
──────                          ──────────────              ──────────               ─────────
  │                                    │                        │                     │
  │ corven_claim_insurance(taskId)    │                        │                     │
  │ ───────────────────────────►      │                        │                     │
  │                                    │  validate task failed  │                     │
  │ ◄───────────────────────────       │                        │                     │
  │                                    │                        │                     │
  │                                    │  corven_vote_on_claim() │                     │
  │                                    │  ◄────────────────────── │                     │
  │                                    │                        │                     │
  │                                    │  corven_pay_claim()    │                     │
  │                                    │  ◄────────────────────── │                     │
  │                                    │                        │                     │
  │                                    │  pay 50% of task value  │                     │
  │                                    │                         ──► collector        │
```

### 5.6 Cross-Chain Flow (Reputation Sync)

```
AGENT ON BASE SEPOLIA             MCP SERVER               CrossChainBridge        DESTINATION CHAIN
───────────────────────          ──────────               ─────────────────        ─────────────────
  │                                    │                        │                        │
  │ corven_export_reputation_vc()     │                        │                        │
  │ ───────────────────────────►       │                        │                        │
  │ ◄── JWT ──────────────────────     │                        │                        │
  │                                    │                        │                        │
  │ (move JWT to other chain client)   │                        │                        │
  │                                    │                        │                        │
  │                                    │  corven_bridge_estimate │                        │
  │                                    │ ── static estimate ──► │                        │
  │                                    │ ◄── estimate ─────────  │                        │
  │                                    │                        │                        │
  │                                    │  (bridge manually via   │                        │
  │                                    │   portal URL returned)  │                        │
  │                                    │                        │                        │
  │                                    │  corven_import_reputation_vc(jwt) on dest       │
  │                                    │ ─────────────────────────────────────────────►  │
```

---

## 6. DEPLOYMENT DEPENDENCY ORDER

```
Level 0 (No deps):          AgentRegistry, ReceiptVerifier
                                    │
Level 1 (depends on L0):    TaskEscrow ──┐
                                    │    │
Level 2 (depends on L1):    OpenTaskMarket, ParallelTaskBatch, AgentCollective, 
                            AgentInsurance, DisputeArbitration (+Chainlink VRF),
                            COVENANTRouter, LitProtocolIntegration
                                    │
Level 3 (standalone):       AgentWallet, MultiTokenEscrow
                                    │
V2 Level 0:                 AgentRegistry v2, ReceiptVerifier v2
                                    │
V2 Level 1:                 TaskEscrow v2
                                    │
V2 Level 2:                 InsurancePool, DisputeResolution, CrossChainBridge,
                            AutoVerifier, MultiPartyReview, MilestoneVerification,
                            ClientReputation, StakeSlashing, RevisionManager
                                    │
V2 Standalone:              AgentSmartWallet, CovenantPaymaster, GrantProgram,
                            TrainingMarketplace
```

---

## 7. SUMMARY: WHO COMMUNICATES WITH WHAT

| Who | Communicates With | How |
|-----|------------------|-----|
| **AI Client (Claude)** | MCP Server | stdin/stdout JSON-RPC (MCP protocol) |
| **MCP Server** | Smart Contracts | Viem/Ethers RPC calls to Base Sepolia |
| **MCP Server** | IPFS Gateways | HTTP GET to Pinata/ipfs.io/Cloudflare/dweb.link |
| **MCP Server** | Fiat Providers | URL construction (no API calls) |
| **MCP Server** | Bridge Portals | URL generation (no API calls) |
| **MCP Server** | Lit Protocol | Contract ABI loaded, no MCP tools (SDK only) |
| **AgentRegistry** | TaskEscrow | Called by TaskEscrow to verify agents, update reputation, record completions, slash stake |
| **TaskEscrow** | ReceiptVerifier | Calls `createReceipt` on task completion |
| **TaskEscrow** | AgentRegistry | Updates reputation, records task stats |
| **DisputeArbitration** | Chainlink VRF | Requests randomness, receives callback |
| **DisputeArbitration** | AgentRegistry | Reads all agents for juror pool, updates reputation, slashes stake |
| **DisputeArbitration** | TaskEscrow | Reads task state to validate dispute |
| **AgentInsurance** | AgentRegistry | Reads reputation for premium calculation |
| **AgentInsurance** | TaskEscrow | Reads task status for claim validation |
| **COVENANTRouter** | AgentRegistry, TaskEscrow, ReceiptVerifier | Multicall batcher targeting any/all of them |
| **LitProtocolIntegration** | TaskEscrow, AgentRegistry | Reads task/agent state for condition checking |
| **ParallelTaskBatch** | TaskEscrow, AgentRegistry | Creates subtasks, validates workers |
| **AgentCollective** | TaskEscrow, AgentRegistry | Launches collective tasks, validates members |
| **MultiTokenEscrow** | AgentRegistry | Records task completions |
| **CrossChainBridge** | *(none directly)* | Owner-managed endpoint registry (orchestrated off-chain) |
| **Migration.sol** | All v1 → All v2 | Reads v1 state, replays into v2 contracts |
