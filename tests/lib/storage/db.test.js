import { describe, it, expect, beforeEach } from 'vitest'
import {
  hydrate, resetStorageForTests, setIdbAvailableForTests, isIdbAvailable,
  idbPut, idbGet, idbGetAll, idbDelete, idbPutKv, idbGetKv,
  idbGetAllByThread, idbDeleteThread,
} from '../../../src/lib/storage/db'

beforeEach(async () => {
  localStorage.clear()
  await resetStorageForTests()
})

describe('db: keyed object stores', () => {
  it('round-trips a record in a keyPath store', async () => {
    await idbPut('profiles', { id: 'p1', name: 'A' })
    expect(await idbGet('profiles', 'p1')).toEqual({ id: 'p1', name: 'A' })
  })

  it('lists all records in a store', async () => {
    await idbPut('profiles', { id: 'p1', name: 'A' })
    await idbPut('profiles', { id: 'p2', name: 'B' })
    const all = await idbGetAll('profiles')
    expect(all).toHaveLength(2)
  })

  it('deletes a record by key', async () => {
    await idbPut('profiles', { id: 'p1', name: 'A' })
    await idbDelete('profiles', 'p1')
    expect(await idbGet('profiles', 'p1')).toBeUndefined()
  })
})

describe('db: kv singletons', () => {
  it('round-trips a kv value', async () => {
    await idbPutKv('apiKey', { provider: 'claude', key: 'k' })
    expect(await idbGetKv('apiKey')).toEqual({ provider: 'claude', key: 'k' })
  })
})

describe('db: messages thread index', () => {
  it('reads messages for one thread in insertion order', async () => {
    await idbPut('messages', { id: 'm1', profileId: 'p1', tab: 'chat', seq: 0, role: 'user', content: 'a' })
    await idbPut('messages', { id: 'm2', profileId: 'p1', tab: 'chat', seq: 1, role: 'assistant', content: 'b' })
    await idbPut('messages', { id: 'm3', profileId: 'p1', tab: 'today', seq: 0, role: 'user', content: 'c' })
    const thread = await idbGetAllByThread('p1', 'chat')
    expect(thread.map(m => m.content)).toEqual(['a', 'b'])
  })

  it('deletes only the target thread', async () => {
    await idbPut('messages', { id: 'm1', profileId: 'p1', tab: 'chat', seq: 0, role: 'user', content: 'a' })
    await idbPut('messages', { id: 'm2', profileId: 'p1', tab: 'today', seq: 0, role: 'user', content: 'c' })
    await idbDeleteThread('p1', 'chat')
    expect(await idbGetAllByThread('p1', 'chat')).toHaveLength(0)
    expect(await idbGetAllByThread('p1', 'today')).toHaveLength(1)
  })
})

describe('db: hydrate + cache seeding from legacy localStorage', () => {
  it('seeds the profiles cache from legacy localStorage when IDB is empty', async () => {
    localStorage.setItem('astro:profiles', JSON.stringify([{ id: 'p1', name: 'Legacy' }]))
    const cache = await hydrate()
    expect(cache.profiles).toEqual([{ id: 'p1', name: 'Legacy' }])
  })

  it('prefers IndexedDB data over legacy localStorage', async () => {
    localStorage.setItem('astro:profiles', JSON.stringify([{ id: 'old', name: 'Legacy' }]))
    await idbPut('profiles', { id: 'new', name: 'FromIDB' })
    const cache = await hydrate()
    expect(cache.profiles).toEqual([{ id: 'new', name: 'FromIDB' }])
  })
})

describe('db: availability', () => {
  it('reports IDB available with fake-indexeddb', () => {
    expect(isIdbAvailable()).toBe(true)
  })

  it('degraded mode: idb ops become no-ops/empty when forced unavailable', async () => {
    setIdbAvailableForTests(false)
    await idbPut('profiles', { id: 'p1', name: 'A' })
    expect(await idbGetAll('profiles')).toEqual([])
    expect(isIdbAvailable()).toBe(false)
  })
})
