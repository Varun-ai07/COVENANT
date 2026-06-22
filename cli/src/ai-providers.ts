export interface AIProvider {
  baseUrl: string;
  model: string;
}

export const AI_PROVIDERS: Record<string, AIProvider> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o",
  },
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    model: "meta/llama-3.1-70b-instruct",
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
  },
};

export function getProvider(name: string): AIProvider | null {
  return AI_PROVIDERS[name.toLowerCase()] ?? null;
}

export function listProviders(): string[] {
  return Object.keys(AI_PROVIDERS);
}
