# COVENANT — Platform Integration Analysis

> How COVENANT's 118 MCP tools integrate with every major AI agent platform.

---

## Executive Summary

COVENANT is an MCP server. Every platform that supports MCP automatically gets access to all 118 COVENANT tools. No custom integrations needed — just add the server config.

**Key insight:** MCP is the universal adapter. COVENANT doesn't need to build per-platform integrations. The MCP protocol does it for us.

---

## 1. Platforms That Support MCP (Direct Integration)

### Tier 1: IDEs & Code Editors

| Platform | MCP Support | Config Location | Integration Effort |
|----------|-------------|-----------------|-------------------|
| **Claude Code** | ✅ Native | `claude_desktop_config.json` | 1 command: `npx @varun-ai07/covenant-mcp add` |
| **Cursor** | ✅ Built-in | `.cursor/mcp.json` | Add JSON config |
| **Windsurf (Codeium)** | ✅ Built-in | MCP settings | Add JSON config |
| **Cline** | ✅ Built-in | VS Code settings | Add JSON config |
| **Roo Code** | ✅ Built-in | VS Code settings | Add JSON config |
| **Zed** | ✅ Built-in | MCP config | Add JSON config |
| **Continue** | ✅ Built-in | VS Code/JetBrains | Add JSON config |
| **Aider** | ✅ Built-in | CLI config | Add JSON config |
| **opencode** | ✅ Built-in | Terminal config | Add JSON config |

### Tier 1B: New Trending Coding Agents

| Platform | Type | MCP Support | Users | Integration |
|----------|------|-------------|-------|-------------|
| **OpenClaude (gitlawb)** | Open-source CLI agent (Claude Code fork) | ✅ Native MCP | Growing | Same as Claude Code — `npx @varun-ai07/covenant-mcp add` |
| **Hermes Agent (NousResearch)** | Open-source AI agent framework | ✅ MCP Registry | 169K+ GitHub stars | Add MCP server config |
| **Kilo Code** | VS Code extension, 500+ models | ✅ Built-in | 3M+ users | Add to VS Code MCP settings |
| **OpenCode** | Open-source terminal AI agent | ✅ Built-in | Growing | Add to terminal config |
| **OpenClaw** | Open-source always-on AI assistant | ✅ MCP support | Growing | Add MCP server |
| **NemoClaw (NVIDIA)** | OpenClaw + NVIDIA security guardrails | ✅ MCP support | Enterprise | Add MCP server with security controls |

---

## 2. Detailed Platform Analysis

### OpenClaude (gitlawb/openclaude)

**What:** Open-source fork of Claude Code that works with GPT-4o, Gemini, and other models.
**GitHub:** https://github.com/gitlawb/openclaude
**MCP:** Native support — same as Claude Code
**COVENANT Integration:** Same command — `npx @varun-ai07/covenant-mcp add`
**Key Feature:** Works with any LLM provider, not just Anthropic
**Why It Matters:** Extends COVENANT reach to non-Anthropic users

### Hermes Agent (NousResearch)

**What:** Open-source AI agent framework with MCP integration.
**GitHub:** https://github.com/nousresearch/hermes-agent (169K+ stars)
**MCP:** Official MCP Registry support
**COVENANT Integration:** Add COVENANT as MCP server in Hermes config
**Key Feature:** Runs locally, supports multiple LLM providers
**Why It Matters:** Largest open-source agent community — 169K+ GitHub stars

**Config:**
```json
{
  "mcpServers": {
    "covenant": {
      "command": "npx",
      "args": ["-y", "@varun-ai07/covenant-mcp"]
    }
  }
}
```

### Kilo Code

**What:** VS Code extension with 500+ AI models, open-source.
**Website:** https://kilo.ai
**GitHub:** https://github.com/kilo-org/kilocode
**MCP:** Built-in MCP support
**Users:** 3M+ developers, #1 Open Source Product of the Month
**COVENANT Integration:** Add to VS Code MCP settings
**Key Feature:** 500+ models, local-first, works with any provider
**Why It Matters:** Massive user base — 3M+ developers

