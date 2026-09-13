import { logForDebugging } from '../../utils/debug.js'

export type QuotaCheckResult = {
  allowed: boolean
  error?: string
  data?: {
    tokensUsed: number
    limit: number
    tier: string
    resetAt?: string
  }
}

const QUOTA_CHECK_TIMEOUT_MS = 5_000
// Cache the last successful check so repeated calls within the same turn
// (prompt submit + query loop round trips) don't hit /usage on every message.
const QUOTA_CACHE_TTL_MS = 30_000

let quotaCache: { result: QuotaCheckResult; expiresAt: number } | null = null

/** True when the mAI backend is the active provider (quota is mAI-specific). */
function hasMaiCredentials(): boolean {
  return Boolean(
    process.env.MAI_API_KEY || process.env.MAI_TOKEN || process.env.OPENAI_API_KEY,
  )
}

/**
 * Checks the user's remaining token quota on /usage before sending a message.
 * Always sends the JWT in the Authorization and x-mai-token headers.
 *
 * Fails open: transient backend errors (timeouts, 5xx, network hiccups) never
 * block messages — only an explicit over-quota payload or invalid credentials
 * (401/403) do.
 */
export async function checkQuotaUsage(): Promise<QuotaCheckResult> {
  if (!hasMaiCredentials()) {
    // No mAI credentials: the quota endpoint doesn't apply to this auth path
    // (Anthropic API key, Bedrock, Vertex, OAuth, ...). Let the model call
    // surface its own auth error if credentials are genuinely missing.
    return { allowed: true }
  }

  if (quotaCache && Date.now() < quotaCache.expiresAt) {
    return quotaCache.result
  }

  const token =
    process.env.MAI_API_KEY || process.env.OPENAI_API_KEY || process.env.MAI_TOKEN
  if (!token) {
    // Unreachable when hasMaiCredentials() passed — kept for type narrowing.
    return { allowed: true }
  }
  let effectiveToken = token

  const rawBaseUrl = process.env.OPENAI_BASE_URL || 'https://mai.val.run'
  const baseUrl = rawBaseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')

  // If we only hold a JWT (or the mprojects_api_keys mp-... key hasn't been
  // resolved yet), try to fetch it.
  if (
    process.env.MAI_TOKEN &&
    (!process.env.MAI_API_KEY || process.env.MAI_API_KEY.startsWith('eyJ'))
  ) {
    try {
      const keyRes = await fetch(`${baseUrl}/api-keys`, {
        headers: { Authorization: `Bearer ${process.env.MAI_TOKEN}` },
        signal: AbortSignal.timeout(QUOTA_CHECK_TIMEOUT_MS),
      })
      if (keyRes.ok) {
        const keyJson = (await keyRes.json()) as { keys?: { api_key: string }[] }
        if (keyJson.keys && keyJson.keys.length > 0 && keyJson.keys[0]?.api_key) {
          const resolvedKey = keyJson.keys[0].api_key
          process.env.MAI_API_KEY = resolvedKey
          process.env.OPENAI_API_KEY = resolvedKey
          effectiveToken = resolvedKey
        }
      }
    } catch {
      // Ignore and keep using the existing token
    }
  }

  try {
    let res = await fetch(`${baseUrl}/v1/usage`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
        'x-mai-token': effectiveToken,
        'x-api-key': effectiveToken,
      },
      signal: AbortSignal.timeout(QUOTA_CHECK_TIMEOUT_MS),
    })

    if (res.status === 404) {
      // Fall back to /usage when /v1/usage isn't deployed yet
      res = await fetch(`${baseUrl}/usage`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
          'x-mai-token': effectiveToken,
          'x-api-key': effectiveToken,
        },
        signal: AbortSignal.timeout(QUOTA_CHECK_TIMEOUT_MS),
      })
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          allowed: false,
          error: 'Session expired or invalid API key. Please log in again with /login.',
        }
      }
      // Transient backend failure (5xx, rate limiting on the usage endpoint,
      // ...) — fail open instead of blocking every message.
      logForDebugging(`[QuotaCheck] Usage endpoint returned ${res.status}; failing open`)
      return { allowed: true }
    }

    const data = (await res.json()) as {
      limit?: number | string
      tokensUsed?: number | string
      tier?: string
      resetAt?: string
      error?: string
    }

    if (data.error) {
      logForDebugging(`[QuotaCheck] Usage endpoint reported an error; failing open: ${data.error}`)
      return { allowed: true }
    }

    const limit =
      typeof data.limit === 'number' ? data.limit : Number(data.limit) || 0
    const tokensUsed =
      typeof data.tokensUsed === 'number'
        ? data.tokensUsed
        : Number(data.tokensUsed) || 0

    if (limit > 0 && tokensUsed >= limit) {
      const resetMsg = data.resetAt
        ? ` (Reset date: ${new Date(data.resetAt).toLocaleString()})`
        : ''
      return {
        allowed: false,
        error: `mAI token quota reached: ${tokensUsed.toLocaleString()} / ${limit.toLocaleString()} tokens consumed [Plan ${data.tier || 'Free'}].${resetMsg}\nPlease upgrade your plan with /usage.`,
        data: {
          tokensUsed,
          limit,
          tier: data.tier || 'Free',
          resetAt: data.resetAt,
        },
      }
    }

    logForDebugging(
      `[QuotaCheck] Quota OK: ${tokensUsed}/${limit} tokens (Plan ${data.tier || 'Free'})`,
    )

    const result: QuotaCheckResult = {
      allowed: true,
      data: {
        tokensUsed,
        limit,
        tier: data.tier || 'Free',
        resetAt: data.resetAt,
      },
    }
    quotaCache = { result, expiresAt: Date.now() + QUOTA_CACHE_TTL_MS }
    return result
  } catch (err: unknown) {
    // Network error / timeout — fail open so a flaky connection to the usage
    // endpoint never blocks the actual model call.
    const msg = err instanceof Error ? err.message : String(err)
    logForDebugging(`[QuotaCheck] Could not reach ${baseUrl}/usage (${msg}); failing open`)
    return { allowed: true }
  }
}
