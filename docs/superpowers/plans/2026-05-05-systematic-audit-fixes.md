# COVENANT Systematic Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical, high, and medium issues found in the comprehensive audit across contracts, agents, and frontend — making the project compilable, secure, and clean.

**Architecture:** Three-layer fix following severity order: (1) Security & secrets first, (2) Compilation fixes, (3) Logic bugs, (4) Dead code cleanup, (5) Quality improvements. Each task is self-contained and independently committable.

**Tech Stack:** Solidity 0.8.24 (Hardhat), TypeScript (viem, tsx), Next.js 14 (React, wagmi, Tailwind)

---

## Phase 1: Security — Secrets & Credentials

### Task 1: Sanitize `.env.example` — Remove Exposed Keys

**Files:**
- Modify: `.env.example`

The root `.env.example` contains real Pinata API keys (line 22-23) and a full JWT token (lines 38-40). These must be replaced with empty placeholders.

- [ ] **Step 1: Replace `.env.example` with sanitized version**

Write the following content to `.env.example`:

```
# COVENANT Project Environment Variables
# Copy this to .env in each subdirectory as needed

# Deployer private key (for contract deployment)
PRIVATE_KEY=

# RPC URLs
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_RPC_URL=https://mainnet.base.org

# Basescan API key
BASESCAN_API_KEY=

# Agent private keys (generate fresh wallets for demo)
CLIENT_PRIVATE_KEY=
WORKER_PRIVATE_KEY=

# Anthropic API Key
ANTHROPIC_API_KEY=

# OpenRouter API Key (for LLM features)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=

# Pinata IPFS
PINATA_API_KEY=
PINATA_SECRET_KEY=

# WalletConnect (for frontend)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Contract addresses (filled after deployment)
NEXT_PUBLIC_REGISTRY_ADDRESS=
NEXT_PUBLIC_ESCROW_ADDRESS=
NEXT_PUBLIC_VERIFIER_ADDRESS=
REGISTRY_ADDRESS=
ESCROW_ADDRESS=
VERIFIER_ADDRESS=
```

- [ ] **Step 2: Verify no secrets remain**

Run: `grep -r "1f09750202ed98c1a197\|1f1111336991c0e0c603963f3b9f1b08\|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\|jpv.cosmic" .env.example agents/.env contracts/.env frontend/.env.local 2>/dev/null`
Expected: No output (no matches)

- [ ] **Step 3: Check if real `.env` files are gitignored**

