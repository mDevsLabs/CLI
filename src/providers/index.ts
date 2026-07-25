import { openaiProvider } from "./openai.js";
import { anthropicProvider } from "./anthropic.js";
import { geminiProvider } from "./gemini.js";
import { mistralProvider } from "./mistral.js";
import { groqProvider } from "./groq.js";
import { ollamaProvider } from "./ollama.js";
import { lmstudioProvider } from "./lmstudio.js";
import { mlxProvider } from "./mlx.js";
import { deepseekProvider } from "./deepseek.js";
import { xaiProvider } from "./xai.js";
import { openrouterProvider } from "./openrouter.js";
import { bedrockProvider } from "./bedrock.js";
import { alibabaProvider } from "./alibaba.js";
import { anthropicMaxProvider } from "./anthropicMax.js";
import { ollamaCloudProvider } from "./ollamaCloud.js";
import { huggingfaceProvider } from "./huggingface.js";
import { nvidiaProvider } from "./nvidia.js";
import type { Provider, ProviderConfig } from "./types.js";
import type { CustomProvider } from "../config/settings.js";
import { getCustomProviders } from "../config/settings.js";

export const providers: Map<string, Provider> = new Map([
  ["openrouter", openrouterProvider],
  ["openai", openaiProvider],
  ["anthropic", anthropicProvider],
  ["anthropic-max", anthropicMaxProvider],
  ["gemini", geminiProvider],
  ["alibaba", alibabaProvider],
  ["mistral", mistralProvider],
  ["groq", groqProvider],
  ["deepseek", deepseekProvider],
  ["xai", xaiProvider],
  ["bedrock", bedrockProvider],
  ["ollama-cloud", ollamaCloudProvider],
  ["huggingface", huggingfaceProvider],
  ["nvidia", nvidiaProvider],
  ["ollama", ollamaProvider],
  ["lmstudio", lmstudioProvider],
  ["mlx", mlxProvider],
]);

// ─── Custom provider adapter ──────────────────────────────────────────────────

/**
 * Converts a stored CustomProvider config into a fully functional Provider
 * object that delegates API calls to the matching SDK (OpenAI-compat / Anthropic / Google).
 */
function customProviderToProvider(cp: CustomProvider): Provider {
  const config: ProviderConfig = {
    id: cp.id,
    name: cp.name,
    description: `Custom provider — ${cp.sdk} SDK`,
    category: "cloud",
    apiKeyEnvVar: "",
    apiKeyUrl: "",
    models: cp.models.map((m) => ({
      id: m.id,
      name: m.name,
      contextWindow: 128000,
      maxOutput: 8192,
    })),
    defaultModel: cp.models[0]?.id ?? "",
    supportsStreaming: true,
    supportsToolUse: cp.sdk !== "google",
    supportsVision: false,
  };

  // We borrow the SDK implementation from the matching built-in provider,
  // but override config (id, name, baseUrl, apiKey) at request time.
  let baseProvider: Provider;
  if (cp.sdk === "anthropic") {
    baseProvider = anthropicProvider;
  } else if (cp.sdk === "google") {
    baseProvider = geminiProvider;
  } else {
    // openai-compatible (default)
    baseProvider = openaiProvider;
  }

  return {
    config,
    validateApiKey: async (key: string) => baseProvider.validateApiKey(key),
    stream: (messages, tools, options) =>
      baseProvider.stream(messages, tools, {
        ...options,
        baseUrl: options.baseUrl || cp.baseUrl,
        apiKey: options.apiKey || cp.apiKey,
      }),
    complete: (messages, tools, options) =>
      baseProvider.complete(messages, tools, {
        ...options,
        baseUrl: options.baseUrl || cp.baseUrl,
        apiKey: options.apiKey || cp.apiKey,
      }),
  };
}

// ─── Provider registry ────────────────────────────────────────────────────────

export function getProvider(id: string): Provider | undefined {
  // Check static providers first
  if (providers.has(id)) return providers.get(id);
  // Then check custom providers from config
  const customs = getCustomProviders();
  const custom = customs.find((c) => c.id === id);
  if (custom) return customProviderToProvider(custom);
  return undefined;
}

export function getAllProviders(): Provider[] {
  const staticList = Array.from(providers.values());
  const customList = getCustomProviders().map(customProviderToProvider);
  return [...staticList, ...customList];
}

export function searchProviders(query: string): Provider[] {
  const q = query.toLowerCase();
  return getAllProviders().filter(
    (p) =>
      p.config.id.includes(q) ||
      p.config.name.toLowerCase().includes(q) ||
      p.config.description.toLowerCase().includes(q) ||
      p.config.models.some(
        (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
      )
  );
}

export function searchModels(query: string): Array<{ provider: ProviderConfig; model: { id: string; name: string } }> {
  const q = query.toLowerCase();
  const results: Array<{ provider: ProviderConfig; model: { id: string; name: string } }> = [];

  for (const provider of getAllProviders()) {
    for (const model of provider.config.models) {
      if (
        model.id.toLowerCase().includes(q) ||
        model.name.toLowerCase().includes(q) ||
        provider.config.name.toLowerCase().includes(q)
      ) {
        results.push({ provider: provider.config, model });
      }
    }
  }

  return results;
}

export type { Provider, ProviderConfig } from "./types.js";
export type {
  ProviderMessage,
  ProviderTool,
  ProviderRequestOptions,
  ProviderResponse,
  StreamChunk,
  TokenUsage,
  ProviderToolCall,
} from "./types.js";

