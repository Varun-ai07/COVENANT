# COVENANT Developer Guide

Complete reference for the COVENANT protocol codebase. This document explains every directory, file, and component — what it does, how it works, and how to work with it.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Smart Contracts (V4)](#smart-contracts-v4)
3. [MCP Server](#mcp-server)
4. [Offchain Services](#offchain-services)
5. [Testing](#testing)
6. [Deployment](#deployment)
7. [Architecture Flow](#architecture-flow)

---

## Project Structure

```
COVENANT/
├── contracts/                    # Smart contracts (Hardhat project)
│   ├── contracts/
│   │   ├── v4/                   # ← CURRENT PRODUCTION VERSION
│   │   │   ├── interfaces/       # Solidity interfaces
│   │   │   ├── libraries/        # Shared types
│   │   │   ├── CovenantIdentity.sol
│   │   │   ├── CovenantEscrow.sol
│   │   │   ├── CovenantSettlement.sol
│   │   │   ├── CovenantArbitration.sol
│   │   │   ├── CovenantGovernance.sol
│   │   │   └── CovenantAttestation.sol
│   │   ├── v3/                   # Previous version (reference)
│   │   └── *.sol                 # Legacy contracts (v1/v2)
│   ├── test/
│   │   ├── v4/                   # V4 tests (31 tests)
│   │   ├── v3/                   # V3 tests (43 tests)
│   │   └── *.cjs                 # Legacy tests
│   ├── scripts/
│   │   ├── v4/deploy.cjs         # V4 deployment script
│   │   └── *.cjs                 # Legacy scripts
│   ├── hardhat.config.cjs        # Hardhat configuration
│   ├── deployed-addresses.json   # Deployed contract addresses
│   └── .env                      # Environment variables
├── mcp/                          # MCP Server (TypeScript)
│   ├── src/
│   │   ├── abis/                 # Contract ABIs
│   │   │   ├── v4/               # ← V4 ABIs (current)
│   │   │   ├── v2/               # V2 ABIs (reference)
│   │   │   └── *.json            # V1 ABIs (legacy)
│   │   ├── handlers/             # Tool handler implementations
│   │   ├── lib/                  # Shared utilities
│   │   ├── tools/                # MCP tool definitions
│   │   ├── config.ts             # Configuration & contract addresses
│   │   ├── server.ts             # MCP server entry point
│   │   └── index.ts              # Package entry point
│   └── package.json
├── offchain/                     # Offchain services
│   ├── src/
│   │   ├── index.ts              # Main exports
│   │   ├── receipt-engine.ts     # Signed receipt management
│   │   ├── reputation-oracle.ts  # Off-chain reputation computation
│   │   ├── capability-manager.ts # Delegation management
│   │   └── types.ts              # TypeScript types
│   └── test/
├── covenant-sdk/                 # TypeScript SDK
├── covenant-sdk-python/          # Python SDK
├── agents/                       # Example agents
├── docs/                         # Documentation
├── examples/                     # Usage examples
├── REDESIGN.md                   # Full protocol redesign document
└── DEVELOPER_GUIDE.md            # This file
```

---

## Smart Contracts (V4)

### Core Architecture

V4 follows a **minimal trust layer** philosophy: only 6 contracts handle all protocol trust guarantees. Everything else is off-chain.

### CovenantIdentity (`contracts/v4/CovenantIdentity.sol`)

**Purpose:** The trust root. Every agent interaction starts here.

**What it does:**
- Registers agents with a minimum stake (ETH)
- Stores on-chain: address, stake, reputation score, metadata root, active status
- Manages capability delegation (time-bounded, value-limited permissions)
- Maintains the reputation Merkle root (updated by oracle)

**Storage per agent:** 64 bytes

**Key functions:**
```solidity
register(uint96 stake, bytes32 metadataRoot) payable  // Register new agent
withdrawStake(uint96 amount)                          // Withdraw excess stake
grantCapability(address agent, bytes32 capHash, uint32 expiry, uint128 valueLimit)  // Delegate permission
hasCapability(address agent, bytes32 capHash) view    // Check capability
updateReputationRoot(bytes32 newRoot, uint256 epoch, bytes sig)  // Oracle updates root
```

**Gas cost:** ~25K for registration

---

### CovenantEscrow (`contracts/v4/CovenantEscrow.sol`)

**Purpose:** The core trust primitive. Locks funds until conditions are met.

**What it does:**
- Creates tasks with client, worker, amount, deadline, metadata hash
- Manages the task lifecycle: Created → Funded → Submitted → Completed/Failed
- Supports batch settlement (owner can settle multiple tasks in one tx)
- Authorized settlement and arbitration contracts can act on tasks

**Storage per task:** 96 bytes

**Key functions:**
```solidity
createTask(address worker, uint128 amount, uint32 deadline, bytes32 metaHash) payable
submitWork(uint256 taskId, bytes32 deliverableHash)
completeTask(uint256 taskId, bytes calldata clientSignature)
batchSettle(uint256[] taskIds, uint128[] amounts, bytes[] signatures)  // Batch settlement
```

**Task states:** None(0) → Created(1) → Funded(2) → Submitted(3) → Completed(5) / Failed(6) / Disputed(4) / Cancelled(7)

---

### CovenantSettlement (`contracts/v4/CovenantSettlement.sol`)

**Purpose:** Payment infrastructure. Handles streaming and receipt-based settlement.

**What it does:**
- Creates payment streams (continuous ETH flow)
- Settles signed EIP-712 receipts (off-chain agreement → on-chain settlement)
- Batch settlement of multiple receipts in one transaction
- No on-chain computation for receipt verification — just signature check

**Key feature: Signed Receipts**
```solidity
struct ReceiptEnvelope {
    address payer;
    address payee;
    uint128 amount;
    uint256 nonce;      // Replay protection
    uint256 chainId;    // Chain-specific
}
```

Agents sign receipts off-chain. Settlement contract validates signatures and transfers ETH. This enables sub-second agent interactions with zero gas until settlement.

---

### CovenantArbitration (`contracts/v4/CovenantArbitration.sol`)

**Purpose:** Dispute resolution with economic stakes.

**What it does:**
- Creates disputes for tasks (client or worker can initiate)
- Requires minimum stake from both parties
- Arbiter submits signed ruling (ECDSA)
- Settlement executes the ruling (client wins, worker wins, or split)

**Flow:**
1. Party creates dispute → task enters disputed state
2. Both parties stake ETH
3. Arbiter reviews evidence and submits ruling
4. Settlement distributes funds according to ruling

---

### CovenantGovernance (`contracts/v4/CovenantGovernance.sol`)

**Purpose:** Protocol governance with off-chain voting and on-chain execution.

**What it does:**
- Creates proposals (target contract + calldata + voting period)
- Accepts aggregated votes via guardian signature
- Executes proposals after timelock (1-day minimum delay)
- Guardian can emergency pause
- Vetoer can veto proposals

**Security features:**
- 67% supermajority required for execution
- Quorum enforcement
- 48-hour timelock before execution
- Emergency pause by guardian

---

### CovenantAttestation (`contracts/v4/CovenantAttestation.sol`)

**Purpose:** Verifiable credentials for the agent economy.

**What it does:**
- Registers schemas (credential types)
- Registers authorized issuers
- Issues attestations (issuer → subject, with schema + data hash + expiry)
- Supports batch attestation
- Attestations can be revoked

**Use cases:**
- Agent capability credentials
- Task completion receipts
- Reputation proofs
- Compliance certificates

---

## MCP Server

### Purpose
The MCP server exposes COVENANT's protocol as tools that AI assistants (Claude Code, Cursor, Windsurf) can use directly.

### Key Files

| File | Purpose |
|------|---------|
| `src/config.ts` | Contract addresses, ABIs, wallet setup. **Update addresses here after deployment.** |
| `src/server.ts` | MCP server entry point. Registers all tools. |
| `src/tools/*.ts` | Tool definitions (name, description, parameters) |
| `src/handlers/*.ts` | Tool implementations (what happens when tool is called) |
| `src/abis/v4/*.json` | V4 contract ABIs (copied from Hardhat artifacts) |

### Adding a New Tool

1. Define the tool in `src/tools/`:
```typescript
export const myTool = {
  name: "covenant_my_tool",
  description: "Does something useful",
  inputSchema: {
    type: "object",
    properties: {
      param: { type: "string", description: "Parameter description" }
    }
  }
};
```

2. Implement the handler in `src/handlers/`:
```typescript
export async function handleMyTool(param: string) {
  const contract = getContract({ address: CONTRACTS.TaskEscrow, abi: loadAbi("TaskEscrow") });
  const result = await publicClient.readContract({ ... });
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
```

3. Register in `src/server.ts`

### Configuration

Set these environment variables:
```bash
PRIVATE_KEY=0x...                    # Wallet private key
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org  # RPC endpoint
CONTRACT_VERSION=v4                  # Use v4 contracts (default)
```

---

## Offchain Services

### Purpose
Off-chain computation that doesn't need blockchain trust guarantees.

### ReceiptEngine (`offchain/src/receipt-engine.ts`)

**What it does:** Manages signed EIP-712 receipts for agent interactions.

```typescript
const engine = new ReceiptEngine(config);

// Create a receipt (off-chain)
const receiptId = engine.createReceipt(payer, payee, amount, payerSignature);

// Get unsettled receipts
const pending = engine.getUnsettledReceipts();
```

**Key insight:** Receipts are signed off-chain. Only settlement goes on-chain.

### ReputationOracle (`offchain/src/reputation-oracle.ts`)

**What it does:** Computes agent reputation scores using Bayesian smoothing.

```typescript
const oracle = new ReputationOracle(config);

// Record outcomes
oracle.recordTaskCompletion(agent, true);  // Successful
oracle.recordDispute(agent, false);         // Lost dispute

// Get stats
const stats = oracle.getStats(agent);
// { score: 750, tier: "established", completedTasks: 42, ... }

// Generate Merkle root for on-chain update
const root = oracle.computeMerkleRoot();
```

**Reputation formula:**
- Starts at 500 (Bayesian prior)
- Successful tasks: +5 to +15
- Lost disputes: -20
- New agents pulled toward mean (prevents gaming)

### CapabilityManager (`offchain/src/capability-manager.ts`)

**What it does:** Manages delegated capabilities for session keys.

```typescript
const manager = new CapabilityManager(config);

// Grant capability
manager.grantCapability(agent, CAPABILITY_HASH, expiry, valueLimit);

// Check capability
manager.hasCapability(agent, CAPABILITY_HASH);  // true/false
```

**Capability types:**
- `CREATE_TASK` — Can create tasks on behalf of agent
- `SUBMIT_WORK` — Can submit work
- `MANAGE_ESCROW` — Can manage escrow operations
- `ARBITRATE` — Can participate in arbitration
- `ATTEST` — Can issue attestations

---

## Testing

### Running Tests

```bash
# Run all V4 tests (31 tests)
cd contracts
npx hardhat test --grep "V4"

# Run all V3 tests (43 tests)
npx hardhat test --grep "V3"

# Run all tests (74 tests)
npx hardhat test --grep "V3|V4"

# Run specific test file
npx hardhat test test/v4/CovenantIdentity.test.cjs
```

### Test Structure

Each test file follows this pattern:
1. **Fixture** — Deploys contracts and sets up initial state
2. **Describe blocks** — Group related tests
3. **Assertions** — Verify expected behavior

Example fixture:
```typescript
async function deployIdentityFixture() {
  const [owner, oracle, agent1] = await ethers.getSigners();
  const Identity = await ethers.getContractFactory("contracts/v4/CovenantIdentity.sol:CovenantIdentity");
  const identity = await Identity.deploy();
  await identity.initialize(MIN_STAKE, oracle.address);
  return { identity, owner, oracle, agent1 };
}
```

**Important:** V4 tests use fully qualified contract names (`contracts/v4/...`) to avoid name collisions with V3.

---

## Deployment

### Prerequisites

1. Private key with ETH on Base Sepolia
2. Basescan API key for verification
3. Environment variables in `contracts/.env`:
```bash
PRIVATE_KEY=0x...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=...
```

### Deploy to Base Sepolia

```bash
cd contracts
npx hardhat run scripts/v4/deploy.cjs --network baseSepolia
```

This will:
1. Deploy all 6 V4 contracts
2. Initialize them with correct parameters
3. Wire them together (Escrow → Arbitration, Escrow → Settlement)
4. Verify all contracts on Basescan
5. Save addresses to `deployed-addresses.json`

### After Deployment

1. Update `mcp/src/config.ts` with new addresses (in `_v4` object)
2. Copy new ABIs: `Get-ChildItem contracts/artifacts/contracts/v4/ -Recurse -Filter "*.json" | ...`
3. Update `deployed-addresses.json` (done automatically by deploy script)

### Contract Wiring

The deploy script automatically wires contracts:
- `CovenantEscrow.setAuthorizedArbitration(CovenantArbitration)` — Allows arbitration to settle disputes
- `CovenantEscrow.setAuthorizedSettlement(CovenantSettlement)` — Allows settlement to batch-settle
- `CovenantAttestation.registerIssuer(deployer)` — Allows deployer to issue attestations

---

## Architecture Flow

### Agent Registration Flow
```
1. Agent calls CovenantIdentity.register() with ETH stake
2. Identity stores: address, stake, reputation=500, metadataRoot
3. Agent is now active and can interact with protocol
```

### Task Lifecycle Flow
```
1. Client calls CovenantEscrow.createTask() with ETH
2. Task created in Created/Funded state
3. Worker calls submitWork() with deliverable hash
4. Client signs completion receipt (off-chain)
5. Worker calls completeTask() with client signature
6. ETH released to worker
```

### Batch Settlement Flow
```
1. Multiple agents sign receipts off-chain
2. Receipts accumulated in offchain ReceiptEngine
3. Owner calls CovenantEscrow.batchSettle() with arrays
4. All tasks settled in single transaction
```

### Dispute Resolution Flow
```
1. Party calls CovenantArbitration.createDispute()
2. Both parties stake ETH
3. Arbiter reviews evidence
4. Arbiter submits signed ruling
5. Anyone calls settleDispute() to execute ruling
6. Funds distributed according to ruling
```

### Governance Flow
```
1. Proposer calls CovenantGovernance.propose()
2. Voting period begins (1-30 days)
3. Guardian aggregates off-chain votes, submits signature
4. After voting ends + timelock (1 day), anyone can execute
5. Proposal executes if 67% approval + quorum met
```

---

## Common Tasks

### Adding a New Contract

1. Create `contracts/v4/MyContract.sol`
2. Create `contracts/v4/interfaces/IMyContract.sol`
3. Add test in `contracts/test/v4/MyContract.test.cjs`
4. Run `npx hardhat compile`
5. Run `npx hardhat test --grep "MyContract"`

### Updating Contract Addresses

1. Edit `mcp/src/config.ts` — update `_v4` object
2. Edit `contracts/deployed-addresses.json`
3. Search project for old address: `grep -r "0xOLD_ADDRESS" .`

### Debugging Failed Tests

1. Check if contract compiles: `npx hardhat compile`
2. Run specific test: `npx hardhat test test/v4/MyTest.test.cjs`
3. Check error message — usually a `require()` failure
4. For signature issues, verify the message hash matches between test and contract

---

## Gas Costs (Base L2)

| Operation | Gas | ETH (at 0.1 gwei) |
|-----------|-----|-------------------|
| Agent Registration | ~25,000 | ~0.0000025 ETH |
| Task Create + Fund | ~40,000 | ~0.000004 ETH |
| Work Submission | ~30,000 | ~0.000003 ETH |
| Task Completion | ~30,000 | ~0.000003 ETH |
| Dispute Create | ~50,000 | ~0.000005 ETH |
| Batch Settle (100 tasks) | ~500,000 | ~0.00005 ETH |
| Receipt Settlement | ~45,000 | ~0.0000045 ETH |

---

## Troubleshooting

### "Multiple artifacts for contract" Error
V3 and V4 have same contract names. Use fully qualified names in tests:
```typescript
// Wrong
await ethers.getContractFactory("CovenantIdentity");

// Right
await ethers.getContractFactory("contracts/v4/CovenantIdentity.sol:CovenantIdentity");
```

### "Initializable: contract is already initialized"
V4 contracts don't use `_disableInitializers()` — they're designed for both direct deployment and proxy patterns.

### "Invalid signature" in Tests
Ensure the test constructs the message hash identically to the contract:
- Contract uses `abi.encodePacked()` → Test uses `solidityPacked()`
- Contract uses `toEthSignedMessageHash()` → Test uses `signMessage()`
