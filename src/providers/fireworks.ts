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

import models from "./aiModels/fireworks.json";

const config: ProviderConfig = {
  id: "fireworks",
  name: "Fireworks AI",
  description: "Fast inference — Llama, DeepSeek, Qwen, and more",
  category: "cloud",
  apiKeyEnvVar: "FIREWORKS_API_KEY",
  apiKeyUrl: "https://fireworks.ai/account/api-keys",
  models: models as ProviderConfig["models"],
  defaultModel: (models as ProviderConfig["models"])[0]?.id ?? "",
  supportsStreaming: true,
  supportsToolUse: true,
  supportsVision: false,
};

const DEFAULT_BASE = "https://api.fireworks.ai/inference/v1";

function buildRequestBody(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
) {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.systemPrompt
      ? [{ role: "system", content: options.systemPrompt }, ...messages]
      : messages,
    stream: false,
  };

  if (tools.length > 0) body.tools = tools;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens) body.max_tokens = options.maxTokens;

  return body;
}

async function* streamRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): AsyncGenerator<StreamChunk> {
  const body = buildRequestBody(messages, tools, options);
  body.stream = true;

  const baseUrl = (options.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    yield { type: "error", error: `Fireworks AI error ${response.status}: ${err}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";
  const toolCallBuffers: Map<number, { id: string; name: string; args: string }> = new Map();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const data = JSON.parse(trimmed.slice(6));
        const choice = data.choices?.[0];
        if (!choice) {
          if (data.usage) {
            yield {
              type: "done",
              usage: {
                inputTokens: data.usage.prompt_tokens || 0,
                outputTokens: data.usage.completion_tokens || 0,
              },
            };
          }
          continue;
        }

        if (choice.delta?.content) {
          yield { type: "text", text: choice.delta.content };
        }

        if (choice.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
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
              if (buf) buf.args += tc.function.arguments;
            }
          }
        }

        if (choice.finish_reason) {
          for (const [, buf] of toolCallBuffers) {
            yield {
              type: "tool_call_end",
              toolCall: { id: buf.id, name: buf.name, arguments: buf.args },
            };
          }
        }

        if (data.usage) {
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
  }
}

async function completeRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): Promise<ProviderResponse> {
  const body = buildRequestBody(messages, tools, options);
  const baseUrl = (options.baseUrl || DEFAULT_BASE).replace(/\/$/, "");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Fireworks AI error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as Record<string, any>;
  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error("No response from API");
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
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    },
    stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
  };
}

async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${DEFAULT_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const fireworksProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
