# COVENANT ABIs

<p align="center">
  <img src="https://img.shields.io/badge/JSON-ABI-green" alt="ABI">
  <img src="https://img.shields.io/badge/Contracts-11-blue" alt="Contracts">
</p>

<p align="center">
  <strong>Contract ABIs for COVENANT Protocol Integration</strong>
</p>

---

## Overview

The `agents/abis/` directory contains JSON ABI files for all COVENANT smart contracts. These ABIs are required for:

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
  address: "0x3e4a9013Ec6315eF0e13B4f768e07cf43c6c3369",
  abi: AgentRegistryABI,
  functionName: "getAgent",
  args: ["0xAgentAddress..."]
});

// With ethers
const registry = new ethers.Contract(
  "0x3e4a9013Ec6315eF0e13B4f768e07cf43c6c3369",
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
| AgentRegistry | `0x3e4a9013Ec6315eF0e13B4f768e07cf43c6c3369` |
| TaskEscrow | `0xb2a2b7f046fa82A020B3008A71E61d16603BAa05` |
| ReceiptVerifier | `0xabd07d380FBC7807bF25e8d969E7FF5192117Ec5` |
| OpenTaskMarket | `0xf930b3060020a931dccabC9BfA1e6C2a8EB6D5d5` |
| ParallelTaskBatch | `0xfD9314cA51374aDc879AB794844f6be3CA85a645` |
| AgentCollective | `0x378B0Fb03d8B2CE34Da90D1e587CEBb7b22dA856` |
| AgentInsurance | `0x87933103cA13e1969b24d40eFe2C7c9C008Fc1Dc` |
| DisputeArbitration | `0xC98ebfAE496e297a84a960085418C8240891E6CD` |

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