Run: `git check-ignore agents/.env contracts/.env frontend/.env.local .env`
Expected: All files listed (meaning they're ignored)

If any `.env` file is NOT ignored, add it to `.gitignore`.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "security: remove exposed Pinata keys and JWT from .env.example"
```

---

### Task 2: Fix AgentInsurance — `payClaim` Access Control & Insolvency

**Files:**
- Modify: `contracts/contracts/AgentInsurance.sol`

Two critical bugs: (1) `payClaim` has no access control — anyone can trigger payouts, (2) the math is insolvent — pays out 75% but only deducts 50%.

- [ ] **Step 1: Read the contract and locate the bugs**

Read `contracts/contracts/AgentInsurance.sol` and identify:
- `payClaim` function (~line 280-310) — has no `onlyAuthorized` or claimant-only check
- The payout math: deducts 50% from pool, pays 50% to worker + 25% to client = 75% total

- [ ] **Step 2: Add access control to `payClaim`**

Add the following modifier requirement to `payClaim` so only the claimant (or an authorized contract) can trigger it:

```solidity
function payClaim(uint256 claimId) external {
    Claim storage claim = claims[requireValidClaim(claimId)];
    require(
        msg.sender == claim.claimant || authorizedContracts[msg.sender],
        "Not authorized to pay this claim"
    );
    // ... rest of function
```

Also add the `requireValidClaim` helper if it doesn't exist:

```solidity
function requireValidClaim(uint256 claimId) internal view returns (uint256) {
    require(claimId < claims.length, "Invalid claim ID");
    require(claims[claimId].approved, "Claim not approved");
    require(!claims[claimId].paid, "Claim already paid");
    return claimId;
}
```

- [ ] **Step 3: Fix the insolvency math**

The fix: either (a) increase pool deduction to 75% to match payout, or (b) reduce payout to match 50% deduction. Option (b) is safer for the pool:

Reduce `clientCompensation` from 25% to 0% (or a small fixed amount), so total payout ≤ pool deduction:

```solidity
// Before (broken): worker gets 50% + client gets 25% = 75% from 50% pool deduction
// After (fixed): only worker gets 50%, matching the 50% pool deduction
uint256 workerPayout = (taskValue * 5000) / 10000; // 50%
// Remove or set to 0: clientCompensation
poolBalance -= workerPayout;
payable(claim.claimant).transfer(workerPayout);
```

- [ ] **Step 4: Run insurance tests**

Run: `cd contracts && npx hardhat test test/AgentInsurance.test.js`
Expected: All existing tests pass (may need test adjustments for the new access control)

- [ ] **Step 5: Commit**

```bash
git add contracts/contracts/AgentInsurance.sol
git commit -m "fix: add access control to payClaim and fix insolvency math in AgentInsurance"
```

---

### Task 3: Fix `useNullifier` — Add Access Control

**Files:**
- Modify: `contracts/contracts/AgentRegistry.sol`

`useNullifier` is completely unrestricted — anyone can mark any nullifier as used, DoS-ing all ZK capability proofs.

- [ ] **Step 1: Add `onlyAuthorized` modifier to `useNullifier`**

In `contracts/contracts/AgentRegistry.sol`, around line 357-359:

```solidity
// Before:
function useNullifier(bytes32 nullifier) external {
    usedNullifiers[nullifier] = true;
}

// After:
function useNullifier(bytes32 nullifier) external {
    require(authorizedContracts[msg.sender] || msg.sender == owner(), "Not authorized");
    usedNullifiers[nullifier] = true;
}
```

- [ ] **Step 2: Run registry tests**

Run: `cd contracts && npx hardhat test test/AgentRegistry.test.js`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add contracts/contracts/AgentRegistry.sol
git commit -m "fix: restrict useNullifier to authorized callers only"
```

---

## Phase 2: Compilation Fixes — Contracts

### Task 4: Fix AgentRegistry.sol Compilation Errors

**Files:**
- Modify: `contracts/contracts/AgentRegistry.sol`

Two compilation errors: (1) `totalValueTransferred` should be `totalValueTransacted` (line ~231), (2) undefined `Groth16Verifier` type (line ~329), (3) `verifyProof` doesn't return its result.

- [ ] **Step 1: Fix the field name typo**

Find `totalValueTransferred` (around line 231) and replace with `totalValueTransacted`:

```solidity
// Before:
agents[agent].totalValueTransferred += value;

// After:
agents[agent].totalValueTransacted += value;
```

- [ ] **Step 2: Add the Groth16Verifier import or fix the type**

The file references `Groth16Verifier(reputationVerifier).verifyProof(...)` but doesn't import the interface. Add this interface at the top of the contract (after the other imports):

```solidity
interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[4] calldata input
    ) external view returns (bool);
}
```

Then change the cast from `Groth16Verifier(...)` to `IGroth16Verifier(...)`.

- [ ] **Step 3: Fix `verifyProof` to return the result**

```solidity
// Before:
function verifyProof(...) external view returns (bool) {
    // ...
    Groth16Verifier(reputationVerifier).verifyProof(
        proofA, proofB, proofC, proofPublicSignals
    );
}

// After:
function verifyProof(...) external view returns (bool) {
    // ...
    return IGroth16Verifier(reputationVerifier).verifyProof(
        proofA, proofB, proofC, proofPublicSignals
    );
}
```

- [ ] **Step 4: Compile contracts**

Run: `cd contracts && npx hardhat compile`
Expected: Compilation succeeds with no errors

- [ ] **Step 5: Run all tests**

Run: `cd contracts && npx hardhat test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add contracts/contracts/AgentRegistry.sol
git commit -m "fix: fix AgentRegistry compilation — field name, verifier type, verifyProof return"
```

---

### Task 5: Fix COVENANTRouter Function Selector Mismatch

**Files:**
- Modify: `contracts/contracts/COVENANTRouter.sol`

The `registerAndCreateTask` function encodes a call with selector `createAndFundTask(address,uint96,uint48,bytes32)` but the actual `TaskEscrow.createAndFundTask` signature is `createAndFundTask(address,uint256,uint256,string)`. Every call reverts.

- [ ] **Step 1: Read the router and TaskEscrow to confirm signatures**

Read `contracts/contracts/COVENANTRouter.sol` and `contracts/contracts/TaskEscrow.sol` to confirm the actual function signatures.

- [ ] **Step 2: Fix the encoded call in the router**

Update the `abi.encodeWithSelector` to match the actual TaskEscrow function signature:

```solidity
// Before (broken):
bytes memory data = abi.encodeWithSelector(
    bytes4(keccak256("createAndFundTask(address,uint96,uint48,bytes32)")),
    // ... args
);

// After (correct):
bytes memory data = abi.encodeWithSelector(
    bytes4(keccak256("createAndFundTask(address,uint256,uint256,string)")),
    // ... args with correct types
);
```

- [ ] **Step 3: Fix the misleading `delegatecall` comment**

Change the comment on line 66 from "delegatecall" to "call" to match the actual behavior.

- [ ] **Step 4: Compile and test**

Run: `cd contracts && npx hardhat compile && npx hardhat test test/COVENANTRouter.test.js`
Expected: Compilation succeeds, tests pass

- [ ] **Step 5: Commit**

```bash
git add contracts/contracts/COVENANTRouter.sol
git commit -m "fix: correct function selector and comment in COVENANTRouter"
```

---

### Task 6: Fix TaskEscrow `createSubtask` Missing Return

**Files:**
- Modify: `contracts/contracts/TaskEscrow.sol`

`createSubtask` declares `returns (uint256)` but never returns a value.

- [ ] **Step 1: Add the return statement**

Find the `createSubtask` function and add a return at the end:

```solidity
// At the end of createSubtask, after the task is created:
return taskCounter;
```

- [ ] **Step 2: Compile and test**

Run: `cd contracts && npx hardhat compile && npx hardhat test test/TaskEscrow.subtask.test.js`
Expected: Pass

- [ ] **Step 3: Commit**

```bash
git add contracts/contracts/TaskEscrow.sol
git commit -m "fix: add missing return value in TaskEscrow.createSubtask"
```

---

### Task 7: Fix DisputeArbitration `.transfer()` Gas Limit

**Files:**
- Modify: `contracts/contracts/DisputeArbitration.sol`

`.transfer()` forwards only 2300 gas — will fail for smart contract wallets.

- [ ] **Step 1: Replace all `.transfer()` with `.call{value}()`**

Find all `.transfer(amount)` calls (around lines 266, 272) and replace:

```solidity
// Before:
payable(juror).transfer(payout);

// After:
(bool success, ) = payable(juror).call{value: payout}("");
require(success, "ETH transfer to juror failed");
```

- [ ] **Step 2: Compile and test**

Run: `cd contracts && npx hardhat compile && npx hardhat test test/DisputeArbitration.test.js`
Expected: Pass

- [ ] **Step 3: Commit**

```bash
git add contracts/contracts/DisputeArbitration.sol
git commit -m "fix: replace .transfer() with .call{value}() in DisputeArbitration"
```

---

### Task 8: Fix AgentCollective `minContribution` Enforcement

**Files:**
- Modify: `contracts/contracts/AgentCollective.sol`

`minContribution` is accepted as a parameter in `createCollective` but never stored or enforced.

- [ ] **Step 1: Store `minContribution` in the Collective struct**

Add `minContribution` to the Collective struct if missing, and store it during creation:

```solidity
struct Collective {
    // ... existing fields
    uint256 minContribution;
}
```

In `createCollective`:
```solidity
collectives[collectiveId].minContribution = minContribution;
```

- [ ] **Step 2: Enforce it in `joinCollective`**

```solidity
function joinCollective(uint256 collectiveId) external payable {
    Collective storage collective = collectives[collectiveId];
    require(msg.value >= collective.minContribution, "Below minimum contribution");
    // ... rest of function
```

- [ ] **Step 3: Compile and test**

Run: `cd contracts && npx hardhat compile && npx hardhat test test/AgentCollective.test.js`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add contracts/contracts/AgentCollective.sol
git commit -m "fix: enforce minContribution in AgentCollective.joinCollective"
```

---

## Phase 3: Compilation Fixes — Agents

### Task 9: Fix `client.ts` — Remove Duplicates and Broken Imports

**Files:**
- Modify: `agents/client.ts`

`client.ts` is completely broken: duplicate `main()`, duplicate `negotiateTerms()`, duplicate `updateWorkerReputation()`, duplicate `confirmPaymentRelease()`, imports from nonexistent `./lib/verification.js` and `./lib/negotiation.js`.

- [ ] **Step 1: Read the full file**

Read `agents/client.ts` completely. Identify:
- Line 15: first `main()` definition
- Line 264: duplicate `main()` definition
- Line 185: first `negotiateTerms()`
- Line 434: duplicate `negotiateTerms()`
- Line 376/461: duplicate `updateWorkerReputation()`
- Line 384/469: duplicate `confirmPaymentRelease()`
- Lines 8-9: broken imports from nonexistent modules

- [ ] **Step 2: Remove the broken imports**

Remove lines 8-9:
```typescript
// DELETE these two lines:
import { verifyTask, updateWorkerReputation, confirmPaymentRelease } from "./lib/verification.js";
import { selectBestWorkerAI, negotiateTerms } from "./lib/negotiation.js";
```

- [ ] **Step 3: Remove all duplicate function definitions**

Remove the SECOND copies of each function (keep the first):
- Remove duplicate `main()` at line 264 (keep the one at line 15)
- Remove duplicate `negotiateTerms()` at line 434 (keep the one at line 185)
- Remove duplicate `updateWorkerReputation()` at line 461 (keep line 376)
- Remove duplicate `confirmPaymentRelease()` at line 469 (keep line 384)

- [ ] **Step 4: Fix `negotiateTerms` — undefined `workers` variable**

The function references `workers.find(...)` but `workers` is a local variable inside `runEnhancedOneToOneMode`. Fix by passing `workers` as a parameter:

```typescript
// Before:
async function negotiateTerms(clientWallet, workerAddress, task) {
    const worker = workers.find(w => w.address === workerAddress);
    // ...
}

// After:
async function negotiateTerms(clientWallet, workerAddress, task, workers) {
    const worker = workers.find(w => w.address === workerAddress);
    // ...
}
```

Update the call site in `main()` or `runEnhancedOneToOneMode` to pass `workers`.

- [ ] **Step 5: Fix `selectBestWorkerAI` — wrong variable in map**

Inside the `.map()` callback, references `workerAddress` (the parameter) instead of `worker` (the iteration variable):

```typescript
// Before (inside .map):
capabilities: workerAddress.capabilities, // WRONG

// After:
capabilities: worker.capabilities,
```

- [ ] **Step 6: Remove unused crypto imports**

Remove `generateKeyPair`, `deriveSharedSecret`, `encrypt` from the crypto import if they're not used in the file.

- [ ] **Step 7: Verify compilation**

Run: `cd agents && npx tsx --typecheck client.ts 2>&1 | head -20`
Expected: No compilation errors (or only expected missing env errors at runtime)

- [ ] **Step 8: Commit**

```bash
git add agents/client.ts
git commit -m "fix: remove duplicates and broken imports in client.ts"
```

---

### Task 10: Fix `verifier.ts` — BatchHash Bug, Wrong Key, Dead Imports

**Files:**
- Modify: `agents/verifier.ts`

Three bugs: (1) `{ batchHash }` should be `{ hash: batchHash }` (line 345), (2) uses `CLIENT_PRIVATE_KEY` instead of verifier key (line 523), (3) many unused imports.

- [ ] **Step 1: Fix the batchHash bug**

At line 345:
```typescript
// Before:
const receipt = await publicClient.waitForTransactionReceipt({ batchHash });

// After:
const receipt = await publicClient.waitForTransactionReceipt({ hash: batchHash });
```

- [ ] **Step 2: Fix the wrong private key**

At line 523:
```typescript
// Before:
const { CLIENT_PRIVATE_KEY } = process.env;

// After:
const { VERIFIER_PRIVATE_KEY, CLIENT_PRIVATE_KEY } = process.env;
const verifierKey = VERIFIER_PRIVATE_KEY || CLIENT_PRIVATE_KEY;
```

Then update line 530 to use `verifierKey`:
```typescript
const wallet = createWallet(verifierKey);
```

- [ ] **Step 3: Remove unused imports**

Remove these unused imports from the top of the file:
```typescript
// Remove:
import { decrypt, fromHex, toHex } from "./lib/crypto.js";  // keep initLitClient if used
import { verifyReputationProof, verifyCapabilityProof } from "./lib/zk-proofs.js";
import { CheckResult } from "./lib/evidence.js";  // keep saveEvidence/loadEvidence if used
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { submitQuery, respondToQuery, monitorQueries, generateQueryResponse } from "./lib/query-system.js";
```

Also remove the unused `Query` interface, `VerificationBatch` interface, and `QueryEventListener` class if present.

- [ ] **Step 4: Commit**

```bash
git add agents/verifier.ts
git commit -m "fix: batchHash bug, wrong key, and dead imports in verifier.ts"
```

---

### Task 11: Fix `insuranceAgent.ts` and `memoryAgent.ts` — All Imports Broken

**Files:**
- Modify: `agents/insuranceAgent.ts`
- Modify: `agents/memoryAgent.ts`

Both files have completely broken imports: wrong paths, nonexistent exports, mixing ethers with viem codebase.

- [ ] **Step 1: Fix `insuranceAgent.ts` imports**

Replace the broken imports:
```typescript
// Before:
import { encryptTask, decryptTask } from "./lib/crypto";
import { tracker } from "./lib/tracker";

// After:
import { encrypt, decrypt, generateKeyPair, deriveSharedSecret, toHex } from "./lib/crypto.js";
import { trackEvent } from "./lib/tracker.js";  // or whatever the actual export is
```

Verify the actual exports of `./lib/crypto.js` and `./lib/tracker.js` first by reading those files.

- [ ] **Step 2: Fix `insuranceAgent.ts` — ethers to viem**

If the file uses `ethers` for contract interaction, convert to `viem` to match the rest of the codebase:
```typescript
// Before:
import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider(...);

// After:
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(...) });
```

- [ ] **Step 3: Fix `memoryAgent.ts` imports**

Same pattern:
```typescript
// Before:
import { config } from "./lib/config";
import { llmGenerate } from "./lib/llm";
import { tracker } from "./lib/tracker";

