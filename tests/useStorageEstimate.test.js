import { describe, it, expect } from 'vitest'
import { readStorageEstimate } from '../src/hooks/useStorageEstimate'

describe('readStorageEstimate', () => {
  it('computes a percentage from navigator.storage.estimate', async () => {
    const nav = { storage: { estimate: async () => ({ usage: 90, quota: 100 }) } }
    const result = await readStorageEstimate({ nav })
    expect(result).toEqual({ usage: 90, quota: 100, percent: 90 })
  })

  it('rounds the percentage', async () => {
    const nav = { storage: { estimate: async () => ({ usage: 925, quota: 1000 }) } }
    expect((await readStorageEstimate({ nav })).percent).toBe(93)
  })

  it('falls back to measuring localStorage against a ~5MB cap when the API is missing', async () => {
    const nav = {} // no storage.estimate
    const result = await readStorageEstimate({ nav, measureLocalBytes: () => 5 * 1024 * 1024 / 2 })
    expect(result.percent).toBe(50)
    expect(result.quota).toBe(5 * 1024 * 1024)
  })

  it('returns null when nothing is measurable', async () => {
    const result = await readStorageEstimate({ nav: {}, measureLocalBytes: () => null })
    expect(result).toBeNull()
  })

  it('returns null when quota is zero (avoids divide-by-zero)', async () => {
    const nav = { storage: { estimate: async () => ({ usage: 0, quota: 0 }) } }
    const result = await readStorageEstimate({ nav, measureLocalBytes: () => null })
    expect(result).toBeNull()
  })
})
