import { describe, it, expect, beforeEach } from 'vitest'
import {
  getProfiles, saveProfile, deleteProfile, getActiveProfileId, setActiveProfileId
} from '../../../src/lib/storage/profiles'

beforeEach(() => localStorage.clear())

describe('profiles storage', () => {
  it('returns empty array when no profiles exist', () => {
    expect(getProfiles()).toEqual([])
  })

  it('saves and retrieves a profile', () => {
    const p = { id: '1', name: 'Sarthak', dob: '1996-11-22', time: '13:06',
                 place: 'Delhi', lat: 28.61, lon: 77.20, timezone_offset: 5.5 }
    saveProfile(p)
    expect(getProfiles()).toHaveLength(1)
    expect(getProfiles()[0].name).toBe('Sarthak')
  })

  it('updates an existing profile by id', () => {
    const p = { id: '1', name: 'Sarthak', dob: '1996-11-22', time: '13:06',
                 place: 'Delhi', lat: 28.61, lon: 77.20, timezone_offset: 5.5 }
    saveProfile(p)
    saveProfile({ ...p, name: 'Sarthak Updated' })
    expect(getProfiles()).toHaveLength(1)
    expect(getProfiles()[0].name).toBe('Sarthak Updated')
  })

  it('deletes a profile by id', () => {
    saveProfile({ id: '1', name: 'A', dob: '1990-01-01', time: '12:00',
                  place: 'Delhi', lat: 28.61, lon: 77.20, timezone_offset: 5.5 })
    deleteProfile('1')
    expect(getProfiles()).toHaveLength(0)
  })

  it('tracks active profile id', () => {
    setActiveProfileId('abc')
    expect(getActiveProfileId()).toBe('abc')
  })
})
