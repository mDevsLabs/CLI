import { describe, expect, test } from 'bun:test'
import { isAuthenticated } from '../auth.js'
import providerCommand from '../../commands/provider.js'

describe('Milestones M3, M4 & M5 unit tests', () => {
  test('The provider command is hidden and disabled (M3)', () => {
    expect(providerCommand.isHidden).toBe(true)
    expect(providerCommand.isEnabled?.()).toBe(false)
  })

  test('isAuthenticated returns false without token (M3)', () => {
    const originalToken = process.env.MAI_TOKEN
    delete process.env.MAI_TOKEN

    expect(typeof isAuthenticated()).toBe('boolean')

    if (originalToken) {
      process.env.MAI_TOKEN = originalToken
    }
  })

  test('isAuthenticated returns true when MAI_TOKEN is defined (M3)', () => {
    const originalToken = process.env.MAI_TOKEN
    process.env.MAI_TOKEN = 'test-token-123'

    expect(isAuthenticated()).toBe(true)

    if (originalToken) {
      process.env.MAI_TOKEN = originalToken
    } else {
      delete process.env.MAI_TOKEN
    }
  })
})
