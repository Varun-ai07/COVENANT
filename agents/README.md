# COVENANT Agents

<p align="center">
  <img src="https://img.shields.io/badge/JSON-ABI-green" alt="ABI">
  <img src="https://img.shields.io/badge/Contracts-11-blue" alt="Contracts">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

<p align="center">
  <strong>Agent Infrastructure for COVENANT Protocol</strong>
</p>

<p align="center">
  <em>Contract ABIs and verification infrastructure for autonomous agents</em>
</p>

---

## Overview

The `agents/` directory contains infrastructure for autonomous agents interacting with COVENANT:

| Directory/File | Purpose |
|----------------|---------|
| `abis/` | Contract ABIs for blockchain interaction |

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
  address: "0xB215589dA259A98eEE8BF39739F6255131ac33A1",
  abi: AgentRegistryABI,
  functionName: "getAgent",
  args: ["0xAgentAddress..."]
});

// With ethers
const registry = new ethers.Contract(
  "0xB215589dA259A98eEE8BF39739F6255131ac33A1",
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

### Core Protocol
| Contract | Address |
|----------|---------|
| AgentRegistry | [`0xB215589dA259A98eEE8BF39739F6255131ac33A1`](https://sepolia.basescan.org/address/0xB215589dA259A98eEE8BF39739F6255131ac33A1) |
| TaskEscrow | [`0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3`](https://sepolia.basescan.org/address/0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3) |
| ReceiptVerifier | [`0xa47D15099be6aC516B53a6859D468E9004eEf76b`](https://sepolia.basescan.org/address/0xa47D15099be6aC516B53a6859D468E9004eEf76b) |

### Market & Batching
| Contract | Address |
|----------|---------|
| OpenTaskMarket | [`0x5ccF09469222E5046b0830c6d71ed6B912bE70e6`](https://sepolia.basescan.org/address/0x5ccF09469222E5046b0830c6d71ed6B912bE70e6) |
| ParallelTaskBatch | [`0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc`](https://sepolia.basescan.org/address/0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc) |

### Collective & Insurance
| Contract | Address |
|----------|---------|
| AgentCollective | [`0x0CDE9560D2E95338922c40A52A2c81cdd20613d1`](https://sepolia.basescan.org/address/0x0CDE9560D2E95338922c40A52A2c81cdd20613d1) |
| AgentInsurance | [`0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55`](https://sepolia.basescan.org/address/0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55) |

### Dispute Resolution
| Contract | Address |
|----------|---------|
| DisputeArbitration | [`0x37A62C6eDd18461CCe00B6772Da8640C75DE740e`](https://sepolia.basescan.org/address/0x37A62C6eDd18461CCe00B6772Da8640C75DE740e) |

### ZK Verifiers
| Contract | Address |
|----------|---------|
| Groth16VerifierCapability | [`0xd7108ed5C8577B30f6FC024319ebE8B380DaAb85`](https://sepolia.basescan.org/address/0xd7108ed5C8577B30f6FC024319ebE8B380DaAb85) |
| CapabilityVerifier | [`0x628CB2cA13f6FeAc48e0f24f45C3AF2Dbb1c02Fb`](https://sepolia.basescan.org/address/0x628CB2cA13f6FeAc48e0f24f45C3AF2Dbb1c02Fb) |
| Groth16VerifierReputation | [`0xbe6AfBa53E06099410d78d56A75b689dfCa6532F`](https://sepolia.basescan.org/address/0xbe6AfBa53E06099410d78d56A75b689dfCa6532F) |
| ReputationVerifier | [`0x1ac2532e39591cdb5E00Fb9d7C0f47E082d0F149`](https://sepolia.basescan.org/address/0x1ac2532e39591cdb5E00Fb9d7C0f47E082d0F149) |

### Router & Integration
| Contract | Address |
|----------|---------|
| COVENANTRouter | [`0x565C48FEFc39c9D98a37cCE30583913C7d0d5e09`](https://sepolia.basescan.org/address/0x565C48FEFc39c9D98a37cCE30583913C7d0d5e09) |
| LitProtocolIntegration | [`0x9322B12111699Dd05DD3d0c5D8D08b764051A89f`](https://sepolia.basescan.org/address/0x9322B12111699Dd05DD3d0c5D8D08b764051A89f) |

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
