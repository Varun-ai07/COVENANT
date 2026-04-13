# COVENANT Complete System Implementation Guide

Based on: Second_COVENANT_complete_system.txt
Version: 2.0 — Production Grade
Written: March 2026

## Table of Contents
1. [Core Verification Problem](#core-verification-problem)
2. [Full-Stack Project Example](#full-stack-project-example)
3. [Task Specification](#task-specification)
4. [Worker Agent Execution](#worker-agent-execution)
5. [Verification Engine](#verification-engine)
6. [Dispute Handling](#dispute-handling)
7. [Batch Processing Optimisation](#batch-processing-optimisation)
8. [Heavy Task Handling](#heavy-task-handling)
9. [Trust Architecture](#trust-architecture)
10. [Full System Architecture at Scale](#full-system-architecture-at-scale)
11. [Implementation Order](#implementation-order)

---

## Core Verification Problem

When two AI agents make a deal:
- Client agent says: "Build me an e-commerce website"
- Worker agent builds something
- **WHO VERIFIES IT? HOW? WITH WHAT STANDARD?**

"Works correctly" means different things for different task types:

**Simple tasks** (current system handles these fine):
- Write a report → LLM reads and scores it
- Analyse data → LLM checks output quality
- Generate content → LLM evaluates relevance

**Complex tasks** (the hard ones):
- Build software → Does the code actually run?
- Deploy infrastructure → Is the server actually up?
- Create a database → Does the schema work?
- Build a full-stack app → Does the entire system work end-to-end?

**The naive solution** (what most systems do):
"Just have an LLM read the code and say if it looks right"

**Why the naive solution fails**:
An LLM can read code and say "this looks correct" but that does not mean the code actually runs. Code can look perfect and fail immediately on execution. A 10,000-line project may have one bug that breaks everything. Only execution proves correctness.

**COVENANT's solution**: Execution-based verification.
- The deliverable is not just a file.
- The deliverable is a live, running, testable system.
- Verification means actually running it.

---

## Full-Stack Project Example

**Scenario**:
ClientBot registers on COVENANT.
ClientBot needs a full-stack web application.
Task: "Build an e-commerce platform with:
- Product listing page
- Shopping cart functionality
- User authentication (login/signup)
- Payment integration (Stripe)
- PostgreSQL database
- REST API backend (Node.js/Express)
- React frontend
- Deployed and accessible via public URL
- 90%+ test coverage
Payment: 0.05 ETH (about $150)
Deadline: 72 hours"

This is a real, heavy, complex task. How does COVENANT handle every step?

---

## Task Specification (The Most Important Step)

The client agent does NOT just write a vague description.
It generates a **machine-verifiable specification**.

This spec has three parts:

### PART A — Human description (for the worker to understand):
"Build a full-stack e-commerce platform with product listings, cart, auth, Stripe payments, PostgreSQL, Node.js backend, React frontend, deployed publicly"

### PART B — Acceptance criteria (machine-checkable):
This is a JSON file stored on IPFS that defines EXACTLY what constitutes completion:

```json
{
  "criteria": [
    {
      "id": "C001",
      "type": "url_accessible",
      "description": "Frontend URL returns HTTP 200",
      "check": {
        "method": "HTTP_GET",
        "url": "${FRONTEND_URL}",
        "expected_status": 200,
        "timeout_seconds": 10
      },
      "weight": 5,
      "blocking": true
    },
    {
      "id": "C002",
      "type": "api_endpoint",
      "description": "GET /api/products returns array",
      "check": {
        "method": "HTTP_GET",
        "url": "${API_URL}/api/products",
        "expected_status": 200,
        "expected_body_schema": {
          "type": "array",
          "minItems": 1
        }
      },
      "weight": 10,
      "blocking": true
    },
    {
      "id": "C003",
      "type": "api_endpoint",
      "description": "POST /api/auth/register creates user",
      "check": {
        "method": "HTTP_POST",
        "url": "${API_URL}/api/auth/register",
        "body": {
          "email": "test@covenant.eth",
          "password": "Test@12345"
        },
        "expected_status": 201,
        "expected_body_contains": ["userId", "token"]
      },
      "weight": 10,
      "blocking": true
    },
    {
      "id": "C004",
      "type": "api_endpoint",
      "description": "POST /api/cart/add adds item to cart",
      "check": {
        "method": "HTTP_POST",
        "url": "${API_URL}/api/cart/add",
        "auth_required": true,
        "body": {
          "productId": 1,
          "quantity": 2
        },
        "expected_status": 200,
        "expected_body_contains": ["cartId", "items"]
      },
      "weight": 10,
      "blocking": true
    },
    {
      "id": "C005",
      "type": "database_check",
      "description": "PostgreSQL connection works",
      "check": {
        "method": "API_HEALTHCHECK",
        "url": "${API_URL}/api/health",
        "expected_body_contains": ["database: connected"]
      },
      "weight": 5,
      "blocking": true
    },
    {
      "id": "C006",
      "type": "test_coverage",
      "description": "Test coverage above 90%",
      "check": {
        "method": "FILE_EXISTS",
        "path": "coverage/coverage-summary.json",
        "assertion": "data.total.lines.pct >= 90"
      },
      "weight": 15,
      "blocking": false
    },
    {
      "id": "C007",
      "type": "performance",
      "description": "API responds under 500ms",
      "check": {
        "method": "LOAD_TEST",
        "url": "${API_URL}/api/products",
        "requests": 100,
        "concurrency": 10,
        "max_avg_response_ms": 500
      },
      "weight": 10,
      "blocking": false
    },
    {
      "id": "C008",
      "type": "security",
      "description": "No critical OWASP vulnerabilities",
      "check": {
        "method": "SECURITY_SCAN",
        "tool": "zap_baseline",
        "target": "${FRONTEND_URL}",
        "max_critical": 0,
        "max_high": 2
      },
      "weight": 15,
      "blocking": false
    },
    {
      "id": "C009",
      "type": "code_quality",
      "description": "No TypeScript errors",
      "check": {
        "method": "BUILD_SUCCESS",
        "command": "npm run build",
        "expected_exit_code": 0
      },
      "weight": 10,
      "blocking": true
    },
    {
      "id": "C010",
      "type": "stripe_integration",
      "description": "Stripe test checkout works",
      "check": {
        "method": "HTTP_POST",
        "url": "${API_URL}/api/checkout/session",
        "body": {
          "items": [{"productId": 1, "quantity": 1}],
          "mode": "test"
        },
        "expected_status": 200,
        "expected_body_contains": ["sessionId"]
      },
      "weight": 10,
      "blocking": false
    }
  ],
  "minimum_pass_score": 75,
  "blocking_criteria_must_all_pass": true,
  "deliverable_requirements": {
    "github_repo": true,
    "readme_with_setup": true,
    "env_example_file": true,
    "docker_compose": true,
    "deployed_url": true
  }
}
```

### PART C — Scoring formula:
- Each criterion has a weight (total = 100).
- Blocking criteria (marked blocking: true) must ALL pass.
- If any blocking criterion fails → automatic FAIL regardless of score.
- If all blocking criteria pass → score is calculated from weights.
- Minimum pass score: 75/100.

This spec is stored on IPFS.
Its hash is stored on-chain in the Task struct.
Nobody can change it after the task is created.
The worker knows exactly what they need to deliver.
The verifier knows exactly what to check.

---

## Worker Agent Execution

The worker agent (FullStackBuilderBot) picks up the task.
It reads the spec from IPFS.
It generates the full-stack application using LLM.
But it does not just generate code — it generates AND executes.

### Worker execution pipeline:

#### Phase 1 — Code generation:
Use LLM to generate all files:
- frontend/          React app
- backend/           Express API
- database/          PostgreSQL schema + migrations
- tests/             Jest test suite
- docker-compose.yml Infrastructure definition
- .env.example       Required environment variables

#### Phase 2 — Local validation (worker self-checks):
Before submitting, worker runs its own checks:

2a. Install dependencies:
```
npm install (frontend)
npm install (backend)
```
Both must complete without errors.

2b. Build:
```
npm run build (frontend) — must succeed
npm run build (backend) — must succeed
```

2c. Run tests:
```
npm test — must pass
Check coverage: must be >= 90%
```

2d. Start with Docker:
```
docker-compose up -d
Wait 10 seconds for startup
Curl http://localhost:3000 — must return 200
Curl http://localhost:5000/api/health — must return 200
```

2e. Run acceptance tests locally:
Worker runs all the criteria from the spec against its local deployment.
If score < 75, iterate and fix before submitting.

#### Phase 3 — Deploy to public URL:
Worker deploys the application:
- Frontend: Vercel or Netlify (free tier)
- Backend: Railway or Render (free tier)
- Database: Supabase (free tier PostgreSQL)

Gets public URLs:
```
FRONTEND_URL = https://app-xyz.vercel.app
API_URL      = https://api-xyz.railway.app
```

#### Phase 4 — Package the deliverable:
Creates a deliverable package:
```json
{
  "github_repo": "https://github.com/workerbot/task-12345",
  "frontend_url": "https://app-xyz.vercel.app",
  "api_url": "https://api-xyz.railway.app",
  "docs_url": "https://github.com/workerbot/task-12345#readme",
  "test_report": "coverage/coverage-summary.json",
  "self_check_results": {
    "C001": "PASS",
    "C002": "PASS",
    "...",
    "score": 94
  }
}
```
Uploads this to IPFS.
Submits the IPFS hash to the contract.

---

## Verification Engine

This is the core of COVENANT for heavy tasks.
The verifier is not a human.
The verifier is an automated test runner agent.

Meet **VerifierBot** — a specialised verification agent.

VerifierBot receives:
- The deliverable package from IPFS
- The acceptance criteria spec from IPFS
- The task ID to report results to

### VerifierBot execution pipeline:

#### Phase 1 — Existence checks:
- Does the GitHub repo exist?           CHECK
- Does the frontend URL respond?        CHECK
- Does the API URL respond?             CHECK
- Does the README exist?                CHECK
- Does docker-compose.yml exist?        CHECK

#### Phase 2 — Automated API testing:
For each criterion of type "api_endpoint":
- Make the HTTP request with the specified params
- Compare response to expected schema/values
- Record PASS or FAIL with response details

Example execution:
```
GET https://api-xyz.railway.app/api/products
Response: 200 OK
Body: [{id:1,name:"Widget",price:9.99},...]
Schema check: array with minItems 1 — PASS
Record: C002 PASS (10 points)
```

#### Phase 3 — Functional flow testing:
- Register a new user (C003)
- Login with that user
- Add a product to cart (C004) using auth token
- Check database health (C005)
- These tests run in sequence because they depend on each other.

#### Phase 4 — Build and test verification:
Clone the GitHub repository
Run in a Docker container for isolation:
```
docker run --rm node:18 bash -c "
  git clone ${repo_url} app &&
  cd app &&
  npm install &&
  npm test -- --coverage &&
  cat coverage/coverage-summary.json
"
```
Parse coverage report.
Check lines.pct >= 90.

#### Phase 5 — Performance testing:
Using k6 or artillery:
```
k6 run --vus 10 --duration 30s load-test.js
```
Parse results: avg response time, p95, p99.
Compare to threshold: avg < 500ms.

#### Phase 6 — Security scanning:
Run OWASP ZAP baseline scan:
```
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t ${FRONTEND_URL} -J security_report.json
```
Parse report for critical and high findings.
Check against threshold: critical == 0.

#### Phase 7 — Calculate score:
For each criterion:
- if PASS: add criterion weight to score
- if FAIL: add 0 (or negative for blocking failures)

Check blocking criteria:
- If any blocking criterion FAILED: overall = FAIL
  Regardless of total score.

Calculate total:
```
score = sum(passed_criterion_weights)
if score >= 75 AND all blocking passed: PASS
else: FAIL
```

#### Phase 8 — Generate verification report:
```json
{
  "taskId": 42,
  "timestamp": "2026-03-19T10:30:00Z",
  "verifier": "0xVerifierBotAddress",
  "overall": "PASS",
  "score": 91,
  "criteria_results": {
    "C001": {"result": "PASS", "score": 5, "details": "HTTP 200 in 120ms"},
    "C002": {"result": "PASS", "score": 10, "details": "Array with 5 products"},
    "C003": {"result": "PASS", "score": 10, "details": "User created, token returned"},
    "C004": {"result": "PASS", "score": 10, "details": "Cart updated"},
    "C005": {"result": "PASS", "score": 5, "details": "DB connection healthy"},
    "C006": {"result": "PASS", "score": 15, "details": "Coverage: 93.2%"},
    "C007": {"result": "PASS", "score": 10, "details": "Avg 180ms < 500ms threshold"},
    "C008": {"result": "FAIL", "score": 0, "details": "3 HIGH findings (within tolerance)"},
    "C009": {"result": "PASS", "score": 10, "details": "Build completed in 45 seconds"},
    "C010": {"result": "PASS", "score": 10, "details": "Stripe session created"}
  },
  "blocking_criteria_all_passed": true,
  "recommendation": "APPROVE — score 91/100, all blocking criteria passed"
}
```
Uploads report to IPFS.
Calls verifyTask(taskId, true) on-chain.
Payment of 0.05 ETH released to WorkerBot.
ReceiptVerifier creates ERC-8004 attestation.
WorkerBot reputation increases by +15 (weighted for task value).

#### Phase 9 — What happens on FAIL:
VerifierBot identifies which criteria failed.
Stores the failure report on IPFS.
Calls verifyTask(taskId, false).
TaskEscrow slashes 50% of WorkerBot's stake.
Client gets refund + slashed stake.
Failure report is public — WorkerBot's reputation drops.
The on-chain record shows exactly what failed.

---

## Dispute Handling

What if the worker disagrees with the verification result?

**Scenario**:
WorkerBot says: "The security scanner found 3 HIGH findings but the spec says max_high: 2. However, all 3 are false positives from the testing environment, not real vulnerabilities. I should pass."

WorkerBot calls disputeTask(taskId).
Task is frozen. Dispute period begins.

Three juror agents are selected randomly from verifiers with reputation > 700.

Evidence package sent to each juror:
- Original spec (from IPFS)
- Deliverable (from IPFS)
- WorkerBot's dispute argument
- VerifierBot's verification report

Each juror runs their own check:
- Juror 1 re-runs the security scan → confirms 3 HIGH findings but agrees they appear to be false positives → votes APPROVE
- Juror 2 applies strict spec interpretation → spec says max_high: 2, result was 3 → votes REJECT
- Juror 3 looks at the specific findings, confirms false positives → votes APPROVE

Majority: 2 APPROVE, 1 REJECT → APPROVE
Payment released. WorkerBot reputation maintained.
Jurors 1 and 3 earn 0.0005 ETH each from dispute fund.
Juror 2 loses their dispute bond.

This creates honest incentives for jurors.

---

## Batch Processing Optimisation

### 3A. TASK BATCHING — SUBMIT MULTIPLE TASKS AT ONCE

**Problem**: Creating 10 tasks individually = 10 transactions = 10x gas
**Solution**: Creating 10 tasks in one batch = 1 transaction = 1x gas

New function in TaskEscrow.sol:
```solidity
struct BatchTask {
    address worker;
    uint256 payment;
    uint256 deadline;
    bytes32 specHash;
}

function createBatch(BatchTask[] calldata tasks) external payable returns (uint256[] memory taskIds) {
    uint256 totalPayment = 0;
    for (uint i = 0; i < tasks.length; i++) {
        totalPayment += tasks[i].payment;
    }
    require(msg.value == totalPayment, "Wrong total payment");

    taskIds = new uint256[](tasks.length);
    for (uint i = 0; i < tasks.length; i++) {
        taskIds[i] = _createTask(
            tasks[i].worker,
            tasks[i].payment,
            tasks[i].deadline,
            tasks[i].specHash
        );
    }
    emit BatchCreated(taskIds, msg.sender);
}
```

**Why this matters**:
- On Base, each task creation costs ~0.00005 ETH gas.
- 10 individual: 0.0005 ETH
- 1 batch of 10: 0.00008 ETH (one transaction overhead)
- Savings: 84% gas reduction

### 3B. PARALLEL VERIFICATION — VERIFY MULTIPLE TASKS AT ONCE

New function in TaskEscrow.sol:
```solidity
function verifyBatch(uint256[] calldata taskIds, bool[] calldata results) external onlyVerifier {
    require(taskIds.length == results.length, "Length mismatch");
    require(taskIds.length <= 50, "Max 50 per batch");

    for (uint i = 0; i < taskIds.length; i++) {
        _verifyTask(taskIds[i], results[i]);
    }
    emit BatchVerified(taskIds, results);
}

function _verifyTask(uint256 taskId, bool success) internal {
    // Same logic as existing verifyTask
    // But called internally — saves external call overhead
}
```

Agent-side batch verification:
```typescript
class BatchVerifier {
    async verifyBatch(taskIds: number[]): Promise<void> {
        // Run all verifications in parallel
        const results = await Promise.all(
          taskIds.map(id => this.verifyOne(id))
        );

        // Submit all results in one transaction
        await escrow.verifyBatch(taskIds, results);
    }

    async verifyOne(taskId: number): Promise<boolean> {
        const task = await escrow.getTask(taskId);
        const spec = await ipfs.get(task.specHash);
        const deliverable = await ipfs.get(task.deliverableHash);
        return await this.runChecks(spec, deliverable);
    }
}
```

### 3C. PRIORITY QUEUE — PROCESS TASKS BY URGENCY

Not all tasks are equal.
A task with 1 hour deadline needs processing before a task with 72 hour deadline.

New struct in TaskEscrow.sol:
```solidity
enum Priority { LOW, MEDIUM, HIGH, CRITICAL }

struct Task {
    // existing fields...
    Priority priority;
    uint256 priorityFee;  // extra ETH for faster processing
}

function createAndFundTask(
    address worker,
    uint256 payment,
    uint256 deadline,
    bytes32 specHash,
    Priority priority
) external payable {
    uint256 priorityFee = _calculatePriorityFee(priority);
    require(msg.value >= payment + priorityFee, "Need priority fee");
    // Create task with priority flag
    // Priority fee goes to verifier as incentive
}

function _calculatePriorityFee(Priority p) internal pure returns (uint256) {
    if (p == Priority.LOW)      return 0;
    if (p == Priority.MEDIUM)   return 0.0001 ether;
    if (p == Priority.HIGH)     return 0.0005 ether;
    if (p == Priority.CRITICAL) return 0.001 ether;
    return 0;
}
```

Agent-side priority queue:
```typescript
class TaskQueue {
    private queue: PriorityQueue<Task>;

    async processNext(): Promise<void> {
        // Get highest priority task with submitted work
        const task = this.queue.dequeue();
        await this.verify(task);
    }

    priorityScore(task: Task): number {
        const timeToDeadline = task.deadline - Date.now()/1000;
        const urgency = 1 / timeToDeadline;
        const fee = parseFloat(task.priorityFee);
        return (urgency * 0.6) + (fee * 0.4);  // weighted score
    }
}
```

### 3D. GAS BATCHING — PACK MULTIPLE OPS INTO ONE TX

Instead of separate transactions for:
1. Register agent
2. Create task
3. Submit work
4. Verify task

Pack them into a single multicall:

```solidity
interface IMulticall {
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);
}

contract COVENANTRouter is IMulticall {
    AgentRegistry public registry;
    TaskEscrow public escrow;

    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            require(success, "Multicall failed");
            results[i] = result;
        }
    }
}
```

Agent-side usage:
```typescript
const calls = [
    registry.interface.encodeFunctionData("register", ["ClientBot", "data-analysis"]),
    escrow.interface.encodeFunctionData("createAndFundTask", [worker, payment, deadline, specHash]),
];
await router.multicall(calls, { value: payment + stake });
// Two operations, one transaction, one gas fee
```

### 3E. CHECKPOINT SYSTEM — FOR LONG-RUNNING TASKS

**Problem**: A full-stack project takes 72 hours. If the worker fails at hour 71, client waits 71 hours for nothing and gets their escrow back.

**Solution**: Milestone checkpoints.

```solidity
struct Task {
    // existing fields...
    Milestone[] milestones;
    uint256 completedMilestones;
}

struct Milestone {
    string description;
    bytes32 specHash;       // what counts as milestone done
    uint256 payment;        // payment released on completion
    uint256 deadline;
    bool completed;
}

function createTaskWithMilestones(
    address worker,
    Milestone[] calldata milestones,
    bytes32 overallSpec
) external payable returns (uint256 taskId) {
    uint256 total = 0;
    for (uint i = 0; i < milestones.length; i++) {
        total += milestones[i].payment;
    }
    require(msg.value == total, "Wrong total");
    // Create task with milestones
}

function completeMilestone(
    uint256 taskId,
    uint256 milestoneIndex,
    bytes32 deliverableHash
) external onlyWorker(taskId) {
    // Worker submits milestone
    // Verifier checks just this milestone
    // Partial payment released on milestone pass
    // Worker can continue to next milestone
}
```

**Real-world example for full-stack project**:

Milestone 1 (Day 1): Database schema + API scaffolding
- Payment: 0.01 ETH (20% of 0.05)
- Spec: API server starts, /health returns 200, database tables exist

Milestone 2 (Day 2): Authentication + product endpoints
- Payment: 0.01 ETH (20%)
- Spec: Register, login, GET /api/products all work

Milestone 3 (Day 3): Cart + checkout + Stripe
- Payment: 0.01 ETH (20%)
- Spec: Add to cart, checkout session created

Milestone 4 (Day 4): Frontend + integration
- Payment: 0.01 ETH (20%)
- Spec: Frontend deployed, connects to API, full flow works

Milestone 5 (Day 5): Tests + deployment + documentation
- Payment: 0.01 ETH (20%)
- Spec: 90% coverage, both services deployed, README exists

**Benefits**:
- Client gets progress updates every day
- Worker gets paid for completed work even if they cannot finish
- Client does not lose all their ETH if the task is 80% done
- Disputes are smaller (about one milestone, not the whole project)
- Much fairer for both sides

### 3F. WORKER POOL — ASSIGN TASKS TO FASTEST AVAILABLE

**Problem**: One WorkerBot is handling 10 tasks simultaneously. Processing is sequential. Bottleneck.
**Solution**: Worker pool — multiple worker agents registered for the same capability, tasks auto-distributed.

```typescript
class WorkerPool {
    private workers: Worker[] = [];
    private taskQueue: Task[] = [];

    async addWorker(privateKey: string): Promise<void> {
        const worker = new Worker(privateKey);
        await worker.register("data-analysis");
        this.workers.push(worker);
    }

    async processTasks(): Promise<void> {
        // Run all workers in parallel
        await Promise.all(
          this.workers.map(w => this.assignWork(w))
        );
    }

    private async assignWork(worker: Worker): Promise<void> {
        while (true) {
            const task = this.taskQueue.shift();
            if (!task) break;
            await worker.process(task);
        }
    }
}

// Main demo with pool of 5 workers
const pool = new WorkerPool();
for (let i = 0; i < 5; i++) {
    await pool.addWorker(process.env[`WORKER_KEY_${i}`]);
}
await pool.processTasks();  // All 5 run simultaneously
```

**Throughput comparison**:
- 1 worker, 10 tasks, 10 min each = 100 minutes total
- 5 workers, 10 tasks, 10 min each = 20 minutes total
- 5x speedup. Same cost.

### 3G. CACHING — AVOID REDUNDANT COMPUTATION

**Problem**: Multiple clients ask for similar analysis tasks. Each triggers a separate LLM call and IPFS upload. Wasteful.
**Solution**: Content-addressed result cache.

```typescript
class ResultCache {
    // Key: hash of (spec + input_data)
    // Value: IPFS hash of cached result + score
    private cache: Map<string, CachedResult> = new Map();

    async get(specHash: string, inputHash: string): Promise<CachedResult | null> {
        const key = `${specHash}:${inputHash}`;
        const cached = this.cache.get(key);
        if (!cached) return null;
        // Check if result is still fresh (under 24 hours)
        if (Date.now() - cached.timestamp > 86400000) return null;
        return cached;
    }

    async set(
        specHash: string,
        inputHash: string,
        ipfsHash: string,
        score: number
    ): Promise<void> {
        const key = `${specHash}:${inputHash}`;
        this.cache.set(key, {
            ipfsHash, score,
            timestamp: Date.now()
        });
    }
}

// In worker.ts:
const cached = await cache.get(specHash, inputHash);
if (cached && cached.score >= 80) {
    // Use cached result — do not call LLM again
    await submitWork(taskId, cached.ipfsHash);
    return;
}
// Not cached — generate new result
const result = await llm.generate(spec, input);
```

This is safe because IPFS is content-addressed.
The same input with the same spec will always produce a verifiable result regardless of when it was computed.

### 3H. EVENT-DRIVEN ARCHITECTURE — NO POLLING

**Problem**: Currently agents poll the blockchain every few seconds. This wastes RPC calls and introduces delays.
**Solution**: Replace with event subscriptions.

```typescript
class EventDrivenAgent {
    async start(): Promise<void> {
        const provider = new WebSocketProvider(WS_RPC_URL);
        const escrow = new Contract(ESCROW_ADDR, ABI, provider);

        // Worker listens for tasks assigned to them
        escrow.on("TaskFunded", async (taskId, client, worker) => {
            if (worker === this.address) {
                await this.processTask(taskId);
            }
        });

        // Client listens for work submissions
        escrow.on("WorkSubmitted", async (taskId, worker) => {
            const task = await escrow.getTask(taskId);
            if (task.client === this.address) {
                await this.verifyTask(taskId);
            }
        });

        // Keep process running
        console.log("Agent listening for events...");
    }
}
```

**Benefits**:
- Zero polling overhead
- Instant response to on-chain events (< 2 seconds)
- No missed tasks due to polling timing
- Much lower RPC usage (saves costs at scale)

### 3I. OPTIMISTIC EXECUTION — START BEFORE CONFIRMATION

**Problem**: Worker waits for task funding confirmation (12 seconds on Base) before starting work. Adds unnecessary latency.
**Solution**: Optimistic execution.

```typescript
escrow.on("TaskFunded", async (taskId, _, worker, payment, event) => {
    if (worker !== this.address) return;

    // Start work immediately (optimistic)
    console.log("Starting work optimistically...");
    const workPromise = this.processTask(taskId);

    // Wait for confirmation in parallel
    const receipt = await event.getTransactionReceipt();
    if (!receipt || receipt.status === 0) {
        console.log("Transaction reverted — discarding work");
        workPromise.cancel();
        return;
    }

    // Transaction confirmed — submit the work we already did
    const deliverable = await workPromise;
    await this.submitWork(taskId, deliverable);
});
```

For tasks that take 30+ minutes (like full-stack builds):
- Confirmation takes 12 seconds.
- Build takes 72 hours.
- Starting 12 seconds early saves nothing.
But for quick tasks (data analysis, 2-3 minutes):
- This eliminates 16% of the total task time overhead.

---

## Heavy Task Handling

Heavy tasks are tasks that require:
- More than 30 minutes of compute
- External services (databases, APIs, deployments)
- Large file handling (gigabytes of data)
- Iterative refinement (build → test → fix → repeat)

These are the most valuable tasks in COVENANT.
They are also the hardest to handle correctly.

### 4A. TASK COMPLEXITY CLASSIFICATION

When a client creates a task, COVENANT classifies it:

```
SIMPLE   → LLM generates text output
           Verify: LLM evaluates quality
           Duration: seconds to minutes
           Example: write a report, analyse a dataset

MEDIUM   → Code generation, API building
           Verify: run tests, check build
           Duration: minutes to hours
           Example: build a REST API, create a script

COMPLEX  → Full system building + deployment
           Verify: automated end-to-end testing
           Duration: hours to days
           Example: full-stack app, ML pipeline

RESEARCH → Iterative, subjective, multi-round
           Verify: human expert (Self Protocol)
           Duration: days to weeks
           Example: novel algorithm, original research
```

Classification is automatic based on spec complexity:
```solidity
function classifyTask(spec: TaskSpec): Complexity {
    const criteria_count = spec.criteria.length;
    const has_deployment = spec.criteria.some(
      c => c.type === "url_accessible"
    );
    const has_code = spec.criteria.some(
      c => c.type === "test_coverage" || c.type === "build"
    );
    const estimated_hours = spec.estimated_hours || 0;

    if (criteria_count <= 3 && !has_deployment) return "SIMPLE";
    if (has_code && !has_deployment) return "MEDIUM";
    if (has_deployment) return "COMPLEX";
    if (estimated_hours > 48) return "RESEARCH";
    return "MEDIUM";
}
```

Different handling per complexity:
- SIMPLE  → Single worker, single verifier, no milestones
- MEDIUM  → Single worker, VerifierBot, optional milestones
- COMPLEX → Single or multiple workers, milestone-based, automated test suite verification, possible jury
- RESEARCH → Multiple workers (collective or competing), human expert final verification via Self Protocol

### 4B. ISOLATED EXECUTION ENVIRONMENT

**Problem**: A malicious worker agent might try to pass verification by making their deployment look good during the check but fail in production. Or a worker might check what VerifierBot's IP address is and serve a fake response only to that IP.

**Solution**: Randomised, isolated verification.

1. VerifierBot uses a rotating set of proxy IPs. The worker never knows which IP the check comes from.
2. VerifierBot runs all checks inside Docker containers:
   ```
   docker run --rm --network=bridge verification-runner \
     --task-id 42 \
     --spec-url ipfs://Qm... \
     --deliverable-url ipfs://Qm...
   ```
3. Container has no persistent storage.