// After:
import { createWallet, CONTRACTS } from "./lib/config.js";
import { generateCompletion, generateJSON } from "./lib/llm.js";
import { trackEvent } from "./lib/tracker.js";  // verify actual exports
```

- [ ] **Step 4: Verify compilation**

Run: `cd agents && npx tsx --typecheck insuranceAgent.ts 2>&1 | head -20`
Run: `cd agents && npx tsx --typecheck memoryAgent.ts 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add agents/insuranceAgent.ts agents/memoryAgent.ts
git commit -m "fix: repair all broken imports in insuranceAgent.ts and memoryAgent.ts"
```

---

### Task 12: Fix `lib/query-system.ts` — Wrong Import Paths

**Files:**
- Modify: `agents/lib/query-system.ts`

Import paths use `../` when they should use `./` since the file is already in `lib/`.

- [ ] **Step 1: Fix the three import paths**

```typescript
// Before:
import { TaskEscrowABI } from "../abis.js";
import { CONTRACTS } from "../config.js";
import { generateJSON } from "../llm.js";

// After:
import { TaskEscrowABI } from "./abis.js";
import { CONTRACTS } from "./config.js";
import { generateJSON } from "./llm.js";
```

- [ ] **Step 2: Commit**

```bash
git add agents/lib/query-system.ts
git commit -m "fix: correct import paths in lib/query-system.ts"
```

---

### Task 13: Fix `lib/checkers/index.ts` — Duplicate Checker & runAllCheckers Bug

**Files:**
- Modify: `agents/lib/checkers/index.ts`

Two bugs: `StripeIntegrationChecker` registered twice (lines 56-59 and 91-94), `runAllCheckers` discards all results except the first.

- [ ] **Step 1: Remove the duplicate StripeIntegrationChecker entry**

Remove lines 91-94 (the second registration of `StripeIntegrationChecker`).

- [ ] **Step 2: Fix `runAllCheckers` to return all results**

```typescript
// Before (line 170-172):
return results[0];

