// Caches the daily transit so the Today tab computes (and calls the LLM) at most once per
// calendar day per profile. Reads come from the in-memory cache (hydrated at startup) with a
// legacy-localStorage fallback; writes mirror to localStorage and write through to IndexedDB.
import { cache, idbPut } from './db'

const prefix = 'astro:today'

function storageKey(profileId) {
  return `${prefix}:${profileId}`
}

// Local calendar date, YYYY-MM-DD, used as the "is this still today?" marker.
export function todayStamp() {
  return new Date().toLocaleDateString('en-CA')
}

// Returns the cached transit object if one was stored for today, else null.
export function getTodayTransit(profileId) {
  const row = cache.today[profileId]
  if (row && row.date === todayStamp()) return row.transit
  // Fallback to legacy localStorage (e.g. cache miss before a write-through migration).
  try {
    const legacy = JSON.parse(localStorage.getItem(storageKey(profileId)) ?? 'null')
    if (legacy && legacy.date === todayStamp()) return legacy.transit
  } catch { /* ignore malformed cache */ }
  return null
}

export function saveTodayTransit(profileId, transit) {
  const row = { profileId, date: todayStamp(), transit }
  cache.today[profileId] = row
  localStorage.setItem(storageKey(profileId), JSON.stringify({ date: row.date, transit }))
  return idbPut('today', row)
}
