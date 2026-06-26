---
name: production-readiness
description: |
  Comprehensive production readiness audit for the COVENANT protocol.
  Checks contracts, MCP tools, SDK, CLI, and cross-layer consistency.
  Use before deploying to mainnet or after major refactors.
---

# Production Readiness Audit — Full Protocol Review

Comprehensive audit of the entire COVENANT protocol for production deployment.

## Usage

```
/production-readiness [--layers contracts|mcp|sdk|cli|frontend|all] [--fix] [--report]
```

Default: `--layers all --report`

## Audit Layers

### Layer 1: Contracts (CRITICAL)
- Run `/contract-audit` on all V5 contracts
- Check for:
  - Reentrancy vulnerabilities
  - Access control issues
  - Integer overflow/underflow
  - CEI pattern violations
  - Gas optimization
  - Custom errors vs require strings
  - Event emissions
  - Storage layout (upgradeable)

### Layer 2: MCP Tools (HIGH)
- Read all tool files in `mcp/src/tools/`
- Check for:
  - ABI mismatches (V1 vs V5 function names)
  - Missing tool registrations
  - SDK integration (should use CovenantSDK, not direct calls)
  - Error handling (background-only, no raw JSON dumps)
  - Confirmation gates for write operations
  - Clean JSON-RPC output (no console.log)
  - Correct contract addresses in config

### Layer 3: SDK (HIGH)
- Read `covenant-sdk/src/`
- Check for:
  - All V5 contract methods exposed
  - Type safety (no `any` types)
  - Error handling
  - Documentation
  - Version consistency with package.json

### Layer 4: CLI (MEDIUM)
- Read `cli/src/`
- Check for:
  - All commands functional
  - Confirmation gates for ETH spending
  - Wallet balance checks
  - Error handling
  - User-friendly output
  - AI provider integration (OpenRouter, NVIDIA)

### Layer 5: Frontend (LOW)
- Read `frontend/src/`
- Check for:
  - Wallet connection (RainbowKit/wagmi)
  - Contract address configuration
  - V5 ABI usage
  - Error handling
  - Responsive design

### Layer 6: Cross-Layer Consistency (CRITICAL)
- Verify contracts ↔ MCP tools ↔ SDK ↔ CLI consistency:
  - All contract methods have corresponding MCP tools
  - All MCP tools have corresponding SDK methods
  - All SDK methods have corresponding CLI commands
  - Contract addresses match across all layers
  - ABI files match contract interfaces

## Audit Checklist

### Pre-Audit
- [ ] V5 contracts deployed and verified on Base Sepolia
- [ ] MCP tools registered in all platforms (Claude Code, MiMo Code, OpenClaude)
- [ ] SDK published to npm
- [ ] CLI published to npm
- [ ] All README files updated

### Security Checks
- [ ] No hardcoded private keys
- [ ] No secrets in logs/output
- [ ] Confirmation gates on ALL write operations
- [ ] Rate limiting implemented
- [ ] Input validation on all user inputs
- [ ] No eval() or innerHTML usage
- [ ] Sandboxed git clone
- [ ] No secrets in .env files committed

### Functionality Checks
- [ ] Agent registration works
- [ ] Task creation/funding works
- [ ] Task submission works
- [ ] Task verification works
- [ ] Dispute filing works
- [ ] Insurance claims work
- [ ] Governance voting works
- [ ] Batch operations work
- [ ] Milestone tracking works

### Integration Checks
- [ ] MCP connects to Claude Code
- [ ] MCP connects to MiMo Code
- [ ] MCP connects to OpenClaude
- [ ] CLI connects to contracts
- [ ] SDK connects to contracts
- [ ] Frontend connects to contracts

## Output Format

```markdown
# Production Readiness Report

## Executive Summary
- **Overall Score**: N/100
- **Verdict**: READY / NOT READY / CONDITIONAL
- **Critical Issues**: N
- **High Issues**: N
- **Medium Issues**: N

## Layer Scores

| Layer | Score | Status | Issues |
|-------|-------|--------|--------|
| Contracts | N/100 | ✅/❌ | N |
| MCP Tools | N/100 | ✅/❌ | N |
| SDK | N/100 | ✅/❌ | N |
| CLI | N/100 | ✅/❌ | N |
| Frontend | N/100 | ✅/❌ | N |
| Cross-Layer | N/100 | ✅/❌ | N |

## Critical Issues
1. **[CRITICAL-1] Reentrancy in CovenantEscrow.withdraw()**
   - Layer: Contracts
   - File: `contracts/v5/core/CovenantEscrow.sol:45`
   - Impact: Can drain contract funds
   - Fix: Move state update before external call

## High Issues
...

## Medium Issues
...

## Low Issues
...

## Recommendations
1. Fix all CRITICAL issues before mainnet
2. Fix all HIGH issues before mainnet
3. Consider fixing MEDIUM issues
4. Track LOW issues for future improvements

## Deployment Checklist
- [ ] All CRITICAL issues fixed
- [ ] All HIGH issues fixed
- [ ] Contracts redeployed and verified
- [ ] MCP tools updated and published
- [ ] SDK updated and published
- [ ] CLI updated and published
- [ ] README files updated
- [ ] All tests passing
```

## Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| CRITICAL | Can lead to loss of funds, protocol compromise | Fix before mainnet |
| HIGH | Significant security risk, potential exploit | Fix before mainnet |
| MEDIUM | Security concern, should be addressed | Fix before mainnet |
| LOW | Code quality, gas optimization | Fix when convenient |
| INFO | Best practices, suggestions | Consider fixing |

## Examples

### Full audit
```
/production-readiness --layers all --report
```

### Contracts only
```
/production-readiness --layers contracts --fix
```

### Cross-layer check
```
/production-readiness --layers contracts,mcp,sdk,cli --report
```

## Integration with COVENANT

After audit completes:
1. Generate comprehensive audit report
2. Create fix recommendations with priority
3. Track which issues are fixed vs pending
4. Re-audit after fixes to verify resolution
5. Update README with audit status
