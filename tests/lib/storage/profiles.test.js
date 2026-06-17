import { describe, it, expect, beforeEach } from 'vitest'
import {
  getProfiles, saveProfile, deleteProfile, getActiveProfileId, setActiveProfileId, getActiveProfile,
} from '../../../src/lib/storage/profiles'
import { cache, hydrate, resetStorageForTests } from '../../../src/lib/storage/db'

beforeEach(async () => {
  localStorage.clear()
  await resetStorageForTests()
})

const sample = { id: '1', name: 'Sarthak', dob: '1996-11-22', time: '13:06',
                 place: 'Delhi', lat: 28.61, lon: 77.20, timezone_offset: 5.5 }

describe('profiles storage (cache-backed)', () => {
  it('returns empty array when no profiles exist', () => {
    expect(getProfiles()).toEqual([])
  })

  it('saves and retrieves a profile', () => {
    saveProfile(sample)
    expect(getProfiles()).toHaveLength(1)
    expect(getProfiles()[0].name).toBe('Sarthak')
  })

  it('updates an existing profile by id (preserving order) and returns a new array ref', () => {
    saveProfile(sample)
    const before = getProfiles()
    saveProfile({ ...sample, name: 'Sarthak Updated' })
    const after = getProfiles()
    expect(after).toHaveLength(1)
    expect(after[0].name).toBe('Sarthak Updated')
    // A fresh reference is required so React context re-renders on update.
    expect(after).not.toBe(before)
  })

  it('deletes a profile by id', () => {
    saveProfile(sample)
    deleteProfile('1')
    expect(getProfiles()).toHaveLength(0)
  })

  it('tracks active profile id and resolves the active profile', () => {
    saveProfile(sample)
    setActiveProfileId('1')
    expect(getActiveProfileId()).toBe('1')
    expect(getActiveProfile()).toEqual(sample)
  })

  it('clears active id to the first remaining profile when the active one is deleted', () => {
    saveProfile(sample)
    saveProfile({ ...sample, id: '2', name: 'Second' })
    setActiveProfileId('1')
    deleteProfile('1')
    expect(getActiveProfileId()).toBe('2')
  })

  it('writes through to IndexedDB (survives a cache wipe + reload from IDB)', async () => {
    await saveProfile(sample)        // returns the IDB write promise
    localStorage.clear()             // drop the localStorage mirror so reload can only come from IDB
    cache.profiles = []              // wipe the in-memory cache
    const reloaded = await hydrate()
    expect(reloaded.profiles).toContainEqual(sample)
  })

  it('falls back to legacy localStorage profiles on hydrate when IDB is empty', async () => {
    localStorage.setItem('astro:profiles', JSON.stringify([sample]))
    await hydrate()
    expect(getProfiles()).toEqual([sample])
  })
})
