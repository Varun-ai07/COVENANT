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
        "Buy crypto with fiat currency to use on COVENANT.\n\n" +
        "ACTIONS:\n" +
        "  url — Get a direct purchase URL for a specific amount\n" +
        "  providers — List all supported on-ramp providers\n\n" +
        "USE WHEN: You need ETH or USDC on Base to pay for tasks.\n" +
        "NOTE: COVENANT runs on Base L2. You need Base ETH for gas and task payments.",
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
