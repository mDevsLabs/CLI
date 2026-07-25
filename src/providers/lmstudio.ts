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

const DEFAULT_BASE = "http://localhost:1234/v1";

import models from "./aiModels/lmstudio.json";

const config: ProviderConfig = {
  id: "lmstudio",
  name: "LM Studio (Local)",
  description: "Run models locally via LM Studio — GGUF models, OpenAI-compatible",
  category: "local",
  apiKeyEnvVar: "LMSTUDIO_HOST",
  apiKeyUrl: "https://lmstudio.ai/download",
  models,
  defaultModel: "google/gemma-4-e4b",
  supportsStreaming: true,
  supportsToolUse: true,
  supportsVision: false,
};

function normalizeOptions(options: ProviderRequestOptions): ProviderRequestOptions {
  const model = options.model?.includes("@") ? options.model.split("@")[0] : options.model;
  return {
    ...options,
    model,
    baseUrl: options.baseUrl || options.apiKey || DEFAULT_BASE,
    apiKey: "lm-studio",
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

export const lmstudioProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
