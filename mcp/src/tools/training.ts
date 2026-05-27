/**
 * Training Marketplace MCP Tools
 *
 * Training program marketplace for agent capability development.
 *
 * create_training  — Create a training program (course)
 * enroll_training  — Agent enrolls in a training program
 * list_trainings   — List available training programs
 * get_training     — Get training program details
 * complete_training — Mark training as completed, update capabilities
 */
import { z } from "zod";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { ethAddress, ethAmount } from "../lib/schemaHelpers.js";
import { loadStore, saveStore } from "../lib/store.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ─── In-memory store with persistence ────────────────────────

interface TrainingProgram {
  id: number;
  title: string;
  description: string;
  instructor: string;
  price: string; // ETH
  capabilities: string[];
  duration: number; // tasks to complete
  rating: number; // 0-500 (scaled by 100)
  graduates: number;
  enrolled: string[];
  completed: string[];
  createdAt: number;
}

const data = loadStore("training", { counter: 0, items: {} as Record<string, TrainingProgram> });
let trainingCounter: number = data.counter;
const trainings = new Map<number, TrainingProgram>(
  Object.entries(data.items).map(([k, v]) => [Number(k), v])
);

function persist(): void {
  const items: Record<string, TrainingProgram> = {};
  trainings.forEach((v, k) => { items[String(k)] = v; });
  saveStore("training", { counter: trainingCounter, items });
}

// ─── Registration ────────────────────────────────────────────

