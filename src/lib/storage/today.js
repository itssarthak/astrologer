// Caches the daily transit so the Today tab computes (and calls the LLM) at most once per
// calendar day per profile — re-visiting the tab reuses the cached transit instead of
// recomputing and appending a duplicate read each time.
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
  try {
    const cached = JSON.parse(localStorage.getItem(storageKey(profileId)) ?? 'null')
    if (cached && cached.date === todayStamp()) return cached.transit
  } catch { /* ignore malformed cache */ }
  return null
}

export function saveTodayTransit(profileId, transit) {
  localStorage.setItem(storageKey(profileId), JSON.stringify({ date: todayStamp(), transit }))
}