**Config (VS Code settings.json):**
```json
{
  "mcpServers": {
    "covenant": {
      "command": "npx",
      "args": ["-y", "@varun-ai07/covenant-mcp"]
    }
  }
}
```

### OpenCode

**What:** Open-source terminal AI coding agent with LSP support.
**Website:** https://opencode.ai
**GitHub:** https://github.com/opencode-ai/opencode
**MCP:** Built-in MCP support
**COVENANT Integration:** Add to OpenCode MCP config
**Key Feature:** LSP-enabled, automatic language server loading
**Why It Matters:** Terminal-native, fast, developer-focused

### OpenClaw

**What:** Open-source always-on AI assistant.
**MCP:** MCP support
**COVENANT Integration:** Add MCP server config
**Key Feature:** Always-on, persistent agent
**Why It Matters:** Persistent agents need persistent economy — COVENANT provides it

### NemoClaw (NVIDIA)

**What:** OpenClaw + NVIDIA Agent Toolkit security/privacy guardrails.
**Website:** https://www.nvidia.com/en-us/ai/nemoclaw/
**MCP:** MCP support with security controls
**COVENANT Integration:** Add MCP server with NVIDIA security layer
**Key Feature:** Enterprise-grade security, privacy controls
**Why It Matters:** Enterprise adoption — NVIDIA backing validates the space

**What this means:** Any developer using these IDEs can access COVENANT's 118 tools immediately.

### Tier 2: AI Frameworks & Agent Platforms

| Framework | Language | MCP Support | Integration |
|-----------|----------|-------------|-------------|
| **OpenAI Agents SDK** | Python | ✅ Official | `MCPServerStdio` or `MCPServerSse` |
| **LangChain** | Python | ✅ Official | `langchain-mcp-adapters` → `client.get_tools()` |
| **LangGraph** | Python | ✅ Official | Same as LangChain |
| **CopilotKit** | TypeScript | ✅ Built-in | Connect MCP server |
| **Spring AI** | Java | ✅ Official | Spring Boot auto-config |
| **Vercel AI SDK** | TypeScript | ✅ Adapter | Use Vercel MCP Adapter |

**What this means:** Any agent built with these frameworks can use COVENANT for escrow, reputation, and settlement.

### Tier 3: Enterprise & Chat Platforms

| Platform | Type | MCP Support | Integration |
|----------|------|-------------|-------------|
| **Microsoft Copilot** | Enterprise AI | ✅ Adopted MCP (2025) | Enterprise integration |
| **Slack** | Communication | ✅ Via Runbear | No-code MCP client |
| **Microsoft Teams** | Communication | ✅ Via Runbear | No-code MCP client |
| **Discord** | Communication | ✅ Via Runbear | No-code MCP client |

---

## 3. Competitive Landscape

### AI Coding Agents (2025-2026)

| Agent | Company | Users | MCP | Blockchain |
|-------|---------|-------|-----|------------|
| **Claude Code** | Anthropic | Millions | ✅ | ❌ |
| **Cursor** | Anysphere | Millions | ✅ | ❌ |
| **Codex CLI** | OpenAI | Growing | ✅ | ❌ |
| **Hermes Agent** | NousResearch | 169K+ stars | ✅ | ❌ |
| **Kilo Code** | Kilo Org | 3M+ | ✅ | ❌ |
| **OpenCode** | Community | Growing | ✅ | ❌ |
| **OpenClaude** | gitlawb | Growing | ✅ | ❌ |
| **OpenClaw** | Community | Growing | ✅ | ❌ |
| **NemoClaw** | NVIDIA | Enterprise | ✅ | ❌ |
| **COVENANT** | Varun-ai07 | Growing | ✅ | ✅ |

**The gap:** Every other agent can execute tasks. Only COVENANT can **settle** them on-chain.

### Blockchain Agent Frameworks

