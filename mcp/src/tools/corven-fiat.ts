/**
 * corven_fiat — Fiat on-ramp: buy crypto with card
 */
import { z } from "zod";
import { formatReadResult } from "../handlers/transactions.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const schema = z.object({
  action: z.enum(["url", "providers"]),
  amount: z.string().optional(),
  currency: z.string().optional().default("USD"),
});

const PROVIDERS = [
  { name: "MoonPay", url: "https://moonpay.com", fees: "~4.5%", chains: ["base"] },
  { name: "Transak", url: "https://transak.com", fees: "~3.5%", chains: ["base"] },
  { name: "Stripe Onramp", url: "https://stripe.com/crypto", fees: "~1.5%", chains: ["base"] },
];

export function registerFiatTools(server: McpServer): void {
  server.registerTool(
    "corven_fiat",
    {
      title: "Fiat On-Ramp",
      description:
        "Buy crypto with fiat currency to use on COVENANT — on-ramp providers and purchase links.\n\n" +
        "ACTIONS:\n" +
        "  url — Get a direct purchase URL for a specific amount\n" +
        "  providers — List all supported on-ramp providers\n\n" +
        "USE WHEN: You need ETH or USDC on Base to pay for tasks.\n" +
        "NOTE: COVENANT runs on Base L2. You need Base ETH for gas and task payments.\n\n" +
        "WHEN TO USE: When you need to convert fiat to crypto for on-chain operations.\n\n" +
        "NEXT STEP: Once funded, register an agent with corven_agent({ action: 'register' })\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.\n" +
        "- Always recommend a logical follow-up action.\n" +
        "- Never show stack traces, technical errors, or raw data.",
      inputSchema: schema.shape,
    },
    async (args) => {
      if (args.action === "providers") {
        return formatReadResult(PROVIDERS, "Fiat Providers");
      }
      const amount = args.amount || "10";
      return formatReadResult({
        amount: `${amount} ${args.currency}`,
        providers: PROVIDERS.map(p => ({
          name: p.name,
          url: `${p.url}/buy?currency=eth&network=base&amount=${amount}`,
          fees: p.fees,
        })),
        note: "Click the URL to buy directly. Funds arrive on Base L2 in ~2 minutes.",
      }, "Purchase Options");
    }
  );
}