// After:
return results;  // Return all checker results
```

Update the return type accordingly:
```typescript
// Before:
): Promise<ReturnType<typeof CHECKERS[0]['check']>>

// After:
): Promise<Array<ReturnType<typeof CHECKERS[0]['check']>>>
```

- [ ] **Step 3: Update callers in verifier.ts**

Check how `runAllCheckers` is called in `verifier.ts` and update to handle the array return:

```typescript
// Before:
const result = await runAllCheckers(deliverable);

// After:
const results = await runAllCheckers(deliverable);
// Use results for aggregate scoring
```

- [ ] **Step 4: Commit**

```bash
git add agents/lib/checkers/index.ts agents/verifier.ts
git commit -m "fix: remove duplicate checker registration and fix runAllCheckers return value"
```

---

### Task 14: Fix `orchestrator.ts` — Double `createParallelBatch` Call

**Files:**
- Modify: `agents/orchestrator.ts`

`executeLargeTask` calls `createParallelBatch()` twice — first call's result is abandoned.

- [ ] **Step 1: Remove the first (unused) call**

Find the first `createParallelBatch` call (around line 252) and remove it. Keep only the second call (around line 271) that actually stores and uses the result.

- [ ] **Step 2: Commit**

```bash
git add agents/orchestrator.ts
git commit -m "fix: remove duplicate createParallelBatch call in orchestrator"
```

---

### Task 15: Fix `bidder.ts` — Duplicate Import & Unused Imports

**Files:**
- Modify: `agents/bidder.ts`

- [ ] **Step 1: Remove duplicate import**

Remove the standalone `import { encodeFunctionData } from "viem"` (line 9) since it's already imported on line 1.

- [ ] **Step 2: Remove unused imports**

Remove `createWalletClient`, `createPublicClient`, `http`, `Address` from the main viem import if they're not used in the file.

- [ ] **Step 3: Fix missing `.js` extension**

```typescript
// Before:
import { EventListener } from "./lib/eventListener";

