import { describe, it, expect, vi } from 'vitest'
import { isProfileStale, recomputeProfile } from '../../src/lib/migrateProfile'
import { CHART_ENGINE_VERSION } from '../../src/lib/version'

describe('isProfileStale', () => {
  it('treats a profile with no engineVersion as stale', () => {
    expect(isProfileStale({ id: '1' })).toBe(true)
  })

  it('treats a profile stamped with an older engineVersion as stale', () => {
    expect(isProfileStale({ id: '1', engineVersion: CHART_ENGINE_VERSION - 1 })).toBe(true)
  })

  it('treats a profile stamped with the current engineVersion as fresh', () => {
    expect(isProfileStale({ id: '1', engineVersion: CHART_ENGINE_VERSION })).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(isProfileStale(null)).toBe(false)
    expect(isProfileStale(undefined)).toBe(false)
  })
})

describe('recomputeProfile', () => {
  const profile = {
    id: 'abc',
    name: 'Ada',
    dob: '1990-01-15',
    time: '12:30',
    gender: 'female',
    place: 'London',
    lat: 51.5,
    lon: -0.12,
    timezone_offset: 0,
    chart: { old: true },
    yogas: ['stale'],
    doshas: { stale: { present: true } },
    numerology: { old: true },
    createdAt: 123,
  }

  function makeCompute() {
    return {
      computeChart: vi.fn().mockResolvedValue({ fresh: true }),
      getYogasAndDoshas: vi.fn().mockResolvedValue({
        yogas_active: [{ name: 'Gajakesari', category: 'Raja', description: null }],
        doshas: { manglik: { present: false, text: '' } },
      }),
      computeNumerology: vi.fn().mockResolvedValue({ lifePath: 8 }),
    }
  }

  it('calls compute fns with the profile birth fields', async () => {
    const compute = makeCompute()
    await recomputeProfile(profile, compute)
    expect(compute.computeChart).toHaveBeenCalledWith(
      'Ada', '1990-01-15', '12:30', 51.5, -0.12, 0, 'London',
    )
    expect(compute.getYogasAndDoshas).toHaveBeenCalledWith({ fresh: true }, profile)
    expect(compute.computeNumerology).toHaveBeenCalledWith('Ada', '1990-01-15', 'female', null)
  })

  it('returns an updated profile stamped with the current engine version', async () => {
    const compute = makeCompute()
    const out = await recomputeProfile(profile, compute)
    expect(out.engineVersion).toBe(CHART_ENGINE_VERSION)
    expect(out.chart).toEqual({ fresh: true })
    expect(out.yogas).toEqual([{ name: 'Gajakesari', category: 'Raja', description: null }])
    expect(out.doshas).toEqual({ manglik: { present: false, text: '' } })
    expect(out.numerology).toEqual({ lifePath: 8 })
    // preserves birth/identity fields
    expect(out.id).toBe('abc')
    expect(out.createdAt).toBe(123)
  })

  it('passes name_in_use to computeNumerology when present', async () => {
    const compute = makeCompute()
    await recomputeProfile({ ...profile, name_in_use: 'Addy' }, compute)
    expect(compute.computeNumerology).toHaveBeenCalledWith('Ada', '1990-01-15', 'female', 'Addy')
  })

  it('passes gender into computeNumerology (drives the Lo Shu Kua)', async () => {
    const compute = makeCompute()
    await recomputeProfile({ ...profile, gender: 'male' }, compute)
    expect(compute.computeNumerology).toHaveBeenCalledWith('Ada', '1990-01-15', 'male', null)
  })

  it('throws when birth fields are missing', async () => {
    const compute = makeCompute()
    await expect(recomputeProfile({ id: 'x', name: 'No DOB' }, compute)).rejects.toThrow(/birth details/)
    expect(compute.computeChart).not.toHaveBeenCalled()
  })
})
