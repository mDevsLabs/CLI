import { openaiProvider } from "./openai.js";
import type {
  Provider,
  ProviderConfig,
  ProviderMessage,
  ProviderTool,
  ProviderRequestOptions,
  ProviderResponse,
  StreamChunk,
} from "./types.js";

const DEFAULT_BASE = "http://localhost:8080/v1";

import models from "./aiModels/mlx.json";

const config: ProviderConfig = {
  id: "mlx",
  name: "MLX (Apple Silicon)",
  description: "Run models locally via Apple MLX — native, fast, bypasses Ollama M5 issues",
  category: "local",
  apiKeyEnvVar: "MLX_HOST",
  apiKeyUrl: "https://github.com/ml-explore/mlx-lm",
  models,
  defaultModel: "mlx-community/gemma-4-e4b-it-4bit",
  supportsStreaming: true,
  supportsToolUse: false,
  supportsVision: false,
};

function normalizeOptions(options: ProviderRequestOptions): ProviderRequestOptions {
  return {
    ...options,
    baseUrl: options.baseUrl || options.apiKey || DEFAULT_BASE,
    apiKey: "mlx",
  };
}

async function* streamRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): AsyncGenerator<StreamChunk> {
  yield* openaiProvider.stream(messages, tools, normalizeOptions(options));
}

async function completeRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): Promise<ProviderResponse> {
  return openaiProvider.complete(messages, tools, normalizeOptions(options));
}

async function validateApiKey(host: string): Promise<boolean> {
  try {
    const baseUrl = host && host.startsWith("http") ? host : DEFAULT_BASE;
    const res = await fetch(`${baseUrl.replace(/\/v1$/, "")}/v1/models`);
    return res.ok;
  } catch {
    return false;
  }
}

export const mlxProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
