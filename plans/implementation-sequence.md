# COVENANT Implementation Plan - Sequential Execution

## Phase 1: Fix Configuration Mismatches (IMMEDIATE)
**Priority: CRITICAL** - All contract interactions will fail without this fix

### Steps:
1. **Update frontend/src/config/contracts.ts** with correct addresses from deployed-addresses.json
2. **Update agents/lib/config.ts** with correct addresses from deployed-addresses.json
3. **Verify environment variables** are set for both frontend and agents

### Files to modify:
- `frontend/src/config/contracts.ts` - Fix AgentRegistry, TaskEscrow, ReceiptVerifier addresses
- `agents/lib/config.ts` - Fix same 3 addresses  
- `.env` files in `frontend/` and `agents/` - Ensure proper configuration

## Phase 2: Deploy Missing Contracts (HIGH PRIORITY)
**Priority: HIGH** - Protocol requires these contracts for full functionality

### Contracts to deploy (using existing deploy infrastructure):
1. **OpenTaskMarket** - Bidding marketplace
2. **ParallelTaskBatch** - Parallel task distribution  
3. **AgentCollective** - Pooled funding
4. **AgentInsurance** - Decentralized risk pool
5. **DisputeArbitration** - VRF-based jury (or integrate Kleros)
6. **CapabilityVerifier** - ZK capability verification

### Deployment approach:
- Use existing `deploy.cjs` as template
- Deploy to Base Sepolia testnet first
- Update configuration files with new addresses
- Verify on Basescan

## Phase 3: Wire Up Missing Frontend Pages (MEDIUM PRIORITY)
**Priority: MEDIUM** - User interface for new contracts

### Pages needing implementation:
- `/marketplace` - OpenTaskMarket integration
- `/batches` - ParallelTaskBatch integration  
- `/insurance` - AgentInsurance integration (partial exists, needs work)
- `/disputes` - DisputeArbitration integration (partial exists, needs work)
- `/market` - AgentCollective integration

### Hooks to implement/complete:
- `useOpenTaskMarket.ts` - Connect to OpenTaskMarket contract
- `useParallelBatch.ts` - Connect to ParallelTaskBatch contract
- `useAgentInsurance.ts` - Connect to AgentInsurance contract (needs full implementation)
- `useDisputeArbitration.ts` - Connect to DisputeArbitration contract (needs full implementation)

## Phase 4: ZK Proof Integration (MEDIUM PRIORITY)
**Priority: MEDIUM** - Core protocol feature

### Tasks:
1. **Integrate ZK proofs into agent workflow**:
   - `agents/lib/zk-proofs.ts` - Currently stubs only
   - Update `client.ts` to request ZK proofs from workers
   - Update `worker.ts` to generate ZK proofs
   - Update `verifier.ts` to verify ZK proofs on-chain

2. **ReputationVerifier circuit integration**:
   - Generate proofs in workers
   - Verify on-chain in ReceiptVerifier
   
3. **CapabilityVerifier circuit integration**:
   - Generate proofs for agent capabilities
   - Verify on-chain

4. **Lit Protocol integration** (if needed for encrypted proofs):
   - Complete `agents/lib/crypto.ts` integration
   - Use for encrypted proof data

## Phase 5: The Graph Indexing or Direct Contract Calls (LOW PRIORITY)
**Priority: LOW** - Performance optimization, not correctness

### Options:
1. **The Graph subgraph** - Build and deploy subgraph for querying
2. **Direct contract calls** - Current fallback (works but less efficient)

**Recommendation**: Start with direct contract calls (already working), add The Graph later if needed for performance.

## Phase 6: Kleros Dispute Integration (LOW PRIORITY)
**Priority: LOW** - Optional enhancement

### Tasks:
1. Decide if Kleros integration is needed vs. existing VRF jury
2. If needed, update `DisputeArbitration` contract or create wrapper
3. Update frontend dispute page

## Phase 7: Event Listener Integration (MEDIUM PRIORITY)
**Priority: MEDIUM** - Critical for real-time updates

### Tasks:
1. Verify `agents/lib/eventListener.ts` is complete
2. Ensure all agents properly handle events:
   - TaskPosted events
   - BidSubmitted events
   - WorkerSelected events
   - ProofVerified events
   - Claim events
3. Test event-driven workflow end-to-end

## Phase 8: Verification Checker System (MEDIUM PRIORITY)
**Priority: MEDIUM** - Quality assurance

### Tasks:
1. Implement domain-specific checkers in `agents/lib/`
2. AI/ML checker for work quality
3. Quantum resistance checker (future-proofing)
4. Blockchain state checker
5. Integration with verification workflow

## Phase 9: Testnet End-to-End Testing (CRITICAL)
**Priority: CRITICAL** - Validate all fixes

### Test scenarios:
1. Deploy all missing contracts
2. Register agent with correct addresses
3. Create task → Bid → Select → Execute → Verify → Receipt
4. Test insurance claim flow
5. Test ZK proof integration
6. Test event-driven workflow
7. Test parallel batching
8. Test collective funding

## Files Priority Order for Modification

### CRITICAL (Must fix first):
1. `agents/lib/config.ts` - Wrong contract addresses
2. `frontend/src/config/contracts.ts` - Wrong contract addresses  
3. `deploy.cjs` - Template for deploying missing contracts

### HIGH PRIORITY:
4. `frontend/src/contracts/addresses.ts` - Update with correct addresses
5. `agents/lib/zk-proofs.ts` - Implement ZK proof integration
6. `agents/lib/crypto.ts` - Complete Lit Protocol integration

### MEDIUM PRIORITY:
7. `frontend/src/hooks/useOpenTaskMarket.ts` - Connect to marketplace
8. `frontend/src/hooks/useAgentInsurance.ts` - Insurance integration
9. `frontend/src/hooks/useDisputeArbitration.ts` - Dispute integration
10. `frontend/src/pages/marketplace.tsx` - Marketplace UI
11. `frontend/src/pages/batches.tsx` - Batches UI
12. `frontend/src/pages/insurance.tsx` - Insurance UI
13. `frontend/src/pages/disputes.tsx` - Disputes UI

### LOW PRIORITY:
14. Event listener completeness
15. Verification checker system
16. The Graph subgraph (optional)
17. Kleros integration (optional)