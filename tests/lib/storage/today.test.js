import { describe, it, expect, beforeEach } from 'vitest'
import { getTodayTransit, saveTodayTransit, todayStamp } from '../../../src/lib/storage/today'
import { cache, hydrate, resetStorageForTests } from '../../../src/lib/storage/db'

beforeEach(async () => {
  localStorage.clear()
  await resetStorageForTests()
})

describe('today transit cache (cache-backed)', () => {
  it('returns null when nothing is cached', () => {
    expect(getTodayTransit('p1')).toBeNull()
  })

  it('saves and retrieves today\'s transit', () => {
    saveTodayTransit('p1', { sun: 'Aries' })
    expect(getTodayTransit('p1')).toEqual({ sun: 'Aries' })
  })

  it('ignores a cached transit stamped for a different day', () => {
    cache.today.p1 = { profileId: 'p1', date: '2000-01-01', transit: { stale: true } }
    expect(getTodayTransit('p1')).toBeNull()
  })

  it('isolates transits per profile', () => {
    saveTodayTransit('p1', { v: 1 })
    saveTodayTransit('p2', { v: 2 })
    expect(getTodayTransit('p1')).toEqual({ v: 1 })
    expect(getTodayTransit('p2')).toEqual({ v: 2 })
  })

  it('writes through to IndexedDB (survives a cache wipe + reload from IDB)', async () => {
    await saveTodayTransit('p1', { sun: 'Leo' })
    localStorage.clear()
    cache.today = {}
    await hydrate()
    expect(getTodayTransit('p1')).toEqual({ sun: 'Leo' })
  })

  it('falls back to legacy localStorage when the cache misses', () => {
    cache.today = {}
    localStorage.setItem('astro:today:p1', JSON.stringify({ date: todayStamp(), transit: { legacy: true } }))
    expect(getTodayTransit('p1')).toEqual({ legacy: true })
  })
})
