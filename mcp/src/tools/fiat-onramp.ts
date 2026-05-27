/**
 * Fiat On-Ramp MCP Tools
 *
 * Generate fiat-to-crypto on-ramp URLs via MoonPay or Transak.
 * No on-chain calls — purely URL construction with demo API keys.
 */
import { z } from "zod";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { ethAddress } from "../lib/schemaHelpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ─── Input Schemas ─────────────────────────────────────────────────

const onrampSchema = z.object({
  amount: z.number().positive().describe("Amount in USD to convert to ETH"),
  walletAddress: ethAddress,
  provider: z.enum(["moonpay", "transak"]).optional().default("moonpay").describe("On-ramp provider"),
});

// ─── API Keys (set via environment) ─────────────────────────────
const MOONPAY_API_KEY = process.env.MOONPAY_API_KEY || "demo";
const TRANSAK_API_KEY = process.env.TRANSAK_API_KEY || "demo";

function buildMoonPayUrl(amount: number, walletAddress: string): string {
  const params = new URLSearchParams({
    apiKey: MOONPAY_API_KEY,
    currencyCode: "eth",
    walletAddress,
    baseCurrencyAmount: String(amount),
  });
  return `https://buy.moonpay.com?${params.toString()}`;
}

function buildTransakUrl(amount: number, walletAddress: string): string {
  const params = new URLSearchParams({
    apiKey: TRANSAK_API_KEY,
    cryptoCurrencyCode: "ETH",
    walletAddress,
    fiatAmount: String(amount),
    fiatCurrency: "USD",
  });
  return `https://global.transak.com?${params.toString()}`;
}

// ─── Supported Providers ──────────────────────────────────────────

const SUPPORTED_PROVIDERS = [
  { id: "moonpay", name: "MoonPay", url: "https://moonpay.com", supports: ["USD", "EUR", "GBP"], methods: ["credit_card", "bank_transfer"] },
  { id: "transak", name: "Transak", url: "https://transak.com", supports: ["USD", "EUR", "GBP", "INR"], methods: ["credit_card", "bank_transfer", "apple_pay"] },
];

// ─── Tool Registration ─────────────────────────────────────────────

export function registerFiatOnrampTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_get_onramp_url
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_onramp_url",
    {
      title: "Get Fiat On-Ramp URL",
      description:
        "Generate a fiat-to-crypto on-ramp URL for purchasing ETH with a credit card or bank transfer. " +
        "Returns a ready-to-open URL for MoonPay or Transak.\n" +
        "USE WHEN: A user or agent needs to fund a wallet with ETH from fiat currency (USD, EUR, etc.).\n" +
        "REQUIRES: A valid Ethereum wallet address and the USD amount to convert.\n" +
        "RETURNS: A URL to the on-ramp provider and step-by-step instructions.\n" +
        "NOTE: Uses demo API keys. For production, replace with real API keys.",
      inputSchema: {
        amount: z.number().positive().describe("Amount in USD to convert to ETH"),
        walletAddress: ethAddress,
        provider: z.enum(["moonpay", "transak"]).optional().default("moonpay").describe("On-ramp provider"),
      },
    },
    async (params) => {
      try {
        const parsed = onrampSchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const { amount, walletAddress, provider } = parsed.data;

        const url = provider === "moonpay"
          ? buildMoonPayUrl(amount, walletAddress)
          : buildTransakUrl(amount, walletAddress);

        const providerLabel = provider === "moonpay" ? "MoonPay" : "Transak";

        return formatReadResult({
          provider: providerLabel,
          amount_usd: amount,
          wallet_address: walletAddress,
          url,
          instructions: [
            `Open the URL in a browser: ${url}`,
            "Complete the KYC verification if prompted",
            `Pay ${amount} USD via credit card or bank transfer`,
            `ETH will be sent to ${walletAddress}`,
            "Typically arrives in 1-5 minutes",
          ],
        }, `${providerLabel} On-Ramp Link`);
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_list_onramp_providers
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_list_onramp_providers",
    {
      title: "List On-Ramp Providers",
      description:
        "List all supported fiat-to-crypto on-ramp providers with their capabilities.\n" +
        "USE WHEN: Wanting to know which providers are available and what currencies/methods they support.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Array of providers with name, URL, supported currencies, and payment methods.",
      inputSchema: {},
    },
    async () => {
      return formatReadResult({
        providers: SUPPORTED_PROVIDERS,
        note: "Set MOONPAY_API_KEY and TRANSAK_API_KEY environment variables for production API keys.",
      }, "Fiat On-Ramp Providers");
    }
  );
}
