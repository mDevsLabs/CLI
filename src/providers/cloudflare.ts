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

import models from "./aiModels/cloudflare.json";

const config: ProviderConfig = {
  id: "cloudflare",
  name: "Cloudflare Workers AI",
  description: "Workers AI — edge inference (Llama, Kimi, Qwen, and more)",
  category: "cloud",
  apiKeyEnvVar: "CLOUDFLARE_API_TOKEN",
  apiKeyUrl: "https://dash.cloudflare.com/profile/api-tokens (format: ACCOUNT_ID:API_TOKEN)",
  models,
  defaultModel: "@cf/moonshotai/kimi-k2.6",
  supportsStreaming: true,
  supportsToolUse: true,
  supportsVision: false,
};

/**
 * Resolve OpenAI-compatible base URL + token.
 * API key may be plain token (with CLOUDFLARE_ACCOUNT_ID / baseUrl) or `ACCOUNT_ID:API_TOKEN`.
 */
function resolveAuth(options: ProviderRequestOptions): { baseUrl: string; apiKey: string } {
  let apiKey = options.apiKey;
  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";

  const colon = apiKey.indexOf(":");
  if (colon > 0) {
    const maybeAccount = apiKey.slice(0, colon);
    if (/^[a-f0-9]{32}$/i.test(maybeAccount)) {
      accountId = maybeAccount;
      apiKey = apiKey.slice(colon + 1);
    }
  }

  if (options.baseUrl) {
    return { baseUrl: options.baseUrl.replace(/\/$/, ""), apiKey };
  }

  if (!accountId) {
    throw new Error(
      "Cloudflare Workers AI requires an account ID. Set API key as ACCOUNT_ID:API_TOKEN, or set CLOUDFLARE_ACCOUNT_ID / baseUrl."
    );
  }

  return {
    baseUrl: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
    apiKey,
  };
}

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
  let auth: { baseUrl: string; apiKey: string };
  try {
    auth = resolveAuth(options);
  } catch (e) {
    yield { type: "error", error: e instanceof Error ? e.message : String(e) };
    return;
  }

  const body = buildRequestBody(messages, tools, options);
  body.stream = true;

  const response = await fetch(`${auth.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    yield { type: "error", error: `Cloudflare Workers AI error ${response.status}: ${err}` };
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
  const auth = resolveAuth(options);
  const body = buildRequestBody(messages, tools, options);

  const response = await fetch(`${auth.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cloudflare Workers AI error ${response.status}: ${err}`);
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
    const auth = resolveAuth({ model: "", apiKey });
    const res = await fetch(`${auth.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${auth.apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const cloudflareProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
