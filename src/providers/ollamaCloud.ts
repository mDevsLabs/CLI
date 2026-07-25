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
import models from "./aiModels/ollamaCloud.json";

const config: ProviderConfig = {
  id: "ollama-cloud",
  name: "Ollama Cloud",
  description: "Ollama Cloud API — Llama 3.3, DeepSeek R1, Qwen",
  category: "cloud",
  apiKeyEnvVar: "OLLAMA_API_KEY",
  apiKeyUrl: "https://ollama.com/account/keys",
  models,
  defaultModel: "llama3.3:70b",
  supportsStreaming: true,
  supportsToolUse: true,
  supportsVision: false,
};

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

  const baseUrl = (options.baseUrl || "https://ollama.com/api").replace(/\/$/, "");
  const endpoint = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.apiKey) {
    headers["Authorization"] = `Bearer ${options.apiKey}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    yield { type: "error", error: `Ollama Cloud API error ${response.status}: ${err}` };
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
      
      const payloadStr = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;

      try {
        const data = JSON.parse(payloadStr);
        const choice = data.choices?.[0] || data;
        const delta = choice.delta || choice.message;

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
}

async function completeRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): Promise<ProviderResponse> {
  const body = buildRequestBody(messages, tools, options);
  const baseUrl = (options.baseUrl || "https://ollama.com/api").replace(/\/$/, "");
  const endpoint = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.apiKey) {
    headers["Authorization"] = `Bearer ${options.apiKey}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama Cloud API error ${response.status}: ${err}`);
  }

  const data = await response.json() as Record<string, any>;
  const choice = data.choices?.[0] || data;
  const toolCalls: ProviderToolCall[] = (choice.message?.tool_calls || []).map(
    (tc: any) => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.function.name, arguments: tc.function.arguments },
    })
  );

  return {
    content: choice.message?.content || "",
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
    const res = await fetch("https://ollama.com/api/tags", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok || res.status === 401;
  } catch {
    return false;
  }
}

export const ollamaCloudProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
