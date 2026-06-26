# COVENANT SDK

TypeScript SDK for interacting with COVENANT smart contracts.

## Install

```bash
npm install @varun-ai07/covenant-sdk
```

## Usage

```typescript
import { CovenantSDK } from "@varun-ai07/covenant-sdk";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({ chain: baseSepolia, transport: http() });
const sdk = new CovenantSDK({ chainId: 84532, publicClient: client });

// Get agent
const agent = await sdk.getAgent("0x...");

// Create task
const taskId = await sdk.createTask(worker, payment, deadline, descriptionHash);
```

## V5 Contracts

All SDK methods use V5 UUPS proxy addresses on Base Sepolia. Contract logic can be upgraded without changing addresses.
