---
name: contract-audit
description: |
  Line-by-line security and correctness audit of Solidity smart contracts.
  Use when auditing contracts for vulnerabilities, especially for protocols handling real money.
  Checks: reentrancy, integer overflow, access control, CEI pattern, gas optimization, custom errors.
---

# Contract Audit Skill — Security-First Line-by-Line Review

Comprehensive security audit for Solidity contracts in the COVENANT protocol.

## Usage

```
/contract-audit [path/to/contracts] [--depth quick|standard|deep] [--focus security|gas|all]
```

Default: `contracts/contracts/v5/` with `--depth deep --focus security`

## Audit Checklist

### 1. Reentrancy (CRITICAL)
- Check every `.call{value:}`. `.transfer()`, `.send()` for CEI pattern
- Verify `nonReentrant` modifier on ALL functions that send ETH
- Check for cross-function reentrancy (multiple state-changing functions sharing storage)
- Flag any external call BEFORE state update

### 2. Access Control (CRITICAL)
- Verify `onlyOwner` on ALL administrative functions
- Check for missing access controls on sensitive operations
- Verify role-based access if using OpenZeppelin AccessControl
- Check for unprotected selfdestruct/SELFDESTRUCT

### 3. Integer Overflow/Underflow (HIGH)
- Verify Solidity 0.8.x (built-in checks) or SafeMath usage
- Check for potential underflow in subtraction operations
- Check for overflow in multiplication with large numbers
- Verify token amount calculations don't overflow

### 4. CEI Pattern (HIGH)
- Checks → Effects → Interactions pattern
- State changes BEFORE external calls
- Event emission BEFORE external calls
- Require statements before state changes

### 5. Gas Optimization (MEDIUM)
- Check for unnecessary storage reads (cache in memory)
- Verify efficient use of calldata vs memory
- Check for redundant operations
- Verify optimized loops (no unbounded loops)

### 6. Custom Errors (LOW)
- Replace `require(condition, "string")` with custom errors
- Saves gas and provides better error messages
- Example: `error InsufficientBalance(); require(balance >= amount, InsufficientBalance());`

### 7. Events (MEDIUM)
- Verify ALL state-changing functions emit events
- Check event parameters match function parameters
- Verify indexed parameters for efficient filtering

### 8. Storage Layout (MEDIUM)
- Check for storage collision in upgradeable contracts
- Verify initializer pattern (not constructor)
- Check for missing initialized flag

### 9. Front-Running (MEDIUM)
- Check for MEV-extractable operations
- Verify commit-reveal patterns where needed
- Check for predictable transaction ordering

### 10. Denial of Service (LOW)
- Check for unbounded loops
- Verify gas limits in external calls
- Check for locked funds (no way to withdraw)

## Output Format

```markdown
## Contract Audit Report: [Contract Name]

### Summary
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW / INFO
- **Issues Found**: N
- **Critical**: N
- **High**: N
- **Medium**: N
- **Low**: N

### Critical Issues
1. **[CRITICAL-1] Reentrancy in `withdraw()`**
   - File: `contracts/v5/core/CovenantEscrow.sol:45`
   - Line: ` payable(msg.sender).call{value: amount}("");`
   - Issue: External call before state update
   - Fix: Move state update before external call
   - Code: 
     ```solidity
     // Before (vulnerable)
     payable(msg.sender).call{value: amount}("");
     balances[msg.sender] -= amount;
     
     // After (fixed)
     balances[msg.sender] -= amount;
     payable(msg.sender).call{value: amount}("");
     ```

### High Issues
...

### Medium Issues
...

### Low Issues
...

### Gas Optimizations
...

### Recommendations
1. Add custom errors for all require statements
2. Use events for all state-changing functions
3. Consider adding pause functionality for emergency stops
```

## Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| CRITICAL | Can lead to loss of funds, contract compromise | Fix immediately |
| HIGH | Significant security risk, potential exploit | Fix before deployment |
| MEDIUM | Security concern, should be addressed | Fix before mainnet |
| LOW | Code quality, gas optimization | Fix when convenient |
| INFO | Best practices, suggestions | Consider fixing |

## Examples

### Quick audit
```
/contract-audit contracts/contracts/v5/core/ --depth quick
```

### Deep security audit
```
/contract-audit contracts/contracts/v5/ --depth deep --focus security
```

### Gas optimization audit
```
/contract-audit contracts/contracts/v5/ --depth standard --focus gas
```

## Integration with COVENANT

After audit completes:
1. Generate audit report with findings
2. Create fix recommendations with code examples
3. Track which issues are fixed vs pending
4. Re-audit after fixes to verify resolution