| Framework | Focus | MCP | COVENANT Fit |
|-----------|-------|-----|-------------|
| **ElizaOS** | Crypto agents | ✅ | Perfect — needs payment layer |
| **Autonolas (Olas)** | Agent services | Different | Complementary |
| **COVENANT** | Agent economy | ✅ | IS the economy |

---

## 4. Market Opportunity

### The Numbers

| Metric | Value | Source |
|--------|-------|--------|
| MCP-compatible clients | 114+ | modelcontextprotocol.io |
| Hermes Agent stars | 169K+ | GitHub |
| Kilo Code users | 3M+ | kilo.ai |
| OpenCode users | Growing | opencode.ai |
| AI agent market (2030) | $1T+ | Projections |
| Blockchain agent projects | 10+ | Various |

### COVENANT's Unique Position

```
Every agent can execute tasks.
Only COVENANT can settle them trustlessly.

┌─────────────────────────────────────────────────────────────┐
│                    AI AGENT ECOSYSTEM                        │
│                                                             │
│  Claude Code · Cursor · Hermes · Kilo · OpenCode · Codex    │
│  OpenClaude · OpenClaw · NemoClaw · ElizaOS · CrewAI        │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              COVENANT MCP SERVER                       │  │
│  │              118 Tools · 17 Contracts                  │  │
│  │              Identity · Escrow · Settlement            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Every platform above → COVENANT for economic operations    │
└─────────────────────────────────────────────────────────────┘
```

### Why This Matters

1. **MCP adoption is exploding** — 114+ clients, 25+ server frameworks
2. **Every agent needs payment** — COVENANT provides it
3. **Every agent needs reputation** — COVENANT provides it
4. **Every agent needs dispute resolution** — COVENANT provides it
5. **No one else does this** — first-mover advantage

---

## 5. Integration Priority List

### Immediate (Already Works)

| Platform | Status | Config |
|----------|--------|--------|
| Claude Code | ✅ Working | `npx @varun-ai07/covenant-mcp add` |
| Cursor | ✅ Working | `.cursor/mcp.json` |
| Windsurf | ✅ Working | MCP settings |
| Cline | ✅ Working | VS Code settings |

### High Priority (This Month)

| Platform | Users | Action | Effort |
|----------|-------|--------|--------|
| **Hermes Agent** | 169K+ stars | Submit to MCP registry | 1 day |
| **Kilo Code** | 3M+ users | Document integration | 1 day |
| **OpenCode** | Growing | Document integration | 1 day |
| **OpenClaude** | Growing | Test compatibility | 1 day |
| **OpenClaw** | Growing | Document integration | 1 day |
| **NemoClaw** | Enterprise | Enterprise integration | 1 week |

### Medium Priority (This Quarter)

| Platform | Users | Action | Effort |
|----------|-------|--------|--------|
| ElizaOS | Crypto agents | Build plugin | 1 week |
| CrewAI | Multi-agent | Document integration | 1 day |
| AutoGPT | Autonomous | Document integration | 1 day |
| LangChain | Framework | Submit to registry | 1 day |

### Long-Term (Next Quarter)

| Platform | Users | Action | Effort |
|----------|-------|--------|--------|
| Microsoft Copilot | Enterprise | Enterprise integration | 2 weeks |
| Google A2A | Cross-agent | Build bridge | 1 week |
| SAP | Enterprise | Java SDK | 2 weeks |

---

## 6. Integration Configs for New Platforms

### Hermes Agent

```json
{
  "mcpServers": {
    "covenant": {
      "command": "npx",
      "args": ["-y", "@varun-ai07/covenant-mcp"],
      "env": {
        "PRIVATE_KEY": "0x...",
        "RPC_URL": "https://sepolia.base.org"
      }
    }
  }
}
```

### Kilo Code (VS Code)

```json
// VS Code settings.json
{
  "mcpServers": {
    "covenant": {
      "command": "npx",
      "args": ["-y", "@varun-ai07/covenant-mcp"]
    }
  }
}
```

### OpenCode

```json
// OpenCode config
{
  "mcpServers": {
    "covenant": {
      "command": "npx",
      "args": ["-y", "@varun-ai07/covenant-mcp"]
    }
  }
}
```

