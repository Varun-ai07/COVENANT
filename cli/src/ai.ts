import * as readline from "node:readline";
import chalk from "chalk";
import ora from "ora";
import { formatEther, isAddress, parseEther, type Address } from "viem";
import {
  CONTRACTS,
  getAccount,
  getPublicClient,
  getWalletClient,
  loadAbi,
  CHAIN_NAME,
} from "./config.js";
import { shortAddr, toEth, TASK_STATUS, printTicker, isJsonMode, isQuietMode, preWriteGuard, printError } from "./utils.js";

const MAX_TOOL_ITERATIONS = 5;

// ── OpenAI function-calling tool schemas ────────────────────────

const TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "get_agent",
      description: "Get an agent's profile by Ethereum address",
      parameters: {
        type: "object" as const,
        properties: {
          address: { type: "string", description: "Ethereum address of the agent" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_agent_count",
      description: "Get the total number of registered agents",
      parameters: { type: "object" as const, properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_task",
      description: "Get a task's details by numeric ID",
      parameters: {
        type: "object" as const,
        properties: {
          task_id: { type: "number", description: "Numeric task ID" },
        },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_task_count",
      description: "Get the total number of tasks",
      parameters: { type: "object" as const, properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_task",
      description: "Create a new task with a worker, payment amount, and deadline",
      parameters: {
        type: "object" as const,
        properties: {
          worker: { type: "string", description: "Worker's Ethereum address" },
          amount_eth: { type: "string", description: "Payment amount in ETH" },
          deadline: { type: "string", description: "Unix timestamp deadline (seconds)" },
          meta_hash: { type: "string", description: "Metadata hash (bytes32 hex), defaults to 0x" },
        },
        required: ["worker", "amount_eth", "deadline"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "register_agent",
      description: "Register a new agent on-chain",
      parameters: {
        type: "object" as const,
        properties: {
          stake_eth: { type: "string", description: "Stake amount in ETH" },
          metadata: { type: "string", description: "Metadata root hash (bytes32 hex)" },
        },
        required: ["stake_eth", "metadata"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "submit_work",
      description: "Submit a deliverable hash for a task",
      parameters: {
        type: "object" as const,
        properties: {
          task_id: { type: "number", description: "Numeric task ID" },
          deliverable_hash: { type: "string", description: "Deliverable hash (bytes32 hex)" },
        },
        required: ["task_id", "deliverable_hash"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "verify_task",
      description: "Complete/verify a task (client confirms, releases payment)",
      parameters: {
        type: "object" as const,
        properties: {
          task_id: { type: "number", description: "Numeric task ID" },
        },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_stats",
      description: "Get aggregate protocol statistics (agent count, task count, fees)",
      parameters: { type: "object" as const, properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_balance",
      description: "Get the wallet's ETH balance",
      parameters: { type: "object" as const, properties: {} },
    },
  },
];

// ── Tool execution ─────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const account = getAccount();
  const client = getPublicClient();

  switch (name) {
    case "get_agent": {
      const addr = args.address as string;
      if (!isAddress(addr)) return `Error: Invalid address ${addr}`;
      const identityAbi = loadAbi("CovenantIdentity");
      const data = (await client.readContract({
        address: CONTRACTS.CovenantIdentity,
        abi: identityAbi,
        functionName: "getAgent",
        args: [addr as Address],
      })) as any;
      if (Array.isArray(data)) {
        return JSON.stringify({
          stake: toEth(data[0]),
          reputation: Number(data[1]),
          registered: data[2] ? new Date(Number(data[2]) * 1000).toISOString() : "N/A",
          metadata: data[3],
          active: data[4],
          tasksCompleted: Number(data[5]),
          tasksFailed: Number(data[6]),
        });
      }
      return JSON.stringify({
        stake: toEth(data.stakedAmount ?? data.stake),
        reputation: data.reputation ?? 0,
        active: data.isActive ?? data.active,
        tasksCompleted: data.tasksCompleted ?? 0,
        tasksFailed: data.tasksFailed ?? 0,
      });
    }

    case "get_agent_count": {
      const identityAbi = loadAbi("CovenantIdentity");
      const count = (await client.readContract({
        address: CONTRACTS.CovenantIdentity,
        abi: identityAbi,
        functionName: "totalAgents",
        args: [],
      })) as bigint;
      return JSON.stringify({ totalAgents: Number(count) });
    }

    case "get_task": {
      const taskId = Number(args.task_id);
      const escrowAbi = loadAbi("CovenantEscrow");
      const data = (await client.readContract({
        address: CONTRACTS.CovenantEscrow,
        abi: escrowAbi,
        functionName: "getTask",
        args: [BigInt(taskId)],
      })) as any;
      const statusNum = Number(data.status ?? data[5]);
      if (Array.isArray(data)) {
        return JSON.stringify({
          client: data[0],
          worker: data[1],
          amount: toEth(data[2]),
          deadline: data[3] ? new Date(Number(data[3]) * 1000).toISOString() : "N/A",
          metaHash: data[4],
          status: TASK_STATUS[statusNum] ?? `Unknown(${statusNum})`,
          deliverable: data[6],
        });
      }
      return JSON.stringify({
        client: data.client,
        worker: data.worker,
        amount: toEth(data.amount ?? data.payment),
        deadline: data.deadline ? new Date(Number(data.deadline) * 1000).toISOString() : "N/A",
        metaHash: data.metaHash ?? data.descriptionHash,
        status: TASK_STATUS[statusNum] ?? `Unknown(${statusNum})`,
        deliverable: data.deliverableHash,
      });
    }

    case "get_task_count": {
      const escrowAbi = loadAbi("CovenantEscrow");
      const count = (await client.readContract({
        address: CONTRACTS.CovenantEscrow,
        abi: escrowAbi,
        functionName: "taskCount",
        args: [],
      })) as bigint;
      return JSON.stringify({ totalTasks: Number(count) });
    }

    case "create_task": {
      if (!account) return "Error: No PRIVATE_KEY configured. Cannot send transactions.";
      const wallet = getWalletClient();
      if (!wallet) return "Error: No wallet client available.";
      const worker = args.worker as string;
      if (!isAddress(worker)) return `Error: Invalid worker address: ${worker}`;
      const amountWei = parseEther(args.amount_eth as string);
      const deadline = BigInt(args.deadline as string);
      const meta = (args.meta_hash as string) || "0x";
      await preWriteGuard('AI: create task', formatEther(amountWei));
      const escrowAbi = loadAbi("CovenantEscrow");
      const { request } = await client.simulateContract({
        address: CONTRACTS.CovenantEscrow,
        abi: escrowAbi,
        functionName: "createTask",
        args: [worker as Address, amountWei, deadline, meta as `0x${string}`],
        account,
        value: amountWei,
      });
      const hash = await wallet.writeContract(request);
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 60_000 });
      return JSON.stringify({
        success: true,
        txHash: hash,
        block: Number(receipt.blockNumber),
        worker,
        amount: args.amount_eth + " ETH",
      });
    }

    case "register_agent": {
      if (!account) return "Error: No PRIVATE_KEY configured. Cannot send transactions.";
      const wallet = getWalletClient();
      if (!wallet) return "Error: No wallet client available.";
      const stakeWei = parseEther(args.stake_eth as string);
      const metadata = args.metadata as `0x${string}`;
      await preWriteGuard('AI: register agent', formatEther(stakeWei));
      const identityAbi = loadAbi("CovenantIdentity");
      const { request } = await client.simulateContract({
        address: CONTRACTS.CovenantIdentity,
        abi: identityAbi,
        functionName: "register",
        args: [stakeWei, metadata],
        account,
        value: stakeWei,
      });
      const hash = await wallet.writeContract(request);
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 60_000 });
      return JSON.stringify({
        success: true,
        txHash: hash,
        block: Number(receipt.blockNumber),
        stake: args.stake_eth + " ETH",
      });
    }

    case "submit_work": {
      if (!account) return "Error: No PRIVATE_KEY configured. Cannot send transactions.";
      const wallet = getWalletClient();
      if (!wallet) return "Error: No wallet client available.";
      const taskId = Number(args.task_id);
      const deliverable = args.deliverable_hash as `0x${string}`;
      const escrowAbi = loadAbi("CovenantEscrow");
      const { request } = await client.simulateContract({
        address: CONTRACTS.CovenantEscrow,
        abi: escrowAbi,
        functionName: "submitWork",
        args: [BigInt(taskId), deliverable],
        account,
      });
      const hash = await wallet.writeContract(request);
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 60_000 });
      return JSON.stringify({
        success: true,
        txHash: hash,
        block: Number(receipt.blockNumber),
        taskId,
      });
    }

    case "verify_task": {
      if (!account) return "Error: No PRIVATE_KEY configured. Cannot send transactions.";
      const wallet = getWalletClient();
      if (!wallet) return "Error: No wallet client available.";
      const taskId = Number(args.task_id);
      const escrowAbi = loadAbi("CovenantEscrow");
      const { request } = await client.simulateContract({
        address: CONTRACTS.CovenantEscrow,
        abi: escrowAbi,
        functionName: "completeTask",
        args: [BigInt(taskId), "0x"],
        account,
      });
      const hash = await wallet.writeContract(request);
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 60_000 });
      return JSON.stringify({
        success: true,
        txHash: hash,
        block: Number(receipt.blockNumber),
        taskId,
        message: "Task completed, payment released",
      });
    }

    case "get_stats": {
      const identityAbi = loadAbi("CovenantIdentity");
      const escrowAbi = loadAbi("CovenantEscrow");
      const [totalAgents, totalTasks, fees] = await Promise.all([
        client.readContract({ address: CONTRACTS.CovenantIdentity, abi: identityAbi, functionName: "totalAgents", args: [] }),
        client.readContract({ address: CONTRACTS.CovenantEscrow, abi: escrowAbi, functionName: "taskCount", args: [] }),
        client.readContract({ address: CONTRACTS.CovenantEscrow, abi: escrowAbi, functionName: "accumulatedFees", args: [] }).catch(() => 0n),
      ]);
      return JSON.stringify({
        totalAgents: Number(totalAgents),
        totalTasks: Number(totalTasks),
        protocolFees: toEth(fees as bigint),
        network: CHAIN_NAME,
      });
    }

    case "get_balance": {
      if (!account) return "Error: No PRIVATE_KEY configured.";
      const balance = await client.getBalance({ address: account.address });
      return JSON.stringify({
        address: account.address,
        balance: formatEther(balance) + " ETH",
      });
    }

    default:
      return `Error: Unknown tool "${name}"`;
  }
}

// ── CovenantAI class ───────────────────────────────────────────

export class CovenantAI {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private conversationHistory: Array<{
    role: string;
    content: string | null;
    tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
    tool_call_id?: string;
  }> = [];

  constructor(apiKey: string, baseUrl: string, model: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = model;
  }

  private systemPrompt(): string {
    const account = getAccount();
    const walletAddr = account?.address ?? "Not configured";
    return `You are COVENANT AI, an assistant for the COVENANT Autonomous Agent Enforcement Protocol on Base Sepolia.

You can read on-chain data and execute transactions through tools. The connected wallet is: ${walletAddr}

Available tools:
- get_agent / get_agent_count: Look up agent profiles
- get_task / get_task_count: Look up task details
- create_task: Create a new escrow task (requires wallet)
- register_agent: Register an agent on-chain (requires wallet + stake)
- submit_work: Submit a deliverable hash for a task
- verify_task: Complete a task and release payment
- get_stats: Protocol-wide statistics
- get_balance: Check wallet ETH balance

For write operations (create_task, register_agent, submit_work, verify_task), confirm with the user before executing. Always explain what an on-chain action does before calling it. Responses should be concise and helpful.`;
  }

  async chat(userMessage: string): Promise<string> {
    this.conversationHistory.push({ role: "user", content: userMessage });

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const messages = [
        { role: "system", content: this.systemPrompt() },
        ...this.conversationHistory,
      ];

      const body = {
        model: this.model,
        messages,
        tools: TOOL_SCHEMAS,
        tool_choice: "auto",
      };

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice) throw new Error("No response from AI");

      const message = choice.message;

      // No tool calls — return the text response
      if (!message.tool_calls || message.tool_calls.length === 0) {
        const reply = message.content ?? "";
        this.conversationHistory.push({ role: "assistant", content: reply });
        return reply;
      }

      // Process tool calls
      this.conversationHistory.push({
        role: "assistant",
        content: message.content,
        tool_calls: message.tool_calls,
      });

      for (const tc of message.tool_calls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch (e) {
          printError(`AI returned invalid JSON for ${tc.function.name}`);
          continue;
        }
        let result: string;
        try {
          result = await executeTool(tc.function.name, args);
        } catch (err) {
          result = `Error executing ${tc.function.name}: ${err instanceof Error ? err.message : String(err)}`;
        }

        this.conversationHistory.push({
          role: "tool",
          content: result,
          tool_call_id: tc.id,
        });
      }
    }

    return "Reached maximum tool call iterations. Please try a simpler request.";
  }

  async runREPL(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    process.on("SIGINT", () => {
      console.log(chalk.gray("\n  Goodbye.\n"));
      rl.close();
      process.exit(0);
    });

    if (!isQuietMode()) {
      console.log();
      console.log(chalk.bold.white("  COVENANT AI"));
      console.log(chalk.gray("  Type your message. Commands: /quit, /clear, /status"));
      console.log();
    }

    const prompt = (): void => {
      const promptStr = chalk.magenta("🟢 covenant") + chalk.white(" > ");
      rl.question(promptStr, async (input) => {
        const trimmed = input.trim();
        if (!trimmed) {
          prompt();
          return;
        }

        if (trimmed === "/quit" || trimmed === "/exit") {
          console.log(chalk.gray("\n  Goodbye.\n"));
          rl.close();
          process.exit(0);
        }

        if (trimmed === "/clear") {
          this.conversationHistory = [];
          console.log(chalk.gray("  Conversation cleared.\n"));
          prompt();
          return;
        }

        if (trimmed === "/status") {
          const account = getAccount();
          console.log(chalk.gray(`  Wallet: ${account?.address ?? "Not configured"}`));
          console.log(chalk.gray(`  Network: ${CHAIN_NAME}`));
          console.log(chalk.gray(`  Model: ${this.model}`));
          console.log(chalk.gray(`  Provider: ${this.baseUrl}\n`));
          prompt();
          return;
        }

        const spinner = ora({ text: chalk.cyan("Thinking..."), color: "cyan" }).start();
        try {
          const response = await this.chat(trimmed);
          spinner.stop();
          if (isJsonMode()) {
            console.log(JSON.stringify({ response }, null, 2));
          } else {
            console.log(`\n  ${chalk.white(response)}\n`);
          }
        } catch (err) {
          spinner.fail(chalk.red("Error"));
          const msg = err instanceof Error ? err.message : String(err);
          if (isJsonMode()) {
            console.log(JSON.stringify({ error: msg }, null, 2));
          } else {
            console.log(chalk.red(`  ${msg}\n`));
            if (msg.includes("401") || msg.includes("403")) {
              console.log(chalk.yellow("  Check your AI_API_KEY is valid.\n"));
            }
          }
        }

        await printTicker();
        prompt();
      });
    };

    prompt();
  }
}
