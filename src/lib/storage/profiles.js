// Birth profiles + active-profile selection. Reads come synchronously from the in-memory cache
// (hydrated at startup); writes update the cache, mirror to localStorage (the fallback store),
// and write through to IndexedDB. Public API is unchanged so ProfilesContext and the LLM tools
// (which read profiles synchronously) need no changes.
import { cache, idbPut, idbDelete, idbPutKv, idbDeleteKv } from './db'

const KEY = 'astro:profiles'
const ACTIVE_KEY = 'astro:activeProfileId'

function mirrorProfiles() {
  localStorage.setItem(KEY, JSON.stringify(cache.profiles))
}

export function getProfiles() {
  return cache.profiles
}

// Always produces a fresh array reference (preserving order) so React context consumers
// re-render on update, while still writing through to IndexedDB.
export function saveProfile(profile) {
  const exists = cache.profiles.some(p => p.id === profile.id)
  cache.profiles = exists
    ? cache.profiles.map(p => (p.id === profile.id ? profile : p))
    : [...cache.profiles, profile]
  mirrorProfiles()
  return idbPut('profiles', profile)
}

export function deleteProfile(id) {
  cache.profiles = cache.profiles.filter(p => p.id !== id)
  mirrorProfiles()
  const p = idbDelete('profiles', id)
  if (getActiveProfileId() === id) {
    setActiveProfileId(cache.profiles[0]?.id ?? null)
  }
  return p
}

export function getActiveProfileId() {
  return cache.activeProfileId
}

export function setActiveProfileId(id) {
  cache.activeProfileId = id ?? null
  if (id == null) {
    localStorage.removeItem(ACTIVE_KEY)
    return idbDeleteKv('activeProfileId')
  }
  localStorage.setItem(ACTIVE_KEY, id)
  return idbPutKv('activeProfileId', id)
}

export function getActiveProfile() {
  return cache.profiles.find(p => p.id === cache.activeProfileId) ?? null
}