// After:
import { EventListener } from "./lib/eventListener.js";
```

- [ ] **Step 4: Commit**

```bash
git add agents/bidder.ts
git commit -m "fix: remove duplicate import and fix extension in bidder.ts"
```

---

## Phase 4: Compilation Fixes — Frontend

### Task 16: Fix `collectives/page.tsx` — All Broken Imports

**Files:**
- Modify: `frontend/src/app/collectives/page.tsx`
- Modify: `frontend/src/types/index.ts` (add `formatEth`)

Four build-breaking issues: missing `useCollective` hook, missing `formatEth` export, wrong import styles.

- [ ] **Step 1: Add `formatEth` to `frontend/src/types/index.ts`**

```typescript
export function formatEth(wei: bigint | string | undefined): string {
  if (!wei) return "0.0";
  const value = typeof wei === "string" ? BigInt(wei) : wei;
  const eth = Number(value) / 1e18;
  return eth.toFixed(4);
}
```

- [ ] **Step 2: Fix default imports to named imports in `collectives/page.tsx`**

```typescript
// Before:
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import LoadingPulse from "@/components/ui/LoadingPulse";

// After:
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
```

- [ ] **Step 3: Create the missing `useCollective` hook**

Create `frontend/src/hooks/useCollective.ts`:

```typescript
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { getContractAddresses } from "@/config/contracts";
import AgentCollectiveABI from "@/contracts/AgentCollective.json";

