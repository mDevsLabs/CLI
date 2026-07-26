import type {
  Provider,
  ProviderConfig,
  ProviderMessage,
  ProviderTool,
  ProviderRequestOptions,
  ProviderResponse,
  StreamChunk,
  ProviderToolCall,
} from "./types.js";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { loadAuthState, addTokens } from "../services/authStore.js";

import models from "./aiModels/mai.json";

export function checkAndAddMaiUsage(tokensToAdd = 0): number {
  return addTokens(tokensToAdd);
}

const config: ProviderConfig = {
  id: "mai",
  name: "mAI (Recommandé)",
  description: "Provider gratuit via proxy Val.town pour mAI CLI",
  category: "cloud",
  apiKeyEnvVar: "",
  apiKeyUrl: "",
  get models() {
    const state = loadAuthState();
    if (!state.email || state.tier === "Free") {
      return models.filter((m: any) => m.id.endsWith(":free"));
    }
    return models;
  },
  defaultModel: "poolside/laguna-xs-2.1:free",
  supportsStreaming: true,
  supportsToolUse: true,
  supportsVision: false,
};

async function* streamRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): AsyncGenerator<StreamChunk> {
  // Vérifier la limite avant de lancer la requête
  try {
    checkAndAddMaiUsage(0);
  } catch (e: any) {
    yield { type: "error", error: e.message };
    return;
  }

  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.systemPrompt
      ? [{ role: "system", content: options.systemPrompt }, ...messages]
      : messages,
    stream: true,
  };

  if (tools.length > 0) body.tools = tools;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens) body.max_tokens = options.maxTokens;

  const response = await fetch("https://mai.val.run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/mDevsLabs/mAI-CLI",
      "X-Title": "mAI CLI",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    yield { type: "error", error: `mAI API error ${response.status}: ${err}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";
  let fullResponseForFallback = "";
  const toolCallBuffers: Map<number, { id: string; name: string; args: string }> = new Map();
  let totalUsageTokens = 0;
  let receivedAnyValidChunk = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunkStr = decoder.decode(value, { stream: true });
    buffer += chunkStr;
    fullResponseForFallback += chunkStr;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (trimmed.startsWith(":")) continue; // Skip keep-alives like : OPENROUTER PROCESSING

      // Catch proxy returning 200 OK but with a JSON error object instead of SSE
      if (!receivedAnyValidChunk && trimmed.startsWith("{") && trimmed.includes('"error"')) {
        try {
          const errData = JSON.parse(trimmed);
          if (errData.error) {
            const errMsg = typeof errData.error === "string" ? errData.error : JSON.stringify(errData.error);
            yield { type: "error", error: `API Error: ${errMsg}` };
            return;
          }
        } catch {}
      }

      if (!trimmed.startsWith("data: ")) continue;

      try {
        const data = JSON.parse(trimmed.slice(6));
        receivedAnyValidChunk = true;
        const choice = data.choices?.[0];
        
        if (data.usage) {
          const usageSum = (data.usage.prompt_tokens || 0) + (data.usage.completion_tokens || 0);
          totalUsageTokens = usageSum;
          yield {
            type: "done",
            usage: {
              inputTokens: data.usage.prompt_tokens || 0,
              outputTokens: data.usage.completion_tokens || 0,
            },
          };
        }

        if (!choice) continue;

        const delta = choice.delta;
        if (delta?.content) {
          yield { type: "text", text: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (tc.id) {
              toolCallBuffers.set(idx, { id: tc.id, name: tc.function?.name || "", args: "" });
              yield {
                type: "tool_call_start",
                toolCall: { id: tc.id, name: tc.function?.name || "", arguments: "" },
              };
            }
            if (tc.function?.arguments) {
              const buf = toolCallBuffers.get(idx);
              if (buf) {
                buf.args += tc.function.arguments;
                yield {
                  type: "tool_call_delta",
                  toolCall: { id: buf.id, name: buf.name, arguments: tc.function.arguments },
                };
              }
            }
          }
        }

        if (choice.finish_reason === "tool_calls" || choice.finish_reason === "stop") {
          for (const [, buf] of toolCallBuffers) {
            yield {
              type: "tool_call_end",
              toolCall: { id: buf.id, name: buf.name, arguments: buf.args },
            };
          }
        }
      } catch {}
    }
  }

  // If we never received any valid data chunks, maybe it was a non-SSE JSON response that didn't have \n
  if (!receivedAnyValidChunk && fullResponseForFallback.trim().startsWith("{")) {
    try {
      const data = JSON.parse(fullResponseForFallback);
      if (data.error) {
        const errMsg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
        yield { type: "error", error: `API Error: ${errMsg}` };
        return;
      }
      const choice = data.choices?.[0];
      if (choice?.message?.content) {
        yield { type: "text", text: choice.message.content };
      }
      
      if (data.usage) {
        const usageSum = (data.usage.prompt_tokens || 0) + (data.usage.completion_tokens || 0);
        totalUsageTokens = usageSum;
        yield {
          type: "done",
          usage: {
            inputTokens: data.usage.prompt_tokens || 0,
            outputTokens: data.usage.completion_tokens || 0,
          },
        };
      }
    } catch {}
  }

  if (totalUsageTokens > 0) {
    try { checkAndAddMaiUsage(totalUsageTokens); } catch {}
  }
}

async function completeRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): Promise<ProviderResponse> {
  // Vérifier la limite avant de lancer la requête
  checkAndAddMaiUsage(0);

  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.systemPrompt
      ? [{ role: "system", content: options.systemPrompt }, ...messages]
      : messages,
  };

  if (tools.length > 0) body.tools = tools;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens) body.max_tokens = options.maxTokens;

  const response = await fetch("https://mdevslabs--e54fec60883e11f1b8d71607ee4eb77e.web.val.run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/mDevsLabs/mAI-CLI",
      "X-Title": "mAI CLI",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`mAI API error ${response.status}: ${err}`);
  }

  const text = await response.text();
  let data: Record<string, any>;
  try {
    data = JSON.parse(text);
  } catch (e: any) {
    throw new Error(`Failed to parse mAI response: ${e.message}\nResponse: ${text.slice(0, 100)}`);
  }

  if (data.error) {
    const errMsg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    throw new Error(`mAI API Error: ${errMsg}`);
  }

  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error(`Format de réponse inattendu du proxy (pas de choices): ${text.slice(0, 200)}`);
  }

  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const totalTokens = inputTokens + outputTokens;

  // Enregistrement de la consommation
  if (totalTokens > 0) {
    try { checkAndAddMaiUsage(totalTokens); } catch {}
  }

  const toolCalls: ProviderToolCall[] = (choice.message.tool_calls || []).map(
    (tc: any) => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.function.name, arguments: tc.function.arguments },
    })
  );

  return {
    content: choice.message.content || "",
    toolCalls,
    usage: {
      inputTokens,
      outputTokens,
    },
    stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
  };
}

async function validateApiKey(apiKey: string): Promise<boolean> {
  return true; // No API key required for mAI
}

export const maiProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
