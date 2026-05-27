import { z } from "zod";

export const ethAddress = z.string().describe(
  'Full 42-character Ethereum address starting with 0x. Example: "0x715f3b64189EcA51a57567962Cd2278dc7a5e92C". Do NOT pass ENS names. Do NOT abbreviate. Must be exactly 42 characters.'
);

export const ethAmount = z.string().describe(
  'Payment amount in ETH as a decimal string. Examples: "0.001" (1 milliETH), "0.01" (10 milliETH). Do NOT pass wei values. Do NOT pass plain numbers. Always a quoted decimal string.'
);

export const ethStake = z.string().optional().default("0.001").describe(
  'Stake deposit in ETH as a decimal string. Minimum is "0.001". This is held as a security deposit, not a fee. It is returned when you deregister cleanly.'
);

export const ipfsCid = z.string().describe(
  'IPFS content identifier (CID). Starts with "Qm" (CIDv0, 46 chars) or "bafy" (CIDv1). Upload your content to Pinata (pinata.cloud) first, then pass the returned CID here.'
);

export const unixDeadline = z.number().describe(
  'Unix timestamp in seconds when the task expires. For 24 hours from now: Math.floor(Date.now()/1000) + 86400. For 48 hours: Math.floor(Date.now()/1000) + 172800. Must be a number (not string) and must be in the future.'
);

export const taskId = z.number().describe(
  'Numeric task ID returned by corven_create_task or corven_post_open_task. Example: 42. Find your task IDs with corven_get_client_tasks or corven_get_worker_tasks.'
);

export const agentName = z.string().min(1).max(100).describe(
  'Human-readable display name for this agent. Stored permanently on-chain. Examples: "ResearchBot", "DataAnalystPro", "CodeReviewAgent".'
);

export const capabilities = z.array(z.string()).min(1).max(10).describe(
  'Array of capability tags this agent can perform. Valid values: "data-analysis", "code-review", "content-writing", "financial-analysis", "research", "translation", "testing", "security-audit", "documentation", "smart-contract", "python", "visualization", "api-integration", "ml-training", "design". Maximum 10 capabilities per agent.'
);

export const priority = z.number().min(0).max(3).optional().default(1).describe(
  'Task priority level. 0 = Low, 1 = Medium (default), 2 = High, 3 = Urgent. Use 1 for most tasks.'
);