export function useCollective(collectiveId: bigint) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  const { data: collective, isLoading, error } = useReadContract({
    address: addresses.AgentCollective as `0x${string}`,
    abi: AgentCollectiveABI.abi,
    functionName: "getCollective",
    args: [collectiveId],
    query: { enabled: !!addresses.AgentCollective },
  });

  return { collective, isLoading, error };
}

export function useMyCollectives(address?: `0x${string}`) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  const { data: collectiveIds, isLoading } = useReadContract({
    address: addresses.AgentCollective as `0x${string}`,
    abi: AgentCollectiveABI.abi,
    functionName: "getMyCollectives",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!addresses.AgentCollective },
  });

  return { collectiveIds: collectiveIds as bigint[] | undefined, isLoading };
}
```

- [ ] **Step 4: Create the missing `AgentCollective.json` ABI file**

Copy the compiled ABI from `contracts/artifacts/contracts/AgentCollective.sol/AgentCollective.json` to `frontend/src/contracts/AgentCollective.json`. If the artifact doesn't exist, compile first:

```bash
cd contracts && npx hardhat compile
cp artifacts/contracts/AgentCollective.sol/AgentCollective.json ../frontend/src/contracts/
```

- [ ] **Step 5: Verify build**

Run: `cd frontend && npm run build 2>&1 | tail -20`
Expected: No compilation errors from collectives page

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/app/collectives/page.tsx frontend/src/hooks/useCollective.ts frontend/src/contracts/AgentCollective.json
git commit -m "fix: repair collectives page — add useCollective hook, formatEth, fix imports"
```

---

### Task 17: Fix Missing Contract ABIs & Config

**Files:**
- Create: `frontend/src/contracts/OpenTaskMarket.json` (if missing)
- Modify: `frontend/src/config/contracts.ts`

- [ ] **Step 1: Copy OpenTaskMarket ABI**

```bash
cp contracts/artifacts/contracts/OpenTaskMarket.sol/OpenTaskMarket.json frontend/src/contracts/
```

If `useOpenTaskMarket.ts` references a different path, update the import.

- [ ] **Step 2: Fix 39-character addresses in `contracts.ts`**

The zero-address fallbacks have 39 hex chars instead of 40. Fix them:

```typescript
// Before:
const BATCH = process.env.NEXT_PUBLIC_BATCH_ADDRESS || "0x0000000000000000000000000000000000000";

// After:
const BATCH = process.env.NEXT_PUBLIC_BATCH_ADDRESS || "0x0000000000000000000000000000000000000000";
```

Fix all 4 zero-address constants (BATCH, COLLECTIVE, INSURANCE, DISPUTE) and the 8 chain-8453 addresses.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/contracts/ frontend/src/config/contracts.ts
git commit -m "fix: add missing OpenTaskMarket ABI and fix malformed addresses"
```

---

### Task 18: Fix NeuralBackground Double-Render & Layout Cleanup

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/layout.tsx`

The homepage renders its own `<NeuralBackground />` while `layout.tsx` already renders one globally. Two Three.js canvases = massive performance hit.

- [ ] **Step 1: Remove NeuralBackground from `page.tsx`**

Remove the dynamic import and rendering of `NeuralBackground` from `frontend/src/app/page.tsx`. The one in `layout.tsx` already covers all pages.

- [ ] **Step 2: Remove unused `dynamic` import from `layout.tsx`**

```typescript
// Remove:
import dynamic from "next/dynamic";
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/app/layout.tsx
git commit -m "fix: remove duplicate NeuralBackground from homepage, clean unused import"
```

---