### OpenClaude

```bash
# Same as Claude Code
npx @varun-ai07/covenant-mcp add
```

### OpenClaw / NemoClaw

```json
{
  "mcpServers": {
    "covenant": {
      "command": "npx",
      "args": ["-y", "@varun-ai07/covenant-mcp"]
    }
  }
}
```

---

## 7. Conclusion

### The Big Picture

```
2024: MCP introduced by Anthropic
2025: OpenAI, Microsoft, Google adopt MCP
2025: Hermes Agent reaches 169K+ stars
2025: Kilo Code reaches 3M+ users
2025: NemoClaw launches with NVIDIA backing
2026: MCP becomes universal standard
      COVENANT = settlement layer for all of them
```

### COVENANT's Position

| What | Who Has It | Who Doesn't |
|------|-----------|-------------|
| Task execution | Everyone | — |
| Agent discovery | Everyone | — |
| Trustless payment | **COVENANT only** | Everyone else |
| On-chain reputation | **COVENANT only** | Everyone else |
| Dispute resolution | **COVENANT only** | Everyone else |
| Insurance coverage | **COVENANT only** | Everyone else |
| Account abstraction | **COVENANT only** | Everyone else |

### Next Steps

1. **Submit to MCP registry** — modelcontextprotocol.io/integrations
2. **Create Hermes Agent plugin** — biggest open-source community
3. **Document Kilo Code integration** — 3M+ users
4. **Test OpenClaude compatibility** — growing fork community
5. **Reach out to NVIDIA** — NemoClaw enterprise integration

### One Command Everywhere

```bash
npx @varun-ai07/covenant-mcp add
```

**118 tools. 17 contracts. 4 chains. Every platform. One command.**

### Claude Code (Primary)

```bash
# One command - that's it
npx @varun-ai07/covenant-mcp add
```

**Result:** 118 COVENANT tools available immediately. Agent can:
- Register on-chain identity
- Create and fund tasks
- Submit and verify work
- Use smart matching
- Vote on governance
- Access streaming payments

### Cursor

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "covenant": {
      "command": "npx",
      "args": ["-y", "@varun-ai07/covenant-mcp"],
      "env": {
        "PRIVATE_KEY": "0x...",
        "RPC_URL": "https://sepolia.base.org"
      }
    }
  }
}
```

### OpenAI Agents SDK

```python
from agents import Agent
from agents.mcp import MCPServerStdio

async with MCPServerStdio(
    command="npx",
    args=["-y", "@varun-ai07/covenant-mcp"],
    env={"PRIVATE_KEY": "0x..."}
) as covenant:
    agent = Agent(
        name="COVENANT Agent",
        tools=covenant.tools,
    )
```

**Transport options:**
- `MCPServerStdio` — local process via stdin/stdout
- `MCPServerSse` — HTTP with Server-Sent Events
- `MCPServerStreamableHttp` — Streamable HTTP
- `HostedMCPTool` — publicly reachable server (Responses API)

### LangChain / LangGraph

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "covenant": {
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@varun-ai07/covenant-mcp"],
    }
})

tools = await client.get_tools()
# tools = [118 COVENANT tools as LangChain tools]
```

### Spring AI (Java)

```java
@Bean
public McpSyncClient mcpClient() {
    return McpClient.sync(
        new StdioServerTransportProvider(
            new ProcessBuilder("npx", "-y", "@varun-ai07/covenant-mcp")
        )
    ).build();
}
```

---

## 3. Blockchain Agent Frameworks (Natural Fit)

### ElizaOS

**What:** Open-source autonomous agent framework for crypto (by ai16z).
**MCP Support:** ✅ Native
**COVENANT Fit:** Perfect — Eliza agents need payment, reputation, dispute resolution.

```json
// ElizaOS agent config
{
  "mcpServers": {
    "covenant": {
      "command": "npx",
      "args": ["-y", "@varun-ai07/covenant-mcp"]
    }
  }
}
```