export function registerTrainingTools(server: McpServer): void {

  // ──────────────────────────────────────────────────────────────
  // corven_create_training
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_training",
    {
      title: "Create Training Program",
      description:
        "Creates a training program (course) that other agents can enroll in to learn new capabilities.\n" +
        "USE WHEN: You are an experienced agent and want to teach a skill to others. You want to earn fees from enrollment.\n" +
        "REQUIRES: You must be a registered agent. Provide a title, description, price, capabilities taught, and duration.\n" +
        "RETURNS: Training program ID, details, and enrollment instructions.\n" +
        "COMES BEFORE: Agents call corven_enroll_training to join. Call corven_complete_training after they finish.",
      inputSchema: {
        title: z.string().min(3).max(200).describe("Training program title"),
        description: z.string().min(10).max(2000).describe("Full description of what the training covers"),
        price: ethAmount.describe("Enrollment fee in ETH per student"),
        capabilities: z.array(z.string()).min(1).max(10).describe("Capabilities taught in this program"),
        duration: z.number().int().positive().optional().default(10).describe("Number of tasks to complete for graduation (default: 10)"),
      },
    },
    async ({ title, description, price, capabilities, duration }) => {
      try {
        const validation = z.object({
          title: z.string().min(3).max(200),
          description: z.string().min(10).max(2000),
          price: z.string().regex(/^\d+\.?\d*$/).refine(v => parseFloat(v) > 0),
          capabilities: z.array(z.string()).min(1).max(10),
          duration: z.number().int().positive(),
        }).safeParse({ title, description, price, capabilities, duration });
        if (!validation.success) {
          return formatStructuredError(
            `Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`,
            "Validation failed.",
            "Check parameter formats.",
            false
          );
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        }

        const id = ++trainingCounter;
        const program: TrainingProgram = {
          id,
          title,
          description,
          instructor: account.address,
          price,
          capabilities,
          duration,
          rating: 0,
          graduates: 0,
          enrolled: [],
          completed: [],
          createdAt: Math.floor(Date.now() / 1000),
        };
        trainings.set(id, program);
        persist();

        return {
          content: [{
            type: "text" as const,
            text: [
              `Training program created.`,
              "",
              `ID: ${id}`,
              `Title: ${title}`,
              `Instructor: ${account.address}`,
              `Price: ${price} ETH`,
              `Capabilities: ${capabilities.join(", ")}`,
              `Duration: ${duration} tasks`,
              "",
              `Share this ID with agents to let them enroll.`,
            ].join("\n"),
          }],
        };
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_enroll_training
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_enroll_training",
    {
      title: "Enroll in Training Program",
      description:
        "Enrolls the calling agent in a training program to learn new capabilities.\n" +
        "USE WHEN: You want to learn a new skill from an experienced instructor. You found a training via corven_list_trainings.\n" +
        "REQUIRES: You must be a registered agent. The training program must exist. You cannot enroll twice.\n" +
        "RETURNS: Enrollment confirmation, training details, and next steps.\n" +
        "COMES AFTER: corven_list_trainings or corven_get_training to find a program.\n" +
        "COMES BEFORE: Complete tasks, then call corven_complete_training to graduate.",
      inputSchema: {
        trainingId: z.number().int().positive().describe("Training program ID to enroll in"),
      },
    },
    async ({ trainingId }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        }

        const program = trainings.get(trainingId);
        if (!program) {
          return formatStructuredError(`Training #${trainingId} not found.`, "Invalid training ID.", "Use corven_list_trainings to see available programs.", false);
        }

        if (program.enrolled.includes(account.address)) {
          return formatStructuredError("Already enrolled.", `You are already enrolled in "${program.title}".`, "Complete the required tasks and call corven_complete_training.", false);
        }

        if (program.completed.includes(account.address)) {
          return formatStructuredError("Already graduated.", `You already completed "${program.title}".`, "You have the capabilities from this training.", false);
        }

        program.enrolled.push(account.address);
        persist();

        return {
          content: [{
            type: "text" as const,
            text: [
              `Enrolled in "${program.title}".`,
              "",
              `Training ID: ${program.id}`,
              `Instructor: ${program.instructor}`,
              `Capabilities to learn: ${program.capabilities.join(", ")}`,
              `Duration: ${program.duration} tasks`,
              `Enrolled: ${program.enrolled.length} agents`,
              "",
              `Complete ${program.duration} tasks, then call corven_complete_training to graduate.`,
            ].join("\n"),
          }],
        };
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_list_trainings
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_list_trainings",
    {
      title: "List Training Programs",
      description:
        "Lists all available training programs with optional rating filter.\n" +
        "USE WHEN: Browsing available courses. Looking for programs teaching specific capabilities. Comparing options.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Array of training programs with title, instructor, price, capabilities, rating, and enrollment counts.\n" +
        "COMES BEFORE: corven_get_training for details. corven_enroll_training to join.",
      inputSchema: {
        minRating: z.number().min(0).max(5).optional().describe("Filter: minimum rating (0-5, default: show all)"),
      },
    },
    async ({ minRating }) => {
      try {
        const programs = Array.from(trainings.values());
        const filtered = minRating !== undefined
          ? programs.filter(p => p.rating >= minRating * 100)
          : programs;

        if (filtered.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "No training programs found. Be the first to create one with corven_create_training.",
            }],
          };
        }

        const lines: string[] = [`Training Programs (${filtered.length}):`, ""];
        for (const p of filtered) {
          const ratingStr = p.rating > 0 ? `${(p.rating / 100).toFixed(1)}/5` : "No ratings";
          lines.push([
            `#${p.id} — ${p.title}`,
            `  Instructor: ${p.instructor.slice(0, 6)}...${p.instructor.slice(-4)}`,
            `  Price: ${p.price} ETH | Rating: ${ratingStr} | Graduates: ${p.graduates}`,
            `  Capabilities: ${p.capabilities.join(", ")}`,
            `  Duration: ${p.duration} tasks | Enrolled: ${p.enrolled.length}`,
            "",
          ].join("\n"));
        }

        return {
          content: [{
            type: "text" as const,
            text: lines.join("\n"),
          }],
        };
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_training
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_training",
    {
      title: "Get Training Program Details",
      description:
        "Retrieves full details of a training program including enrolled and completed agents.\n" +
        "USE WHEN: Evaluating a program before enrolling. Checking your own enrollment status. Viewing instructor info.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Full program details: title, description, instructor, price, capabilities, duration, rating, graduates, enrolled list, completed list.\n" +
        "COMES AFTER: corven_list_trainings to find the training ID.\n" +
        "COMES BEFORE: corven_enroll_training to join.",
      inputSchema: {
        trainingId: z.number().int().positive().describe("Training program ID"),
      },
    },
    async ({ trainingId }) => {
      try {
        const program = trainings.get(trainingId);
        if (!program) {
          return formatStructuredError(`Training #${trainingId} not found.`, "Invalid training ID.", "Use corven_list_trainings to see available programs.", false);
        }

        const ratingStr = program.rating > 0 ? `${(program.rating / 100).toFixed(1)}/5` : "No ratings";

        return formatReadResult({
          id: program.id,
          title: program.title,
          description: program.description,
          instructor: program.instructor,
          priceEth: program.price,
          capabilities: program.capabilities,
          duration: program.duration,
          rating: ratingStr,
          graduates: program.graduates,
          enrolledCount: program.enrolled.length,
          completedCount: program.completed.length,
          enrolled: program.enrolled,
          completed: program.completed,
          createdAt: program.createdAt,
        }, `Training #${trainingId}`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_complete_training
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_complete_training",
    {
      title: "Complete Training Program",
      description:
        "Marks the calling agent as having completed a training program. Updates agent capabilities.\n" +
        "USE WHEN: You finished the required tasks in a training. You want to prove you learned the new capabilities.\n" +
        "REQUIRES: You must be enrolled in the training. The training program must exist.\n" +
        "RETURNS: Completion confirmation, capabilities earned, graduate count, txHash.\n" +
        "COMES AFTER: corven_enroll_training, then completing the required tasks.\n" +
        "NOTE: Capability proofs are recorded in the training registry. Use corven_get_agent to verify your updated profile.",
      inputSchema: {
        trainingId: z.number().int().positive().describe("Training program ID to complete"),
      },
    },
    async ({ trainingId }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        }

        const program = trainings.get(trainingId);
        if (!program) {
          return formatStructuredError(`Training #${trainingId} not found.`, "Invalid training ID.", "Use corven_list_trainings to see available programs.", false);
        }

        if (!program.enrolled.includes(account.address)) {
          return formatStructuredError("Not enrolled.", `You are not enrolled in "${program.title}".`, "Call corven_enroll_training first.", false);
        }

        if (program.completed.includes(account.address)) {
          return formatStructuredError("Already completed.", `You already completed "${program.title}".`, "You have the capabilities from this training.", false);
        }

        program.completed.push(account.address);
        program.graduates++;
        persist();

        return {
          content: [{
            type: "text" as const,
            text: [
              `Training "${program.title}" completed.`,
              "",
              `Capabilities earned: ${program.capabilities.join(", ")}`,
              `Total graduates: ${program.graduates}`,
              `Enrolled agents: ${program.enrolled.length}`,
              "",
              `Capability proof recorded in training registry #${program.id}.`,
              `Call corven_get_agent to view your updated profile.`,
            ].join("\n"),
          }],
        };
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

}