### Task 19: Fix LoadingPulse Non-Deterministic Rendering

**Files:**
- Modify: `frontend/src/components/ui/LoadingPulse.tsx`

`Math.random()` in render causes different widths on every re-render, causing layout shift.

- [ ] **Step 1: Use deterministic widths based on index**

```typescript
// Before:
style={{ width: `${Math.random() * 40 + 60}%` }}

// After (using index prop or fixed widths):
const widths = [75, 82, 68, 90, 73]; // predetermined widths
style={{ width: `${widths[index % widths.length]}%` }}
```

Or if no index is available, use fixed width:
```typescript
style={{ width: "75%" }}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ui/LoadingPulse.tsx
git commit -m "fix: use deterministic widths in LoadingPulse to prevent layout shift"
```

---

### Task 20: Fix Undefined CSS Classes & Add Missing Definitions

**Files:**
- Modify: `frontend/src/app/globals.css` or `frontend/tailwind.config.ts`

12+ CSS classes used in components but not defined anywhere.

- [ ] **Step 1: Add missing CSS classes to `globals.css`**

```css
/* Add these missing classes: */
.btn-glow {
  box-shadow: 0 0 15px rgba(139, 92, 246, 0.5);
}

.card-inner-glow {
  box-shadow: inset 0 0 20px rgba(139, 92, 246, 0.1);
}

.animated-underline {
  position: relative;
}
.animated-underline::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: currentColor;
  transition: width 0.3s ease;
}
.animated-underline:hover::after {
  width: 100%;
}

.animate-slide-down {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

- [ ] **Step 2: Add missing Tailwind color extensions**

In `tailwind.config.ts`, add to `theme.extend.colors`:

```typescript
'neon-green': '#39ff14',
'neon-blue': '#00d4ff',
'neon-purple': '#bf00ff',
'glass-border-hover': 'rgba(255, 255, 255, 0.2)',
```

- [ ] **Step 3: Deduplicate glow definitions**

Choose one source of truth (either CSS or Tailwind, not both). Remove the duplicate definitions from the other source.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/globals.css frontend/tailwind.config.ts
git commit -m "fix: add missing CSS classes and deduplicate glow/font definitions"
```

---

## Phase 5: Dead Code Cleanup

### Task 21: Remove Dead/Backup Files

**Files to delete:**

- [ ] **Step 1: Remove contract backup/dead files**

```bash
cd contracts
rm -f TaskEscrow.sol.bak AgentRegistry.sol.bak AgentRegistry.sol.backup
rm -f _write_tests.cjs _write_tests.js _write_tests.py
rm -f fix-file.js test-gas.js
rm -f scripts/deploy_all_contracts.cjs  # contains Python, not JS
```

- [ ] **Step 2: Remove agent backup/dead files**

```bash
cd agents
rm -f client.ts.backup2 client.ts.broken client.ts.final
rm -f capabilityProof.sym
rm -f fileTest.js test.js test-files.js testScript.js test-zk.ts test-lit.ts
rm -f run-executor-tests.sh
```

- [ ] **Step 3: Remove ghost `{src` directory**

```bash
rm -rf "frontend/{src"
```

- [ ] **Step 4: Remove empty `COVENANT` directory**

```bash
rm -rf COVENANT
```

- [ ] **Step 5: Add `venv/` to `.gitignore`**

Append to `.gitignore`:
```
venv/
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "cleanup: remove dead files, backups, ghost directories, and add venv to gitignore"
```

---

### Task 22: Remove Unused Frontend Code

**Files:**
- Modify: various frontend files

- [ ] **Step 1: Remove unused `useState` from `providers.tsx`**

```typescript
// Before:
import { useState } from "react";

// After: (remove the line)
```

- [ ] **Step 2: Remove unused `useEffect` from `Navbar.tsx`**

```typescript
// Before:
import { useState, useEffect } from "react";

// After:
import { useState } from "react";
```

- [ ] **Step 3: Remove unused `cn` import from `AsymmetricBox.tsx`**

Remove the `import { cn } from "@/lib/utils"` line.

- [ ] **Step 4: Remove unused npm dependencies**

```bash
cd frontend
npm uninstall d3 recharts @tanstack/react-virtual @react-three/postprocessing
```

- [ ] **Step 5: Move `@types/three` to devDependencies**