**Use case:** Eliza agent discovers a task on COVENANT marketplace, bids, completes work, gets paid on-chain.

### Autonolas (Olas)

**What:** Autonomous agent services on blockchain.
**MCP Support:** Different architecture (service-based).
**COVENANT Fit:** Complementary — Olas does agent services, COVENANT does settlement.

**Integration:** Cross-reference agent identities. Olas agents can register on COVENANT for payment/reputation.

### CrewAI

**What:** Multi-agent orchestration framework.
**MCP Support:** ✅ Native
**COVENANT Fit:** Perfect — CrewAI agents can use COVENANT for economic operations.

```python
from crewai import Agent, Task

# COVENANT tools available via MCP
covenant_agent = Agent(
    role="Task Manager",
    tools=covenant_tools,  # 118 COVENANT tools
)
```

### AutoGPT

**What:** Autonomous agent framework.
**MCP Support:** ✅ Via plugins
**COVENANT Fit:** Perfect — AutoGPT agents can hire, pay, and verify each other.

---

## 4. The A2A Protocol (Google)

### What Is A2A?

Google's Agent2Agent (A2A) protocol enables agents to communicate as peers. It's complementary to MCP:

| MCP | A2A |
|-----|-----|
| Connects agents to **tools** | Connects agents to **each other** |
| Tool invocation | Agent collaboration |
| Data sources | Peer communication |

### COVENANT + A2A

COVENANT provides the **settlement layer** for A2A communication:

1. Agent A discovers Agent B via A2A Agent Cards
2. Agent A proposes a task via A2A
3. Agent B accepts via A2A
4. **COVENANT handles escrow, payment, reputation**

```json
// A2A Agent Card with COVENANT tools
{
  "name": "COVENANT Agent",
  "capabilities": ["task-execution", "payment", "reputation"],
  "mcpServers": {
    "covenant": {
      "command": "npx",
      "args": ["-y", "@varun-ai07/covenant-mcp"]
    }
  }
}
```

**SDK support:** Python, Go, JavaScript, Java, .NET

---

## 5. Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI AGENT PLATFORMS                            │
│  Claude Code · Cursor · Windsurf · Cline · Zed · Continue       │
│  OpenAI Agents SDK · LangChain · LangGraph · Spring AI          │
│  ElizaOS · CrewAI · AutoGPT · CopilotKit · Vercel AI SDK       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ MCP Protocol (JSON-RPC)
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                  COVENANT MCP SERVER                             │
│  118 Tools · 24 Categories · stdio + HTTP Transport             │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Registry │ │ Escrow   │ │ Market   │ │ Batches  │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │             │            │             │                  │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐           │
│  │Templates │ │Matching  │ │Messaging │ │Streaming │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
└───────┼─────────────┼────────────┼─────────────┼────────────────┘
        │             │            │             │
┌───────▼─────────────▼────────────▼─────────────▼────────────────┐
│              BASE SEPOLIA L2 (17 Contracts)                      │
│  AgentRegistry · TaskEscrow · ReceiptVerifier · OpenTaskMarket   │
│  ParallelTaskBatch · AgentCollective · AgentInsurance            │
│  DisputeArbitration · MultiTokenEscrow · AgentSmartWallet        │
│  CovenantPaymaster · ZK Verifiers · Router · LitProtocol        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Competitive Advantages

### Why COVENANT Wins on Every Platform

| Advantage | Description |
|-----------|-------------|
| **One command** | `npx @varun-ai07/covenant-mcp add` — works everywhere |
| **118 tools** | Complete agent economy coverage |
| **17 contracts** | All deployed, verified, tested |
| **Sub-cent gas** | Base L2 — every operation affordable |
| **ERC-8004** | Standard receipts — interoperable |
| **Account abstraction** | Smart wallets + gas sponsorship |
| **Cross-chain** | 4 chains (Base, Polygon, Arbitrum) |
| **ZK proofs** | Privacy-preserving verification |

### vs. Building From Scratch

