import OpenAI from 'openai'
import { openaiAdapter } from 'src/services/providerUsage/adapters/openai.js'
import { updateProviderBuckets } from 'src/services/providerUsage/store.js'
import { getProxyFetchOptions } from 'src/utils/proxy.js'

/**
 * Environment variables:
 *
 * OPENAI_API_KEY: Required. API key for the OpenAI-compatible endpoint.
 * OPENAI_BASE_URL: Recommended. Base URL for the endpoint (e.g. http://localhost:11434/v1).
 * OPENAI_ORG_ID: Optional. Organization ID.
 * OPENAI_PROJECT_ID: Optional. Project ID.
 */

let cachedClient: OpenAI | null = null

/**
 * Wrap a fetch so that every response's rate-limit headers are fed into the
 * provider usage store. Errors in parsing must never break the request.
 *
 * The cast to `typeof fetch` is safe: OpenAI SDK only calls the function form,
 * not the static `preconnect` method that Bun/Node's `fetch` type declares.
 */
function wrapFetchForUsage(base: typeof fetch): typeof fetch {
  const wrapped = async (
    ...args: Parameters<typeof fetch>
  ): Promise<Response> => {
    const token =
      process.env.MAI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.MAI_TOKEN
    if (token && args.length > 0) {
      let init = args[1] as RequestInit | undefined
      if (!init) {
        init = {}
        args[1] = init
      }
      const headers = new Headers(init.headers)
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`)
      }
      if (!headers.has('x-mai-token')) {
        headers.set('x-mai-token', token)
      }
      if (!headers.has('x-api-key')) {
        headers.set('x-api-key', token)
      }
      init.headers = headers
    }
    const res = await base(...args)
    try {
      updateProviderBuckets('openai', openaiAdapter.parseHeaders(res.headers))
    } catch {
      // Ignore — usage tracking must not affect the request path.
    }
    return res
  }
  return wrapped as unknown as typeof fetch
}

export function getOpenAIClient(options?: {
  maxRetries?: number
  fetchOverride?: typeof fetch
  source?: string
}): OpenAI {
  if (cachedClient) return cachedClient

  const apiKey =
    process.env.MAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.MAI_TOKEN ||
    ''
  let baseURL = process.env.OPENAI_BASE_URL || 'https://mai.val.run/v1'
  if (baseURL) {
    baseURL = baseURL.replace(/\/+$/, '')
    if (baseURL === 'https://mai.val.run' || baseURL === 'https://mprojects.val.run' || baseURL === 'https://mprojects.val.run/v1') {
      baseURL = 'https://mai.val.run/v1'
    }
  }

  const baseFetch = options?.fetchOverride ?? (globalThis.fetch as typeof fetch)
  const wrappedFetch = wrapFetchForUsage(baseFetch)

  const client = new OpenAI({
    apiKey,
    ...(baseURL && { baseURL }),
    defaultHeaders: {
      ...(apiKey
        ? {
            Authorization: `Bearer ${apiKey}`,
            'x-mai-token': apiKey,
            'x-api-key': apiKey,
          }
        : {}),
    },
    maxRetries: options?.maxRetries ?? 0,
    timeout: parseInt(process.env.API_TIMEOUT_MS || String(600 * 1000), 10),
    dangerouslyAllowBrowser: true,
    ...(process.env.OPENAI_ORG_ID && {
      organization: process.env.OPENAI_ORG_ID,
    }),
    ...(process.env.OPENAI_PROJECT_ID && {
      project: process.env.OPENAI_PROJECT_ID,
    }),
    fetchOptions: getProxyFetchOptions({ forAnthropicAPI: false }),
    fetch: wrappedFetch,
  })

  if (!options?.fetchOverride) {
    cachedClient = client
  }

  return client
}

/** Clear the cached client (useful when env vars change). */
export function clearOpenAIClientCache(): void {
  cachedClient = null
}
