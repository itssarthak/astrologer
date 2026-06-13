import { describe, it, expect, beforeEach } from 'vitest'
import { getApiKey, saveApiKey, clearApiKey } from '../../../src/lib/storage/keys'

beforeEach(() => localStorage.clear())

describe('keys storage', () => {
  it('returns null when no key is stored', () => {
    expect(getApiKey()).toBeNull()
  })

  it('saves and retrieves provider + key', () => {
    saveApiKey({ provider: 'claude', key: 'sk-ant-test' })
    expect(getApiKey()).toEqual({ provider: 'claude', key: 'sk-ant-test' })
  })

  it('clears the stored key', () => {
    saveApiKey({ provider: 'claude', key: 'sk-ant-test' })
    clearApiKey()
    expect(getApiKey()).toBeNull()
  })

  it('returns null (does not throw) when the stored value is malformed JSON', () => {
    localStorage.setItem('astro:apiKey', '{not valid json')
    expect(() => getApiKey()).not.toThrow()
    expect(getApiKey()).toBeNull()
  })

  it('persists baseUrl and model for the custom provider', () => {
    saveApiKey({ provider: 'custom', key: 'k', baseUrl: 'https://x/v1', model: 'm' })
    expect(getApiKey()).toEqual({ provider: 'custom', key: 'k', baseUrl: 'https://x/v1', model: 'm' })
  })
})