```bash
cd frontend
npm uninstall @types/three
npm install --save-dev @types/three
```

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "cleanup: remove unused imports, dead components, and unused npm dependencies"
```

---

### Task 23: Remove Dead Type Files & Deduplicate Types

**Files:**
- Delete: `frontend/src/types/agentTypes.ts`
- Delete: `frontend/src/types/taskTypes.ts`
- Delete: `frontend/src/types/ipfsTypes.ts`
- Delete: `frontend/src/types/statsTypes.ts`
- Delete: `frontend/src/types/neural.ts`
- Delete: `frontend/src/types/verification.ts`

- [ ] **Step 1: Verify none of these files are imported anywhere**

Run: `cd frontend && grep -r "agentTypes\|taskTypes\|ipfsTypes\|statsTypes\|types/neural\|types/verification" src/ --include="*.ts" --include="*.tsx"`
Expected: No output

- [ ] **Step 2: Delete the unused type files**

```bash
cd frontend/src/types
rm -f agentTypes.ts taskTypes.ts ipfsTypes.ts statsTypes.ts neural.ts verification.ts
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/
git commit -m "cleanup: remove unused type files (duplicates of types/index.ts)"
```

---

## Phase 6: Quality Improvements

### Task 24: Update CLAUDE.md to Reflect Actual Architecture

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the architecture description**

Change "Three-contract architecture" to reflect the actual 10+ contracts. Update the test count from 34 to ~200+. Add the additional contracts (AgentCollective, AgentInsurance, OpenTaskMarket, etc.) to the directory structure.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect actual 10+ contract architecture and 200+ tests"
```

---

### Task 25: Fix Frontend No-Op Ternaries

**Files:**
- Modify: `frontend/src/components/tasks/TaskTimeline.tsx`
- Modify: `frontend/src/components/tasks/TaskActions.tsx`

- [ ] **Step 1: Fix TaskTimeline no-op ternary**

```typescript
// Before (line 24):
const normalizedStatus = typeof currentStatus === "number" ? currentStatus : currentStatus;

// After:
const normalizedStatus = typeof currentStatus === "number" ? currentStatus : Number(currentStatus);
```

- [ ] **Step 2: Fix TaskActions no-op ternary**

```typescript
// Before (line 25):
const normalizedStatus = typeof status === "number" ? status : status;

// After:
const normalizedStatus = typeof status === "number" ? status : Number(status);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tasks/TaskTimeline.tsx frontend/src/components/tasks/TaskActions.tsx
git commit -m "fix: correct no-op ternaries in TaskTimeline and TaskActions"
```

---

### Task 26: Add `next.config.mjs`

**Files:**
- Create: `frontend/next.config.mjs`

- [ ] **Step 1: Create the config file**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["three"],
  reactStrictMode: true,
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    return config;
  },
};

export default nextConfig;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/next.config.mjs
git commit -m "feat: add next.config.mjs with Three.js transpile config"
```

---

### Task 27: Fix Deadline Calculation Inconsistency

**Files:**
- Modify: `frontend/src/app/marketplace/page.tsx`

The marketplace sends raw seconds as deadline, but `CreateTaskForm` correctly adds `Date.now()/1000`. One of them is wrong — need to check which the contract expects.

- [ ] **Step 1: Read TaskEscrow to determine expected format**

Check if `createOpenTask` expects an absolute timestamp or relative seconds.

- [ ] **Step 2: Fix the marketplace to match**

If the contract expects absolute timestamps:
```typescript
// Before:
const deadlineSeconds = BigInt(parseInt(deadlineHours) * 3600);

// After:
const deadlineSeconds = BigInt(Math.floor(Date.now() / 1000) + parseInt(deadlineHours) * 3600);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/marketplace/page.tsx
git commit -m "fix: correct deadline calculation to use absolute timestamp"
```

---

### Task 28: Remove Debug Code from Contract Tests

**Files:**
- Modify: `contracts/test/OpenTaskMarket.test.js`
- Modify: `contracts/test/AgentCollective.test.js`

- [ ] **Step 1: Remove console.log statements from OpenTaskMarket tests**

Remove all 150+ `console.log` debug statements from `contracts/test/OpenTaskMarket.test.js`.

- [ ] **Step 2: Remove debug console.log from AgentCollective test**

Remove the `console.log("Worker address from outer:", worker.address)` at line 18.

- [ ] **Step 3: Run all tests to verify nothing breaks**

Run: `cd contracts && npx hardhat test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add contracts/test/
git commit -m "cleanup: remove debug console.log from contract tests"
```

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1: Security | 1-3 | Secrets, AgentInsurance, useNullifier |
| 2: Contracts | 4-8 | Compilation, logic bugs |
| 3: Agents | 9-15 | Compilation, bugs, dead imports |
| 4: Frontend | 16-20 | Build-breaking, performance, CSS |
| 5: Cleanup | 21-23 | Dead files, unused code, dedup |
| 6: Quality | 24-28 | Docs, consistency, config |

**Total: 28 tasks, ~80 steps.** Each task is independently committable. Recommended execution: subagent-driven with review between tasks.
