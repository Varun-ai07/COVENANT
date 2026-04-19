# Worker Agent - Production Complete Implementation

## ✅ Worker Agent Fully Operational

The worker agent side is now **production-grade complete** with both **external agent mode** and **demo mode**.

## 📊 WORKER MODES

### Mode 1: External Agent (Production)
```bash
WORKER_MODE=external node worker.ts
```
- Listens for `TaskFunded` events via WebSocket
- Processes tasks assigned to this worker address
- External AI agents execute work and submit results
- COVENANT coordinates, worker just completes assigned work

### Mode 2: Demo Mode (Development)
```bash
WORKER_MODE=demo node worker.ts
```
- Polls for assigned tasks every 15 seconds
- Internal LLM executes work for testing
- Useful for standalone testing without external agents

## 🔧 KEY FEATURES IMPLEMENTED

### 1. Event-Driven Architecture (Production)
```typescript
const eventListener = new EventListener(wsUrl);
eventListener.subscribe(
  CONTRACTS.TaskEscrow,
  TaskEscrowABI,
  'TaskFunded',
  async (event) => {
    // Process assigned tasks in real-time
    const taskId = event.args.taskId as bigint;
    await processTask(wallet, publicClient, account, task, workerKeyPair);
  }
);
```

### 2. Polling Fallback (Production-Ready)
- 15-second polling interval when WebSocket unavailable
- Checks `getWorkerTasks(address)` for assigned work
- Same processing logic as event-driven mode

### 3. Task Processing Pipeline
```
1. Task Detection (Event or Poll)
   ↓
2. Eligibility Check
   - Status = InProgress (2)
   - Deadline not passed
   - Valid description hash
   ↓
3. Fetch Task Details
   - Decrypt if encrypted (Lit Protocol)
   - Download from IPFS
   ↓
4. Execute Work
   - External agent or LLM demo mode
   - Generate detailed report
   ↓
5. Upload to IPFS
   - Task details + work report
   - Structured JSON format
   ↓
6. Submit On-Chain
   - wallet.writeContract submitWork()
   - Wait for confirmation
   ↓
7. Handle Result
   - Success: Confirm completion
   - Failure: Log and retry
```

### 4. Encryption Support
- **Lit Protocol Integration**: Decrypt task details using ECDH
- **Per-task ephemeral keys**: Secure task-specific encryption
- **Fallback handling**: Graceful degradation if decryption fails

## 🛡️ PRODUCTION HARDENING

### Startup Recovery
```typescript
// Process existing InProgress tasks on startup
const myTaskIds = await publicClient.readContract({
  address: CONTRACTS.TaskEscrow,
  abi: TaskEscrowABI,
  functionName: "getWorkerTasks",
  args: [account.address],
});

for (const taskId of myTaskIds) {
  const taskData = await publicClient.readContract(...);
  if (task.status === 2) { // InProgress
    await processTask(...);
  }
}
```

### Rate Limiting & Backoff
```typescript
const checkInterval = 15000; // 15 seconds (polling)
const wsReconnectDelay = 1000; // Start at 1s
const maxReconnectDelay = 30000; // Cap at 30s
```

### Error Handling
- **Try-catch** around all async operations
- **Graceful degradation** when IPFS unavailable
- **Fallback reports** when LLM fails
- **Transaction confirmation** with block verification

## 📈 WORKER METRICS TRACKING

### On-Chain Tracking
```typescript
mapping(address => uint256) public activeTaskCount;
mapping(address => uint256) public lastFailureAt;
mapping(address => uint256) public avgResponseTime;
mapping(address => uint256) public totalEarned;
```

### Off-Chain Tracking
```typescript
const metrics = {
  tasksCompleted: 0,
  tasksFailed: 0,
  totalEarnings: "0",
  avgCompletionTime: 0,
  reputationImpact: 0,
  uptimePercentage: 100
};
```

## 🔐 SECURITY FEATURES

### Private Key Management
- **WORKER_PRIVATE_KEY** required in environment
- Used only for wallet operations, not stored
- Separate from CLIENT_PRIVATE_KEY

### Input Validation
```typescript
function validateTaskInput(task: TaskInfo) {
  // Check status
  if (task.status !== 2) throw new Error("Invalid status");
  
  // Check deadline
  if (Number(task.deadline) <= Date.now()/1000) {
    throw new Error("Deadline passed");
  }
  
  // Check description
  if (!task.descriptionHash || 
      isLikelyLegacyPlaceholderHash(task.descriptionHash)) {
    throw new Error("Invalid description");
  }
}
```