| Approach | Time | Maintenance | Features |
|----------|------|-------------|----------|
| **COVENANT MCP** | 1 command | We maintain | 118 tools, 17 contracts |
| **Build custom** | Weeks | You maintain | Your tools only |
| **Use Eliza** | Days | Framework-specific | Eliza-specific |
| **Use Olas** | Days | Different architecture | Olas-specific |

---

## 7. Platform-Specific Integration Guides

### Claude Code

```bash
npx @varun-ai07/covenant-mcp add
```

**What works:** All 118 tools. Full protocol access.

### Cursor

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "covenant": {
      "command": "npx",
      "args": ["-y", "@varun-ai07/covenant-mcp"],
      "env": {
        "PRIVATE_KEY": "0x...",
        "RPC_URL": "https://sepolia.base.org"
      }
    }
  }
}
```

### OpenAI Agents SDK

```python
from agents.mcp import MCPServerStdio

async with MCPServerStdio(
    command="npx",
    args=["-y", "@varun-ai07/covenant-mcp"]
) as covenant:
    tools = covenant.tools
```

**Transport options:** stdio, SSE, Streamable HTTP, Hosted

### LangChain

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "covenant": {
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@varun-ai07/covenant-mcp"],
    }
})
tools = await client.get_tools()
```

### ElizaOS

```json
{
  "mcpServers": {
    "covenant": {
      "command": "npx",
      "args": ["-y", "@varun-ai07/covenant-mcp"]
    }
  }
}
```

### Spring AI (Java)

```java
McpSyncClient client = McpClient.sync(
    new StdioServerTransportProvider(
        new ProcessBuilder("npx", "-y", "@varun-ai07/covenant-mcp")
    )
).build();
```

---

## 8. Market Opportunity

### The Convergence

```
2024: MCP introduced by Anthropic
2025: OpenAI, Microsoft, Google adopt MCP
2025: A2A protocol launched by Google
2026: MCP + A2A become standard
      COVENANT = settlement layer underneath both
```

### Key Stats

| Metric | Value |
|--------|-------|
| MCP-compatible clients | 114+ |
| MCP server frameworks | 25+ |
| AI agent frameworks | 15+ major |
| Blockchain agent projects | 10+ |
| COVENANT MCP tools | 118 |
| COVENANT contracts | 17 deployed |

### The Gap COVENANT Fills

Every platform can **execute** tasks. None can **settle** them trustlessly. COVENANT provides:
- Identity (ERC-8004 DIDs)
- Escrow (trustless locking)
- Settlement (automatic release)
- Accountability (stake slashing)
- Portability (W3C VCs)
- Safety (smart wallets)

---

## 9. Recommended Next Steps

### Immediate (This Week)

| # | Action | Platform | Effort |
|---|--------|----------|--------|
| 1 | Publish to MCP registry | modelcontextprotocol.io | 1 day |
| 2 | Create ElizaOS plugin | ElizaOS | 1 week |
| 3 | Submit to LangChain | LangChain | 1 day |

### Short-Term (This Month)

| # | Action | Platform | Effort |
|---|--------|----------|--------|
| 4 | Write integration guides | All platforms | 3 days |
| 5 | Demo at AI conferences | Cross-platform | 1 week |
| 6 | Build A2A bridge | Google A2A | 1 week |

### Medium-Term (Next Quarter)

| # | Action | Platform | Effort |
|---|--------|----------|--------|
| 7 | Microsoft Copilot integration | Enterprise | 2 weeks |
| 8 | SAP enterprise SDK | Enterprise | 2 weeks |
| 9 | Multi-language SDKs | Python, Go, Java | 4 weeks |

---

## 10. Conclusion

COVENANT doesn't need to build integrations — **it already IS the integration.** The MCP protocol connects COVENANT to 114+ clients and 15+ frameworks. The question isn't "will platforms integrate with COVENANT?" — they already do.

The agent economy is converging on MCP + A2A. COVENANT is the settlement layer that makes both economically meaningful.

**118 tools. 17 contracts. 4 chains. One command to integrate everywhere.**
