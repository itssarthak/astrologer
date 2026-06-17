import { describe, it, expect, beforeEach } from 'vitest'
import { getApiKey, saveApiKey, clearApiKey, subscribeApiKey } from '../../../src/lib/storage/keys'
import { cache, hydrate, resetStorageForTests } from '../../../src/lib/storage/db'

beforeEach(async () => {
  localStorage.clear()
  await resetStorageForTests()
})

describe('keys storage (cache-backed)', () => {
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

  it('persists baseUrl and model for the custom provider', () => {
    saveApiKey({ provider: 'custom', key: 'k', baseUrl: 'https://x/v1', model: 'm' })
    expect(getApiKey()).toEqual({ provider: 'custom', key: 'k', baseUrl: 'https://x/v1', model: 'm' })
  })

  it('notifies subscribers when the key changes', () => {
    let calls = 0
    const unsub = subscribeApiKey(() => { calls++ })
    saveApiKey({ provider: 'claude', key: 'k' })
    clearApiKey()
    unsub()
    saveApiKey({ provider: 'claude', key: 'again' })
    expect(calls).toBe(2)
  })

  it('hydrate does not throw on malformed legacy JSON and yields null', async () => {
    localStorage.setItem('astro:apiKey', '{not valid json')
    cache.apiKey = null
    await expect(hydrate()).resolves.toBeTruthy()
    expect(getApiKey()).toBeNull()
  })

  it('writes through to IndexedDB (survives a cache wipe + reload from IDB)', async () => {
    await saveApiKey({ provider: 'claude', key: 'persisted' })
    localStorage.clear()
    cache.apiKey = null
    await hydrate()
    expect(getApiKey()).toEqual({ provider: 'claude', key: 'persisted' })
  })
})
