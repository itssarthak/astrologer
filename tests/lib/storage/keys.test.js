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
})
