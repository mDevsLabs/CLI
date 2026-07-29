/**
 * Empirical evaluation test suite - Challenger 1
 * Milestones M1, M2, M3, M4, M5
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { isAuthenticated, getAuthTokenSource } from '../auth.js'
import {
  getAPIProvider,
  isFirstPartyAnthropicBaseUrl,
} from '../model/providers.js'

// ── 1. Authentication (M3) ───────────────────────────────────────────────

describe('Challenger 1 — Authentication & AuthTokenSource (M3)', () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    delete process.env.MAI_TOKEN
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN
    delete process.env.ANTHROPIC_AUTH_TOKEN
    delete process.env.CLAUDE_CODE_USE_BEDROCK
    delete process.env.CLAUDE_CODE_USE_VERTEX
    delete process.env.CLAUDE_CODE_USE_FOUNDRY
    delete process.env.CLAUDE_CODE_USE_OPENAI
    delete process.env.CLAUDE_CODE_USE_GEMINI
    delete process.env.CLAUDE_CODE_USE_GROK
    delete process.env.OPENAI_BASE_URL
    delete process.env.GEMINI_BASE_URL
  })

  afterEach(() => {
    process.env = { ...envBackup }
  })

  test('isAuthenticated() returns false without any token or key', () => {
    process.env.MAI_TOKEN = ''
    expect(isAuthenticated()).toBe(false)
  })

  test('isAuthenticated() returns true when MAI_TOKEN is present', () => {
    process.env.MAI_TOKEN = 'mai_token_valide_123'
    expect(isAuthenticated()).toBe(true)
  })

  test('isAuthenticated() returns true when ANTHROPIC_API_KEY is present', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-validkey'
    expect(isAuthenticated()).toBe(true)
  })

  test('isAuthenticated() returns true when CLAUDE_CODE_OAUTH_TOKEN is present', () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'oauth_token_valide'
    expect(isAuthenticated()).toBe(true)
  })

  test('isAuthenticated() returns false if MAI_TOKEN is an empty string', () => {
    process.env.MAI_TOKEN = ''
    expect(isAuthenticated()).toBe(false)
  })

  test('getAuthTokenSource() respects environment variable priority', () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'oauth_val'
    const res = getAuthTokenSource()
    expect(res.hasToken).toBe(true)
    expect(res.source).toBe('CLAUDE_CODE_OAUTH_TOKEN')
  })
})

// ── 2. Model & Provider Resolution (M4) ─────────────────────────

describe('Challenger 1 — Model Resolution mAI & API Providers (M4)', () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    delete process.env.CLAUDE_CODE_USE_BEDROCK
    delete process.env.CLAUDE_CODE_USE_VERTEX
    delete process.env.CLAUDE_CODE_USE_FOUNDRY
    delete process.env.CLAUDE_CODE_USE_OPENAI
    delete process.env.CLAUDE_CODE_USE_GEMINI
    delete process.env.CLAUDE_CODE_USE_GROK
    delete process.env.ANTHROPIC_BASE_URL
    delete process.env.USER_TYPE
  })

  afterEach(() => {
    process.env = { ...envBackup }
  })

  test('getAPIProvider() returns firstParty by default', () => {
    expect(getAPIProvider({})).toBe('firstParty')
  })

  test('modelType has priority over environment variables', () => {
    process.env.CLAUDE_CODE_USE_BEDROCK = '1'
    expect(getAPIProvider({ modelType: 'openai' })).toBe('openai')
    expect(getAPIProvider({ modelType: 'gemini' })).toBe('gemini')
    expect(getAPIProvider({ modelType: 'grok' })).toBe('grok')
  })

  test('Priority order between 3P providers (Bedrock > Vertex > Foundry > OpenAI > Gemini > Grok)', () => {
    process.env.CLAUDE_CODE_USE_GROK = '1'
    expect(getAPIProvider({})).toBe('grok')

    process.env.CLAUDE_CODE_USE_GEMINI = '1'
    expect(getAPIProvider({})).toBe('gemini')

    process.env.CLAUDE_CODE_USE_OPENAI = '1'
    expect(getAPIProvider({})).toBe('openai')

    process.env.CLAUDE_CODE_USE_FOUNDRY = '1'
    expect(getAPIProvider({})).toBe('foundry')

    process.env.CLAUDE_CODE_USE_VERTEX = '1'
    expect(getAPIProvider({})).toBe('vertex')

    process.env.CLAUDE_CODE_USE_BEDROCK = '1'
    expect(getAPIProvider({})).toBe('bedrock')
  })

  test('isFirstPartyAnthropicBaseUrl() validates official URLs', () => {
    delete process.env.ANTHROPIC_BASE_URL
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true)

    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com'
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true)

    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1'
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true)
  })

  test('isFirstPartyAnthropicBaseUrl() rejects subdomain spoofing', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com.attacker.com'
    expect(isFirstPartyAnthropicBaseUrl()).toBe(false)
  })

  test('isFirstPartyAnthropicBaseUrl() rejects unofficial third party servers', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://custom-proxy.internal.net'
    expect(isFirstPartyAnthropicBaseUrl()).toBe(false)
  })
})

// ── 3. Token Calculations & /usage Gauges (M5) ────────────────────────────

function calculateUsage(tokensUsed: number, limit: number) {
  const percent =
    limit > 0
      ? Math.min(100, Math.max(0, Math.round((tokensUsed / limit) * 100)))
      : 0
  const barWidth = 30
  const filled = Math.min(
    barWidth,
    Math.max(0, Math.round((percent / 100) * barWidth)),
  )
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled)
  return { percent, filled, bar }
}

function parseResetTime(
  resetAt: string | null | undefined,
  nowMs: number = Date.now(),
) {
  if (!resetAt) return 'Unknown'
  const resetDate = new Date(resetAt)
  if (Number.isNaN(resetDate.getTime())) return 'Now'
  const diff = resetDate.getTime() - nowMs
  if (diff > 0) {
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    return `${days} days, ${hours} hours`
  }
  return 'Now'
}

describe('Challenger 1 — Token /usage calculations & Reset Date Formatting (M5)', () => {
  test('Standard percentage calculation (2500 / 10000 = 25%)', () => {
    const res = calculateUsage(2500, 10000)
    expect(res.percent).toBe(25)
    expect(res.filled).toBe(8)
    expect(res.bar.length).toBe(30)
  })

  test('Division by zero protection (limit = 0)', () => {
    const res = calculateUsage(500, 0)
    expect(res.percent).toBe(0)
    expect(res.filled).toBe(0)
    expect(Number.isNaN(res.percent)).toBe(false)
  })

  test('Limit overflow (tokensUsed > limit)', () => {
    const res = calculateUsage(15000, 10000)
    expect(res.percent).toBe(100)
    expect(res.filled).toBe(30)
  })

  test('Negative values bounded to 0%', () => {
    const res = calculateUsage(-100, 1000)
    expect(res.percent).toBe(0)
    expect(res.filled).toBe(0)
  })

  test('Formatting valid reset date in the future', () => {
    const now = 1700000000000
    const future = new Date(now + 2 * 86400000 + 5 * 3600000).toISOString()
    const result = parseResetTime(future, now)
    expect(result).toBe('2 days, 5 hours')
  })

  test('Formatting past or invalid date', () => {
    const now = 1700000000000
    const past = new Date(now - 1000).toISOString()
    expect(parseResetTime(past, now)).toBe('Now')
    expect(parseResetTime('invalid-date-string', now)).toBe('Now')
    expect(parseResetTime(null, now)).toBe('Unknown')
    expect(parseResetTime(undefined, now)).toBe('Unknown')
  })
})
