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

/**
 * Vérifie le quota de l'utilisateur sur /usage avant d'envoyer un message.
 * Envoie systématiquement le jeton JWT dans les en-têtes Authorization et x-mai-token.
 */
export async function checkQuotaUsage(): Promise<QuotaCheckResult> {
  let token = process.env.MAI_API_KEY || process.env.OPENAI_API_KEY || process.env.MAI_TOKEN
  if (!token) {
    return {
      allowed: false,
      error: 'Non authentifié. Veuillez vous connecter avec la commande /login.',
    }
  }

  const rawBaseUrl = process.env.OPENAI_BASE_URL || 'https://mai.val.run'
  const baseUrl = rawBaseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')

  // Si on n'a qu'un JWT ou pas encore de clé mprojects_api_keys (mp-...), tenter de la récupérer
  if (
    process.env.MAI_TOKEN &&
    (!process.env.MAI_API_KEY || process.env.MAI_API_KEY.startsWith('eyJ'))
  ) {
    try {
      const keyRes = await fetch(`${baseUrl}/api-keys`, {
        headers: { Authorization: `Bearer ${process.env.MAI_TOKEN}` },
      })
      if (keyRes.ok) {
        const keyJson = (await keyRes.json()) as { keys?: { api_key: string }[] }
        if (keyJson.keys && keyJson.keys.length > 0 && keyJson.keys[0]?.api_key) {
          const resolvedKey = keyJson.keys[0].api_key
          process.env.MAI_API_KEY = resolvedKey
          process.env.OPENAI_API_KEY = resolvedKey
          token = resolvedKey
        }
      }
    } catch {
      // Ignorer et continuer avec le token existant
    }
  }

  try {
    let res = await fetch(`${baseUrl}/v1/usage`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-mai-token': token,
        'x-api-key': token,
      },
    })

    if (res.status === 404) {
      // Fallback vers /usage si /v1/usage n'est pas encore déployé
      res = await fetch(`${baseUrl}/usage`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-mai-token': token,
          'x-api-key': token,
        },
      })
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          allowed: false,
          error: 'Session expirée ou clé API invalide. Veuillez vous reconnecter avec /login.',
        }
      }
      return {
        allowed: false,
        error: `Erreur lors de la vérification du quota sur ${baseUrl}/v1/usage (${res.status}).`,
      }
    }

    const data = (await res.json()) as {
      limit?: number | string
      tokensUsed?: number | string
      tier?: string
      resetAt?: string
      error?: string
    }

    if (data.error) {
      return {
        allowed: false,
        error: `Erreur quota : ${data.error}`,
      }
    }

    const limit =
      typeof data.limit === 'number' ? data.limit : Number(data.limit) || 0
    const tokensUsed =
      typeof data.tokensUsed === 'number'
        ? data.tokensUsed
        : Number(data.tokensUsed) || 0

    if (limit > 0 && tokensUsed >= limit) {
      const resetMsg = data.resetAt
        ? ` (Date de réinitialisation : ${new Date(data.resetAt).toLocaleString()})`
        : ''
      return {
        allowed: false,
        error: `Quota de tokens mAI atteint : ${tokensUsed.toLocaleString()} / ${limit.toLocaleString()} tokens consommés [Forfait ${data.tier || 'Free'}].${resetMsg}\nVeuillez mettre à niveau votre forfait avec /usage.`,
        data: {
          tokensUsed,
          limit,
          tier: data.tier || 'Free',
          resetAt: data.resetAt,
        },
      }
    }

    logForDebugging(
      `[QuotaCheck] Quota OK : ${tokensUsed}/${limit} tokens (Forfait ${data.tier || 'Free'})`,
    )

    return {
      allowed: true,
      data: {
        tokensUsed,
        limit,
        tier: data.tier || 'Free',
        resetAt: data.resetAt,
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logForDebugging(`[QuotaCheck] Erreur d'accès à ${baseUrl}/usage: ${msg}`)
    return {
      allowed: false,
      error: `Impossible de vérifier le quota sur ${baseUrl}/usage : ${msg}`,
    }
  }
}
