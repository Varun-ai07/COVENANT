---
name: covenant-verify
description: |
  Universal project verification skill for COVENANT protocol.
  3-stage verification pipeline: automated gatekeeper → deep analysis → on-chain attestation.
  Use when verifying a worker's submitted deliverable.
---

# COVENANT Verify Skill — Production Verification

3-stage verification pipeline for COVENANT protocol tasks.

## Usage

```
/covenant-verify <github-url> [--depth quick|standard|deep] [--requirements "task requirements"]
```

## 3-Stage Pipeline

### Stage 1: Automated Gatekeeper (instant)
- Lint check (ESLint, Prettier)
- Build check (compiles without errors)
- Test check (tests exist and pass)
- Security scan (eval, innerHTML, SQL injection)
- Secret detection (hardcoded keys, .env files)

### Stage 2: Deep Analysis (30s-2min)
- Code quality (LOC, complexity, any types, TODOs)
- Architecture (file structure, modules, dependencies)
- Security deep scan (XSS, child_process, patterns)
- Performance (bundle size, large files)
- Testing quality (coverage, assertions)
- Documentation (README, code comments)
- LLM analysis (deep mode only — smart contract checks)

### Stage 3: On-Chain Attestation
- Generate evidence hash (SHA256)
- Store report on IPFS
- Record verification on CovenantAttestation contract

## Scoring

| Dimension | Weight |
|-----------|--------|
| Stage 1: Gatekeeper | 33% |
| Stage 2: Deep Analysis | 33% |
| Stage 3: Attestation | 33% |

**Verdict:**
- Score ≥ 70: PASS
- Score ≥ 40: PARTIAL
- Score < 40: FAIL

## Examples

### Quick verification
```
/covenant-verify https://github.com/worker/project --depth quick
```

### Deep verification with requirements
```
/covenant-verify https://github.com/worker/project --depth deep --requirements "Solidity smart contract with reentrancy guards, 90% test coverage"
```

### Smart contract verification
```
/covenant-verify https://github.com/worker/token-contract --depth deep --requirements "ERC-20 token with governance, no reentrancy vulnerabilities"
```

## Output

```json
{
  "score": 85,
  "verdict": "pass",
  "stage1": { "passed": true, "score": 90, "checks": [...] },
  "stage2": { "passed": true, "score": 85, "checks": [...] },
  "stage3": { "passed": true, "score": 80, "checks": [...] },
  "summary": "Score: 85/100 (3/3 stages passed)...",
  "recommendations": ["..."],
  "evidenceHash": "abc123...",
  "reportCid": "Qm...",
  "repoUrl": "https://github.com/worker/project",
  "timestamp": 1234567890
}
```

## Integration with COVENANT

After verification passes:
1. Client calls `corven_task({ action: 'verify', taskId: 1, success: true })`
2. Worker gets paid
3. Attestation recorded on-chain via CovenantAttestation

After verification fails:
1. Client calls `corven_task({ action: 'verify', taskId: 1, success: false })`
2. Worker can request revision via `corven_revision({ action: 'request', taskId: 1 })`
3. Or client files dispute via `corven_task({ action: 'dispute', taskId: 1 })`
