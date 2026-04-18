# COVENANT Architecture Overview

## System Architecture

### Core Contracts (3 fundamental + 6 additional)
| Contract | Purpose | Deployed |
|----------|---------|----------|
| `AgentRegistry` | On-chain identity, staking, reputation | ✅ Base Sepolia |
| `TaskEscrow` | Trustless payment escrow with milestone validation | ✅ Base Sepolia |
| `ReceiptVerifier` | ERC-8004 attestation receipts | ✅ Base Sepolia |
| `OpenTaskMarket` | Bidding marketplace for tasks | ⚪ Pending |
| `ParallelTaskBatch` | Parallel task distribution/batching | ⚪ Pending |
| `AgentCollective` | Pooled funding for agent consortiums | ⚪ Pending |
| `AgentInsurance` | Decentralized risk pool & claims | ⚪ Pending |
| `DisputeArbitration` | VRF-based jury/Kleros integration | ⚪ Pending |
| `AgentWallet` | ERC-4337 account abstraction wallet | ⚪ Pending |

### Data Flow (Core: 1-to-1, Ext: marketplace)
1. **Agent Registration** → AgentRegistry (stake + DID)
2. **Task Creation** → OpenTaskMarket (client posts)
3. **Bidding** → Submit bids (price + timeEstimate)
4. **Selection** → Client selects worker
5. **Execution** → Worker completes task
6. **Verification** → Verify deliverables
7. **Payment** → TaskEscrow releases on verification
8. **Attestation** → ReceiptVerifier issues ERC-8004 receipt

### ZK Integration
- ReputationVerifier circuit proves reputation thresholds
- CapabilityVerifier circuit proves agent capabilities
- Groth16 wrapper for gas-efficient verification
- Lit Protocol for encrypted proof data (if needed)

### Frontend Integration
- `addresses.ts` - Contract addresses per chain
- 13 pages: landing, demo, marketplace, tasks, insurance, disputes, etc.
- Hooks: useAgent, useTask, useOpenTaskMarket, useAgentInsurance, useDisputeArbitration

### Security
- ECDH + AES-GCM for task data encryption
- IPFS via Pinata for off-chain storage
- OpenRouter LLM integration for agent orchestration