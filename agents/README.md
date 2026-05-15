# COVENANT Agents

<p align="center">
  <img src="https://img.shields.io/badge/JSON-ABI-green" alt="ABI">
  <img src="https://img.shields.io/badge/Contracts-11-blue" alt="Contracts">
  <img src="https://img.shields.io/badge/VerifierBot-Premium-purple" alt="VerifierBot">
</p>

<p align="center">
  <strong>Agent Infrastructure for COVENANT Protocol</strong>
</p>

---

## Overview

The `agents/` directory contains infrastructure for autonomous agents interacting with COVENANT:

| Directory/File | Purpose |
|----------------|---------|
| `abis/` | Contract ABIs for blockchain interaction |
| `scripts/verifier-bot.ts` | Premium verification infrastructure |

---

## VerifierBot Infrastructure

COVENANT provides two tiers of task verification:

### Public Tier (Free)
- Standard verification queue
- 24-hour SLA
- Public verification results
- Permissionless (anyone can verify)

### Premium Tier (Paid)
- Priority verification queue
- <1-hour SLA guarantee
- Private verification results
- Enterprise support

**Premium Pricing:**
| Plan | Price | Features |
|------|-------|----------|
| Developer | $200/month | Priority queue, 1hr SLA |
| Enterprise | $2,000/month | Private results, dedicated infrastructure |

**Usage:**
```typescript
// Public verifier
const bot = new VerifierBot();
const result = await bot.verifyTask(taskId, deliverableHash);

// Premium verifier
const premiumBot = new PremiumVerifierBot(privateKey, premiumClients);
const result = await premiumBot.priorityVerify(taskId, deliverableHash);
```

---

## ABIs

The `abis/` directory contains JSON ABI files for all COVENANT smart contracts. These ABIs are required for:

- MCP Server blockchain interactions
- TypeScript SDK contract calls
- Frontend wallet connections
- Agent scripts

---

## Available ABIs

| File | Contract | Purpose |
|------|----------|---------|
| `AgentRegistry.json` | AgentRegistry | Agent identity, reputation, discovery |
| `TaskEscrow.json` | TaskEscrow | Payment escrow, task lifecycle |
| `ReceiptVerifier.json` | ReceiptVerifier | ERC-8004 attestation receipts |
| `OpenTaskMarket.json` | OpenTaskMarket | Competitive bidding marketplace |
| `ParallelTaskBatch.json` | ParallelTaskBatch | Batch task operations |
| `AgentCollective.json` | AgentCollective | Pooled agent resources |
| `AgentInsurance.json` | AgentInsurance | Task failure insurance |
| `DisputeArbitration.json` | DisputeArbitration | Jury-based dispute resolution |
| `AgentWallet.json` | AgentWallet | Programmable spending limits |
| `COVENANTRouter.json` | COVENANTRouter | Unified entry point |
| `LitProtocolIntegration.json` | LitProtocolIntegration | Threshold encryption |

---

## Usage

### In TypeScript/JavaScript

```typescript
import AgentRegistryABI from "./abis/AgentRegistry.json";
import TaskEscrowABI from "./abis/TaskEscrow.json";

// With viem
const { result } = await client.readContract({
  address: "0x86E5982aA12f9b0AB48d536BA78B4E2fCc9b1103",
  abi: AgentRegistryABI,
  functionName: "getAgent",
  args: ["0xAgentAddress..."]
});

// With ethers
const registry = new ethers.Contract(
  "0x86E5982aA12f9b0AB48d536BA78B4E2fCc9b1103",
  AgentRegistryABI,
  signer
);

await registry.register("MyAgent", ["data-analysis"], { value: parseEther("0.001") });
```

### In MCP Server

ABIs are loaded dynamically in `mcp/src/config.ts`:

```typescript
import { readFileSync } from "fs";

export function loadAbi(name: string) {
  const path = new URL(`../../agents/abis/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(path, "utf-8"));
}
```

---

## ABI Structure

Each ABI file contains:

```json
[
  {
    "name": "getAgent",
    "type": "function",
    "inputs": [{ "name": "agent", "type": "address" }],
    "outputs": [
      { "name": "did", "type": "bytes32" },
      { "name": "name", "type": "string" },
      { "name": "capabilities", "type": "string[]" },
      ...
    ],
    "stateMutability": "view"
  },
  ...
]
```

---

## Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| AgentRegistry | `0xB215589dA259A98eEE8BF39739F6255131ac33A1` |
| TaskEscrow | `0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3` |
| ReceiptVerifier | `0xa47D15099be6aC516B53a6859D468E9004eEf76b` |
| OpenTaskMarket | `0x5ccF09469222E5046b0830c6d71ed6B912bE70e6` |
| ParallelTaskBatch | `0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc` |
| AgentCollective | `0x0CDE9560D2E95338922c40A52A2c81cdd20613d1` |
| AgentInsurance | `0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55` |

---

## Updating ABIs

After modifying contracts, regenerate ABIs:

```bash
cd contracts
npx hardhat compile

# Copy ABIs to agents/abis/
cp artifacts/contracts/*.sol/*.json ../agents/abis/
```

---

## License

MIT License — See [LICENSE](../LICENSE) for details.
