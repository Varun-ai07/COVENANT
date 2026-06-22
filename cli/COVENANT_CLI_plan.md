# COVENANT CLI — Build Plan
## A protocol operations console, not a coding agent

> Verdict: Building "Claude Code for COVENANT" is a bad idea — you would be
> re-implementing a multi-year engineering category against better-funded
> competitors, while undermining your own MCP distribution strategy.
> Building a focused COVENANT CLI — closer to `stripe`, `gh`, or `vercel`
> CLI than to Claude Code — is a strong idea. This plan is for that second
> thing only.

---

## 1. What This Is and Is Not

**It is:**
- A standalone terminal application that talks directly to the COVENANT
  smart contracts on Base Sepolia/Mainnet
- A live "mission control" view of the protocol — agents, tasks, escrow,
  disputes, reputation — rendered beautifully in a terminal
- A natural-language front end for COVENANT actions only ("register me as
  a worker with data-analysis capability" → one scoped SDK call)
- A scripting tool — every interactive action also has a one-shot,
  pipeable, CI-friendly command form
- Your best hackathon demo asset and onboarding tool — works without
  Claude Code, Cursor, or any AI platform installed

**It is not:**
- A general-purpose coding agent
- A file editor, bash sandbox, or multi-file context manager
- A competitor to Claude Code, OpenCode, Cline, or any agentic IDE tool
- A place where arbitrary LLM reasoning touches your filesystem or runs
  unconstrained shell commands

The natural-language layer is intentionally narrow: it can only ever
resolve to one of a small, fixed set of COVENANT SDK calls (the same 28
actions your MCP server exposes). It never writes code, never edits files,
never executes arbitrary commands. That constraint is what makes it safe
to ship fast and what keeps it from becoming "rebuild Claude Code badly."

---

## 2. Naming

`cvn` — three characters, matches your MCP tool prefix convention
(`cvn_register`, `cvn_hire`, etc.), fast to type, no collision with
existing CLI tools on PATH.

```bash
npm install -g @varun-ai07/cvn-cli
cvn          # launches interactive mode
cvn --help   # one-shot command reference
```

Alternative names if `cvn` collides with something in your ecosystem:
`covenant`, `cov`. Stick with `cvn` unless there's a conflict — it's the
strongest option because it's already your brand shorthand.

---

## 3. The Two Modes

### Mode A — Interactive REPL (the primary experience)

Running `cvn` with no arguments drops into a persistent shell. This is
where the "agentic feel" lives — a conversational prompt, live event
streaming in the background, and rich rendered output.

### Mode B — One-shot commands (the scriptable experience)

Every action available in the REPL is also a flag-based command that
exits immediately with a clean output (text or `--json`), so the CLI is
usable in CI pipelines, cron jobs, and other scripts.

```bash
cvn register --name ResearchBot --cap data-analysis,research --stake 0.001
cvn task create --worker 0x5501... --pay 0.001 --deadline 24h --spec ./task.json
cvn task watch 42
cvn stats --json
```

Both modes share the same underlying command engine — the REPL is just a
persistent wrapper around the one-shot commands plus a natural-language
resolver in front of them.

---

## 4. Visual Design System

### 4.1 Color Palette — mapped to protocol semantics, not decoration

Every color in this CLI means something specific about protocol state.
Nothing is colored "because it looks nice" — color is information.

| Color | ANSI / Hex | Meaning | Used for |
|---|---|---|---|
| Teal | `#00D4AA` / `38;2;0;212;170` | Live / active / success | Confirmed transactions, active tasks, success states |
| Cyan | `#22D3EE` | Information / read-only | Query results, balance checks, help text |
| Amber | `#F59E0B` | Pending / waiting | Unconfirmed transactions, awaiting verification, deadlines under 6h |
| Violet | `#A78BFA` | AI reasoning in progress | Natural-language resolution, LLM-backed verification |
| Coral | `#F87171` | Failure / danger | Failed tasks, slashed stake, errors |
| Grey | `#6B7280` | Inactive / metadata | Timestamps, addresses, secondary text |
| White | `#F3F4F6` | Primary content | Headlines, key numbers, your own data |
| Dim white | `#9CA3AF` | Body text | Descriptions, explanations |

**The one hard rule:** teal always means "this just succeeded on-chain."
Nothing else is ever teal. If a user sees teal flash anywhere in the
terminal, they instantly know a transaction confirmed — without reading
a word.

### 4.2 Status Icon Legend

A fixed, memorized vocabulary of symbols. Same icon, same meaning,
everywhere in the tool — REPL, one-shot output, logs, everything.

```
✓   teal    confirmed / success / verified pass
✗   coral   failed / rejected / verification fail
◐   amber   pending — transaction broadcast, awaiting confirmation
●   teal    active — task or agent currently live
○   grey    inactive — deregistered, expired, idle
◆   violet  AI reasoning — natural language being resolved
⚠   amber   warning — deadline approaching, low balance, retry
↻   cyan    syncing — refreshing on-chain state
⛓   grey    on-chain reference — address, hash, block number follows
```

These are deliberately simple geometric Unicode characters (`✓ ✗ ◐ ● ○ ◆
⚠ ↻`) — not emoji. Emoji render inconsistently across terminals, fonts,
and OSes; these geometric glyphs render identically everywhere, including
over SSH and in CI logs.

### 4.3 The "Thinking" and "Building" Indicators

This is the single most important interaction in the whole tool — it is
what gives the CLI its "alive" feeling, and it must clearly distinguish
**three different kinds of waiting**, because they mean different things
and a user should never confuse them.

**1. AI reasoning (natural language → action resolution)**

A violet braille spinner with a labeled caption, since this is "thinking"
not "loading":

```
◆ Resolving intent... ⠋
◆ Resolving intent... ⠙
◆ Resolving intent... ⠹
```

Braille spinner frames: `⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏` (the same sequence used by
npm, yarn, and most modern Node CLIs — instantly familiar, very smooth at
80ms/frame).

When resolved, it collapses to a single confirmation line showing exactly
what it understood, before doing anything:

```
◆ Resolving intent... done
  → cvn register --name ResearchBot --cap data-analysis,research --stake 0.001
  Proceed? (Y/n)
```

This confirmation step is non-negotiable. The CLI never silently
translates natural language into a transaction — it always shows the
exact resolved command and asks for explicit confirmation before anything
touches the chain. This is the same safety principle your MCP server
already uses, applied to the CLI.

**2. Transaction broadcasting (waiting on the chain)**

An amber pulsing dot, paired with the actual transaction hash the moment
it's available — not generic "loading," always tied to a real on-chain
reference:

```
◐ Broadcasting transaction...
◐ Broadcasting transaction... ⛓ 0x24b52b...1a9
◐ Waiting for confirmation (1/1 blocks)...
```

**3. Background protocol activity (the live ticker)**

A persistent single line at the bottom of the REPL, always present, that
never blocks input. This is what makes the tool feel "alive" the way a
trading terminal feels alive — something is always happening:

```
↻ 3 active tasks · 1 pending verification · next deadline in 4h 12m
```

The distinction matters enormously: violet = the AI is thinking about
your words. Amber = the blockchain is doing its thing. Cyan = background
ambient status. A user should be able to tell which one is happening from
across the room, by color alone.

### 4.4 Spacing and Layout Rules

Terminal UIs fail most often from cramped, inconsistent spacing. Fixed
rules, applied everywhere:

- **2-space left gutter** for all secondary/detail lines under a primary
  line (consistent indentation depth, never variable)
- **1 blank line** between every logical block (a completed action and
  the next prompt; a section header and its content)
- **Never more than 1 blank line** anywhere — extra vertical space reads
  as a bug, not breathing room, in a terminal
- **Right-aligned numeric columns** in every table (ETH amounts, scores,
  block numbers) — left-aligned text columns. Numbers must line up
  vertically for fast scanning
- **Box-drawing characters** (`┌ ─ ┐ │ └ ┘ ├ ┤`) only for deliberately
  bounded panels (the wallet summary, the help screen) — never for casual
  output, or the tool starts to feel cluttered
- **Maximum content width of 80 columns** for prose/explanatory text even
  if the terminal is wider — long unwrapped lines are the #1 readability
  killer in CLI tools. Tables and live tickers can use full width.

### 4.5 Example Rendered Screens

**Startup / welcome:**

```
  COVENANT  v1.0.0
  Agent economy protocol — Base Sepolia

  ⛓ Connected   0x715f...e92C   ●  Reputation 510

  Type a command, or just tell me what you need.
  Try: "register me as a worker with data-analysis capability"

  ↻ 3 active tasks · 1 pending verification

cvn ❭
```

**Natural language resolution, confirmed, executing:**

```
cvn ❭ create a task for the top data-analysis worker, pay 0.001 eth, 24h deadline

◆ Resolving intent... done
  → Find top worker for "data-analysis"
  → Create task: payment 0.001 ETH, deadline +24h
  Proceed? (Y/n) y

◐ Finding workers...
  ✓ Found: analyst.covenant.eth (rep 742, ● active)

◐ Broadcasting transaction... ⛓ 0x24b52b...1a9
◐ Waiting for confirmation (1/1 blocks)...
✓ Task #42 created — 0.001 ETH locked in escrow

  Worker     analyst.covenant.eth  (rep 742)
  Payment    0.001 ETH
  Deadline   2026-03-20 02:54 UTC  (23h 58m remaining)
  Status     ● Funded

  Watching task #42 for updates — Ctrl+C to stop watching

  ⛓ 0x24b52b...1a9
```

**Live watch mode (auto-updating in place):**

```
  TASK #42                                          ● Funded → ◐ Submitted

  Client    0x715f...e92C  (you)
  Worker    analyst.covenant.eth
  Payment   0.001 ETH
  Deadline  23h 41m remaining

  ✓ 02:54:01  Task created, escrow funded
  ✓ 02:56:14  Worker acknowledged
  ◐ 03:01:47  Work submitted — awaiting verification...

  ↻ refreshing every 5s · press q to stop watching
```

**Verification completing (the payoff moment):**

```
  ✓ 03:02:55  Verified — score 92/100 — PASS
  ✓ 03:02:56  Payment released → analyst.covenant.eth
  ✓ 03:02:56  Reputation: 742 → 752 (+10)

  Task #42 complete.  ⛓ 0x250a74...cd8
```

**Error state — always actionable, never opaque:**

```
cvn ❭ create task for 0x5501... pay 0.001 eth

◐ Broadcasting transaction...
✗ Transaction failed

  Reason   Insufficient ETH for payment + gas
  Have     0.0008 ETH
  Need     0.0013 ETH (0.001 payment + ~0.0003 gas)
  Fix      Get free testnet ETH: https://app.optimism.io/faucet

cvn ❭
```

---

## 5. Command Reference (Mode B — one-shot)

```
cvn register   --name <str> --cap <list> [--stake <eth>]
cvn agent      get <address> | find <capability> | leaderboard [--limit n]
cvn task       create --worker <addr> --pay <eth> --deadline <dur> --spec <file>
               get <id> | submit <id> --file <path> | verify <id> | dispute <id>
               watch <id>
cvn market     post --max <eth> --spec <file> | bid <id> --price <eth>
               select <id> --worker <addr> | list
cvn batch      create --workers <file> | status <id> | aggregate <id>
cvn stats      [--json]
cvn balance    [<address>]
cvn config     set <key> <value> | show
cvn --help
cvn --version
```

Every command supports `--json` for machine-readable output and
`--quiet` for minimal human output — this is what makes Mode B genuinely
scriptable rather than just "the same UI with fewer prompts."

---

## 6. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js + TypeScript | Shares code directly with your existing SDK and MCP server — zero duplication |
| TUI framework | [Ink](https://github.com/vadimdemedes/ink) (React for CLIs) | Component model matches your existing React/Next.js skills; used by Gatsby, Prisma CLI, Cloudflare Wrangler |
| Prompts | [@clack/prompts](https://github.com/natemoo-re/clack) | The cleanest, most modern interactive prompt library available — connector-line aesthetic, used by many 2025-era CLIs |
| Spinners | [cli-spinners](https://github.com/sindresorhus/cli-spinners) | Provides the exact braille frame set described above |
| Tables | [cli-table3](https://github.com/cli-table/cli-table3) | Clean box-drawing tables with full color support |
| Color | [chalk](https://github.com/chalk/chalk) | Standard, zero-friction ANSI color |
| Natural language resolution | Anthropic API, constrained tool-use mode | Same pattern as your MCP server — the model can only ever call one of your fixed 28 actions, never freeform text generation into the terminal |
| Blockchain | viem (already in your stack) | Reuse existing SDK code directly |
| Live updates | WebSocket subscription to your existing contract events | Same event source your MCP and frontend already use |
| Packaging | npm global package + standalone binary via `pkg` or `bun build --compile` | npm for easy install, standalone binary for users without Node |

The critical design decision: **the CLI is a thin presentation layer over
your existing `covenant-sdk`.** It does not duplicate any contract logic,
encryption logic, or IPFS logic. Every action it performs is a call into
the same SDK your MCP server and frontend already use. This is what keeps
the build small and the three surfaces (frontend / MCP / CLI) permanently
in sync.

---

## 7. Build Phases

### Phase 1 — Core shell (3-4 days)
- Ink app skeleton, REPL loop, prompt rendering
- Wallet connection (load from `.env` or prompt for private key, same
  pattern as your MCP server)
- One-shot command parser (commander.js or yargs) wrapping the SDK
- `cvn register`, `cvn agent get/find`, `cvn task create/get`, `cvn stats`
- Color system and icon legend implemented as a shared theme module

### Phase 2 — Live views (2-3 days)
- `cvn task watch <id>` — polling/WebSocket-driven auto-refreshing panel
- Background ticker line in the REPL (active tasks, pending verifications)
- Transaction broadcast → confirmation flow with the amber pulse + hash
- Error formatting layer (every SDK error mapped to the actionable format
  shown in section 4.5 — reuse your existing `parseContractError` logic
  from the MCP server directly)

### Phase 3 — Natural language layer (3-4 days)
- Anthropic API integration with strict tool-use schema (the 28 fixed
  actions, nothing else)
- The "Resolving intent..." violet spinner + confirmation-before-execute
  flow
- Graceful fallback: if the model can't resolve intent into one of the 28
  actions, it says so plainly and suggests the closest one-shot command —
  never guesses, never executes something unconfirmed

### Phase 4 — Polish and distribution (2-3 days)
- `cvn --help` rendered as a clean reference screen, not a wall of text
- Onboarding flow for first-run (wallet setup, faucet link, network check)
- npm publish as `@varun-ai07/cvn-cli`
- Standalone binary builds for users without Node installed
- Demo recording — this becomes your best hackathon asset

**Total: roughly 2 weeks of focused work**, versus the multi-year,
multi-million-dollar investment a real coding-agent clone would require.
That gap in scope is exactly why this version is worth building and the
other one is not.

---

## 8. Why This Complements Rather Than Competes With Your MCP Strategy

The MCP server and this CLI are not alternatives — they are two doors
into the same room. The MCP server is for people who already live inside
Claude Code, Cursor, Cline, or another agentic IDE and want COVENANT
available as tools inside that environment. The CLI is for everyone
else: developers who don't use an AI coding agent at all, people
operating from a remote server over SSH, CI pipelines that need to
script protocol actions, and — critically — every hackathon judge or
investor you ever demo to, who will never need to install or configure
an AI coding platform first.

A judge who watches you type `cvn ❭ register me as a worker with
data-analysis capability` and sees a clean, fast, beautifully rendered
confirmation flow understands your protocol in ten seconds, with nothing
installed beyond your own tool. That single demo moment is worth more
than the entire engineering cost of building it.

---

## 9. The One Constraint to Never Break

If you build this and the natural-language layer ever grows beyond the
fixed 28 actions — if someone asks "can it also write the worker's
analysis script for me" and the answer becomes yes — stop immediately.
That is the line between "COVENANT operations console" and "competing
coding agent," and crossing it is exactly the mistake the verdict in
section 1 warns against. Keep the surface area locked to protocol
actions only, forever.

================================================================
END OF COVENANT CLI BUILD PLAN
================================================================
