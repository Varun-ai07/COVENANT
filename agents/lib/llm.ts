import * as dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

// Initialize OpenRouter client (OpenAI-compatible)
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

// Default model - you can change this to any model available on OpenRouter
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

/**
 * Generate a completion using OpenRouter
 */
export async function generateCompletion(
  prompt: string,
  options?: { model?: string; maxTokens?: number; temperature?: number }
): Promise<string> {
  const model = options?.model || DEFAULT_MODEL;
  const maxTokens = options?.maxTokens || 1000;
  const temperature = options?.temperature || 0.7;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature,
    });

    // Handle response - OpenRouter may return different structure
    const content = response?.choices?.[0]?.message?.content;
    if (content) return content;

    // Fallback: check for reasoning-based response
    const choice = response?.choices?.[0];
    if (choice) {
      const msg = (choice as any).message;
      return msg?.reasoning || msg?.content || "";
    }

    console.error("Unexpected response structure:", JSON.stringify(response).slice(0, 500));
    return "";
  } catch (error) {
    console.error("LLM API error:", error);
    throw error;
  }
}

/**
 * Generate a structured JSON response
 */
export async function generateJSON<T = any>(
  prompt: string,
  options?: { model?: string; maxTokens?: number }
): Promise<T> {
  const jsonPrompt = `${prompt}\n\nRespond with ONLY a valid JSON object. No other text.`;
  const response = await generateCompletion(jsonPrompt, {
    ...options,
    temperature: 0.3, // Lower temperature for more consistent JSON
  });

  try {
    // Try to parse as-is first
    return JSON.parse(response);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error(`Failed to parse JSON from response: ${response}`);
  }
}

/**
 * Check if OpenRouter is configured
 */
export function isOpenRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}
