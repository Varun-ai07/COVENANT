---
name: covenant-verify
description: |
  Universal project verification skill for COVENANT protocol.
  Analyzes any GitHub project deeply — code quality, security, performance, architecture.
  Use when verifying a worker's submitted deliverable.
---

# COVENANT Verify Skill

Universal project verification for COVENANT protocol tasks.

## Usage

```
/covenant-verify <github-url> [--depth quick|standard|deep] [--requirements "task requirements"]
```

## What It Does

1. Clones the GitHub repository
2. Analyzes the entire codebase
3. Scores the project on 8 dimensions
4. Returns structured verification result

## Verification Dimensions

| Dimension | Weight | What It Checks |
|-----------|--------|----------------|
| Code Quality | 20% | Lines of code, complexity, naming, duplication |
| Architecture | 15% | File structure, modules, dependencies, patterns |
| Security | 20% | Vulnerabilities, hardcoded secrets, auth gaps |
| Performance | 15% | Bundle size, imports, memory, algorithms |
| Testing | 15% | Coverage, quality, edge cases, mocks |
| Documentation | 5% | README, comments, API docs, examples |
| Dependencies | 5% | Outdated, vulnerable, unused, licenses |
| Best Practices | 5% | Error handling, types, linting, git hygiene |

## Output Format

```json
{
  "score": 85,
  "verdict": "pass",
  "checks": [
    {"dimension": "code_quality", "score": 88, "details": "..."},
    {"dimension": "security", "score": 92, "details": "..."},
    ...
  ],
  "summary": "High-quality Three.js portfolio with optimized shaders...",
  "recommendations": ["Consider adding error boundaries...", ...],
  "evidenceHash": "Qm..."
}
```

## Examples

### Verify a 3D Portfolio
```
/covenant-verify https://github.com/worker/threejs-portfolio --depth deep --requirements "Three.js 3D portfolio with custom shaders, responsive design, 60fps"
```

### Verify an AI Agent
```
/covenant-verify https://github.com/worker/trading-agent --depth standard --requirements "Autonomous trading agent with LangChain"
```

### Verify a Smart Contract
```
/covenant-verify https://github.com/worker/token-contract --depth deep --requirements "ERC-20 token with governance"
```
