/**
 * COVENANT MCP Tools — Task Templates
 *
 * corven_list_templates     — Browse available task templates with pricing
 * corven_create_from_template — Create a task from a template with auto-calculated price
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatSuccess, formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { ethAddress, unixDeadline, ipfsCid } from "../lib/schemaHelpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ──────────────────────────────────────────────────────────────
// Template definitions
// ──────────────────────────────────────────────────────────────

interface TaskTemplate {
  name: string;
  category: string;
  description: string;
  parameters: Record<string, { type: string; required: boolean; default?: any; description: string }>;
  pricing: { base: string; perUnit: string; unit: string; multipliers?: Record<string, number> };
  verification: string[];
  outputFormat: string;
}

const TEMPLATES: TaskTemplate[] = [
  {
    name: "code-review",
    category: "code",
    description: "Professional code review with actionable feedback on security, performance, and style",
    parameters: {
      language: { type: "string", required: true, description: "Programming language (python, javascript, typescript, go, rust, java)" },
      repo_url: { type: "string", required: true, description: "Repository URL or IPFS CID of code" },
      branch: { type: "string", required: false, default: "main", description: "Branch to review" },
      focus_areas: { type: "array", required: false, default: ["style", "security"], description: "Areas to focus on: security, performance, style, architecture, testing" },
      max_files: { type: "number", required: false, default: 20, description: "Maximum files to review (1-200)" },
    },
    pricing: { base: "0.005", perUnit: "0.0005", unit: "file", multipliers: { security: 1.5, performance: 1.3, architecture: 1.4 } },
    verification: ["output_not_empty", "contains_line_references", "severity_levels_present"],
    outputFormat: "markdown",
  },
  {
    name: "data-analysis",
    category: "data",
    description: "Analyze a dataset and produce insights, visualizations, and recommendations",
    parameters: {
      dataset_url: { type: "string", required: true, description: "URL or IPFS CID of dataset (CSV, JSON, Parquet)" },
      questions: { type: "array", required: true, description: "Specific questions to answer about the data" },
      output_format: { type: "string", required: false, default: "markdown", description: "Output format: markdown, json, csv" },
    },
    pricing: { base: "0.003", perUnit: "0.001", unit: "question" },
    verification: ["output_not_empty", "contains_statistics", "answers_all_questions"],
    outputFormat: "markdown",
  },
  {
    name: "research-report",
    category: "research",
    description: "Deep research on a topic with citations, analysis, and structured findings",
    parameters: {
      topic: { type: "string", required: true, description: "Research topic or question" },
      depth: { type: "string", required: false, default: "standard", description: "Research depth: quick, standard, deep" },
      min_sources: { type: "number", required: false, default: 5, description: "Minimum number of sources to cite" },
      focus_areas: { type: "array", required: false, default: [], description: "Specific subtopics to focus on" },
    },
    pricing: { base: "0.004", perUnit: "0.0008", unit: "source", multipliers: { deep: 2.0, quick: 0.5 } },
    verification: ["output_not_empty", "min_citations_met", "has_structure"],
    outputFormat: "markdown",
  },
  {
    name: "content-writing",
    category: "content",
    description: "Write articles, blog posts, documentation, or marketing copy",
    parameters: {
      topic: { type: "string", required: true, description: "Content topic" },
      word_count: { type: "number", required: false, default: 1000, description: "Target word count" },
      tone: { type: "string", required: false, default: "professional", description: "Tone: professional, casual, technical, persuasive" },
      content_type: { type: "string", required: false, default: "article", description: "Type: article, blog, documentation, marketing" },
    },
    pricing: { base: "0.002", perUnit: "0.000002", unit: "word" },
    verification: ["output_not_empty", "word_count_met", "has_sections"],
    outputFormat: "markdown",
  },
  {
    name: "security-audit",
    category: "security",
    description: "Security audit of smart contracts, APIs, or application code",
    parameters: {
      target_url: { type: "string", required: true, description: "Repository URL or IPFS CID of code to audit" },
      scope: { type: "string", required: false, default: "full", description: "Audit scope: full, smart-contracts, api, infrastructure" },
      standards: { type: "array", required: false, default: ["owasp-top-10"], description: "Standards to audit against" },
    },
    pricing: { base: "0.01", perUnit: "0.001", unit: "file", multipliers: { "smart-contracts": 2.0 } },
    verification: ["output_not_empty", "has_severity_levels", "has_recommendations"],
    outputFormat: "markdown",
  },
  {
    name: "fullstack-app",
    category: "code",
    description: "Build a complete full-stack application with frontend, backend, and database",
    parameters: {
      description: { type: "string", required: true, description: "What the application should do" },
      tech_stack: { type: "array", required: false, default: ["nextjs", "postgresql"], description: "Preferred tech stack" },
      features: { type: "array", required: true, description: "List of features to implement" },
    },
    pricing: { base: "0.02", perUnit: "0.003", unit: "feature" },
    verification: ["builds_successfully", "tests_pass", "url_accessible"],
    outputFormat: "repository",
  },
];

// ──────────────────────────────────────────────────────────────
// Price calculation
// ──────────────────────────────────────────────────────────────

function calculatePrice(
  template: TaskTemplate,
  params: Record<string, any>
): { baseCost: number; unitCost: number; multiplier: number; totalEth: string; breakdown: string } {
  const base = parseFloat(template.pricing.base);
  const perUnit = parseFloat(template.pricing.perUnit);
  const unit = template.pricing.unit;

  // Determine unit count from template-specific parameters
  let unitCount = 1;
  if (unit === "file") {
    unitCount = params.max_files ?? 20;
  } else if (unit === "question") {
    unitCount = Array.isArray(params.questions) ? params.questions.length : 1;
  } else if (unit === "source") {
    unitCount = params.min_sources ?? 5;
  } else if (unit === "word") {
    unitCount = params.word_count ?? 1000;
  } else if (unit === "feature") {
    unitCount = Array.isArray(params.features) ? params.features.length : 1;
  }

  // Apply multipliers
  let multiplier = 1.0;
  const multipliers = template.pricing.multipliers;
  if (multipliers) {
    // Check focus_areas for code-review and research-report
    const focusAreas: string[] = params.focus_areas ?? [];
    for (const area of focusAreas) {
      if (multipliers[area]) {
        multiplier = Math.max(multiplier, multipliers[area]);
      }
    }
    // Check depth for research-report
    if (params.depth && multipliers[params.depth]) {
      multiplier = multipliers[params.depth];
    }
    // Check scope for security-audit
    if (params.scope && multipliers[params.scope]) {
      multiplier = multipliers[params.scope];
    }
  }

  const baseCost = base;
  const unitCost = perUnit * unitCount;
  const total = (baseCost + unitCost) * multiplier;

  const breakdown = [
    `Base: ${base} ETH`,
    `Units: ${unitCount} ${unit} x ${perUnit} ETH = ${unitCost.toFixed(6)} ETH`,
    multiplier > 1 ? `Multiplier: ${multiplier}x` : null,
    `Total: ${total.toFixed(6)} ETH`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    baseCost,
    unitCost,
    multiplier,
    totalEth: total.toFixed(6),
    breakdown,
  };
}

// ──────────────────────────────────────────────────────────────
// Registration
// ──────────────────────────────────────────────────────────────

export function registerTemplateTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_list_templates
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_list_templates",
    {
      title: "List Task Templates",
      description:
        "Returns all available task templates with their parameters and auto-pricing.\n" +
        "USE WHEN: You want to create a task but need a standardized workflow. Templates auto-calculate price based on parameters.\n" +
        "REQUIRES: Nothing. Pure data return, no blockchain interaction.\n" +
        "RETURNS: Template name, category, description, parameters, pricing model, verification checks.\n" +
        "COMES BEFORE: corven_create_from_template to create a task from a template.\n" +
        "FILTER: Pass category to filter by type (code, data, research, content, security).",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe("Filter templates by category: code, data, research, content, security"),
      },
    },
    async ({ category }) => {
      try {
        let templates = TEMPLATES;

        if (category) {
          const cat = category.toLowerCase();
          templates = TEMPLATES.filter((t) => t.category === cat);
          if (templates.length === 0) {
            const available = [...new Set(TEMPLATES.map((t) => t.category))].join(", ");
            return formatStructuredError(
              `No templates found for category '${category}'.`,
              `Available categories: ${available}`,
              "Pass one of the available categories, or omit the filter to see all templates.",
              false
            );
          }
        }

        const catalog = templates.map((t) => ({
          name: t.name,
          category: t.category,
          description: t.description,
          parameters: t.parameters,
          pricing: {
            base: `${t.pricing.base} ETH`,
            perUnit: `${t.pricing.perUnit} ETH per ${t.pricing.unit}`,
            ...(t.pricing.multipliers && { multipliers: t.pricing.multipliers }),
          },
          verification: t.verification,
          outputFormat: t.outputFormat,
        }));

        return formatReadResult(
          { templateCount: catalog.length, templates: catalog },
          category ? `Templates in '${category}'` : "All available task templates"
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_create_from_template
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_from_template",
    {
      title: "Create Task from Template",
      description:
        "Creates a task from a predefined template with auto-calculated pricing based on parameters.\n" +
        "USE WHEN: You want standardized task creation with built-in pricing, verification checks, and output format.\n" +
        "REQUIRES: Both client and worker must be registered. Client wallet needs calculated price + ~2% fees + gas.\n" +
        "RETURNS: taskId, calculated price with breakdown, template used, worker assigned, Basescan link.\n" +
        "COMES AFTER: corven_list_templates to see available templates and their parameters.\n" +
        "COMES BEFORE: Worker calls corven_submit_work. Client calls corven_verify_task.\n" +
        "TEMPLATES: code-review, data-analysis, research-report, content-writing, security-audit, fullstack-app.\n" +
        "NOTE: Price is auto-calculated from template base + per-unit cost x quantity + multipliers. Call corven_list_templates for exact pricing.",
      inputSchema: {
        template: z.string().describe("Template name: code-review, data-analysis, research-report, content-writing, security-audit, fullstack-app"),
        worker: ethAddress,
        deadline: unixDeadline,
        descriptionHash: ipfsCid,
        // Template-specific parameters (all optional with defaults applied by template)
        language: z.string().optional().describe("Programming language (code-review template)"),
        repo_url: z.string().optional().describe("Repository URL or IPFS CID (code-review, security-audit templates)"),
        branch: z.string().optional().describe("Branch to review (code-review template)"),
        focus_areas: z.array(z.string()).optional().describe("Focus areas for the task"),
        max_files: z.number().optional().describe("Maximum files to review (code-review template, 1-200)"),
        dataset_url: z.string().optional().describe("Dataset URL or CID (data-analysis template)"),
        questions: z.array(z.string()).optional().describe("Questions to answer (data-analysis template)"),
        output_format: z.string().optional().describe("Output format (data-analysis template)"),
        topic: z.string().optional().describe("Topic (research-report, content-writing templates)"),
        depth: z.string().optional().describe("Research depth: quick, standard, deep (research-report template)"),
        min_sources: z.number().optional().describe("Minimum sources to cite (research-report template)"),
        word_count: z.number().optional().describe("Target word count (content-writing template)"),
        tone: z.string().optional().describe("Writing tone (content-writing template)"),
        content_type: z.string().optional().describe("Content type (content-writing template)"),
        target_url: z.string().optional().describe("Audit target URL (security-audit template)"),
        scope: z.string().optional().describe("Audit scope (security-audit template)"),
        standards: z.array(z.string()).optional().describe("Audit standards (security-audit template)"),
        description: z.string().optional().describe("App description (fullstack-app template)"),
        tech_stack: z.array(z.string()).optional().describe("Tech stack (fullstack-app template)"),
        features: z.array(z.string()).optional().describe("Features list (fullstack-app template)"),
      },
    },
    async ({
      template,
      worker,
      deadline,
      descriptionHash,
      language,
      repo_url,
      branch,
      focus_areas,
      max_files,
      dataset_url,
      questions,
      output_format,
      topic,
      depth,
      min_sources,
      word_count,
      tone,
      content_type,
      target_url,
      scope,
      standards,
      description: appDescription,
      tech_stack,
      features,
    }) => {
      try {
        // Resolve template
        const tmpl = TEMPLATES.find((t) => t.name === template);
        if (!tmpl) {
          const available = TEMPLATES.map((t) => t.name).join(", ");
          return formatStructuredError(
            `Unknown template '${template}'.`,
            `Available templates: ${available}`,
            "Pass one of the available template names. Call corven_list_templates for details.",
            false
          );
        }

        // Validate worker address
        if (!isAddress(worker)) {
          return formatStructuredError(
            "Invalid worker address.",
            `'${worker}' is not a valid Ethereum address.`,
            "Pass a full 42-character 0x Ethereum address.",
            false
          );
        }

        // Validate required parameters
        const params: Record<string, any> = {};
        for (const [key, def] of Object.entries(tmpl.parameters)) {
          // Map template parameter names to input fields
          let value: any;
          switch (key) {
            case "language": value = language; break;
            case "repo_url": value = repo_url; break;
            case "branch": value = branch; break;
            case "focus_areas": value = focus_areas; break;
            case "max_files": value = max_files; break;
            case "dataset_url": value = dataset_url; break;
            case "questions": value = questions; break;
            case "output_format": value = output_format; break;
            case "topic": value = topic; break;
            case "depth": value = depth; break;
            case "min_sources": value = min_sources; break;
            case "word_count": value = word_count; break;
            case "tone": value = tone; break;
            case "content_type": value = content_type; break;
            case "target_url": value = target_url; break;
            case "scope": value = scope; break;
            case "standards": value = standards; break;
            case "description": value = appDescription; break;
            case "tech_stack": value = tech_stack; break;
            case "features": value = features; break;
            default: value = undefined;
          }

          if (value !== undefined) {
            params[key] = value;
          } else if (def.required) {
            return formatStructuredError(
              `Missing required parameter '${key}' for template '${template}'.`,
              `The '${key}' parameter is required: ${def.description}`,
              `Pass '${key}' in your request. Call corven_list_templates to see all parameters for this template.`,
              true
            );
          } else if (def.default !== undefined) {
            params[key] = def.default;
          }
        }

        // Calculate price
        const pricing = calculatePrice(tmpl, params);
        const paymentWei = parseEther(pricing.totalEth);

        // Validate payment is reasonable
        const paymentFloat = parseFloat(pricing.totalEth);
        if (paymentFloat < 0.001) {
          return formatStructuredError(
            "Calculated price is below minimum.",
            `Template calculated ${pricing.totalEth} ETH, but minimum task payment is 0.001 ETH.`,
            "Increase the unit count or parameters to raise the price above the minimum.",
            true
          );
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY environment variable is not set.",
            "Set PRIVATE_KEY in your .env file.",
            false
          );
        }

        // Calculate total value: payment + protocol fee (1%) + priority fee (Medium=1%)
        const PROTOCOL_FEE_BPS = 100n;
        const PRIORITY_FEE_BPS = 100n; // Default Medium priority
        const totalFeeBps = PROTOCOL_FEE_BPS + PRIORITY_FEE_BPS;
        const feeAmount = (paymentWei * totalFeeBps) / 10000n;
        const totalValue = paymentWei + feeAmount;

        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow,
          loadAbi("TaskEscrow"),
          "createAndFundTask",
          [worker as Address, paymentWei, BigInt(deadline), descriptionHash],
          totalValue
        );

        if (result.status === "success") {
          const deadlineDate = new Date(deadline * 1000).toUTCString();
          return formatSuccess(
            `Task created from '${template}' template. ${pricing.totalEth} ETH locked in escrow.`,
            {
              template: tmpl.name,
              category: tmpl.category,
              worker,
              client: account,
              payment: `${pricing.totalEth} ETH`,
              priceBreakdown: pricing.breakdown,
              deadline: deadlineDate,
              specificationIpfs: descriptionHash,
              status: "Funded",
              outputFormat: tmpl.outputFormat,
              verificationChecks: tmpl.verification,
              parameters: params,
            },
            result.txHash,
            [
              "Worker will execute the task following the template specification.",
              "Wait for worker to call corven_submit_work with your taskId.",
              "Then call corven_verify_task to release payment after reviewing work.",
              `Verification checks: ${tmpl.verification.join(", ")}`,
            ]
          );
        }

        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