### Reentrancy Protection
- All contract calls use nonReentrant pattern
- ETH operations guarded by checks-effects-interactions
- State updates before external calls

## 🌐 NETWORK CONFIGURATION

### Required Environment Variables
```bash
# Worker key (required)
WORKER_PRIVATE_KEY=0x...

# RPC URLs
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_SEPOLIA_WS_URL=wss://sepolia.base.org  # Optional but recommended

# Optional: Rate limiting
TASK_POLL_INTERVAL=15000       # ms, default 15s
TASK_POLL_TIMEOUT=300000       # ms, default 5min
```

### WebSocket vs HTTP Fallback
```typescript
if (wsUrl) {
  // Try WebSocket first (real-time)
  const eventListener = new EventListener(wsUrl);
  await eventListener.connect();
} else {
  // Fall back to polling
  while (true) {
    await pollForTasks();
    await sleep(15000);
  }
}
```

## 🎯 PERFORMANCE OPTIMIZATIONS

### Connection Pooling
- Reuse WebSocket connections
- Batch RPC requests when possible
- Cache contract reads (30s TTL)

### Parallel Processing
```typescript
// Process multiple tasks in parallel (with limits)
const CONCURRENCY_LIMIT = 3;
const semaphore = new Semaphore(CONCURRENCY_LIMIT);

for (const task of tasks) {
  await semaphore.acquire();
  processTask(task).finally(() => semaphore.release());
}
```

### Gas Optimization
- **Task assignment events**: Cheaper than polling
- **Batched submissions**: Group related operations
- **Minimal state writes**: Only update on completion

## 📋 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Generate worker private key securely
- [ ] Fund worker wallet with test ETH (testnet) or real ETH (mainnet)
- [ ] Set WORKER_PRIVATE_KEY in .env
- [ ] Configure BASE_SEPOLIA_WS_URL for real-time (optional but recommended)
- [ ] Verify contract addresses match deployment
- [ ] Test with single task first

### Deployment Steps
```bash
# 1. Set environment
cp agents/.env.example agents/.env
# Edit .env with WORKER_PRIVATE_KEY

# 2. Verify balance
npx tsx -e "import { createWallet } from './agents/lib/config'; 
  const { wallet } = createWallet(process.env.WORKER_PRIVATE_KEY!); 
  console.log('Balance:', await wallet.getBalance())"

# 3. Start worker
WORKER_MODE=external node agents/worker.ts

# Or demo mode
WORKER_MODE=demo node agents/worker.ts
```

### Monitoring
```bash
# Watch logs
tail -f worker.log | grep -E "(Processing|Event|Submitted|Error)"

# Check task count
npx tsx -e "import { createWallet } from './agents/lib/config'; 
  const { publicClient } = createWallet(''); 
  const count = await publicClient.readContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: 'getWorkerTasks',
    args: [WORKER_ADDRESS]
  });
  console.log('Active tasks:', count);"
```

## 🚨 TROUBLESHOOTING

### Issue: Worker not receiving tasks
- **Check**: WebSocket connection established
- **Verify**: Worker address registered in TaskEscrow
- **Test**: Switch to polling mode temporarily

### Issue: Tasks stuck in InProgress
- **Check**: Worker crashed or disconnected
- **Solution**: Startup recovery will process orphaned tasks
- **Prevention**: Heartbeat events (future enhancement)

### Issue: Decryption failures
- **Check**: Client public key correct
- **Verify**: Lit Protocol properly configured
- **Fallback**: Check if task is actually unencrypted

### Issue: High gas costs
- **Optimize**: Increase polling interval
- **Batch**: Process multiple tasks per transaction
- **Timing**: Submit during low network congestion

## 📊 COMPATIBILITY

### With MCP Server
- Worker registers via agent registry
- MCP can query worker status
- Task assignment via events or polling
- No direct coupling - loosely coupled architecture

### With Client Agent
- Client posts task to marketplace
- Worker detects assignment via events
- Completion triggers verification
- Payment flows automatically

### With Verifier
- Worker submits work hash
- Verifier validates off-chain
- Results submitted on-chain
- Reputation updated accordingly

## 🔮 FUTURE ENHANCEMENTS

### Near-term
- [ ] Heartbeat events for liveness detection
- [ ] Worker health monitoring dashboard
- [ ] Auto-scaling worker instances
- [ ] Priority task queues

### Mid-term
- [ ] Worker reputation delegation
- [ ] Skill-based task routing
- [ ] Multi-chain worker support
- [ ] Cross-chain task execution

### Long-term
- [ ] AI-powered task optimization
- [ ] Predictive task assignment
- [ ] Worker DAO governance
- [ ] Reputation derivatives