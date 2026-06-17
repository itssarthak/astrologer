import { useState, useEffect, useCallback } from 'react'

const ASSUMED_LOCALSTORAGE_CAP = 5 * 1024 * 1024 // ~5MB, the typical localStorage budget per origin.

// Rough byte count of everything in localStorage — used only in degraded mode (no StorageManager).
function measureLocalStorageBytes() {
  try {
    if (typeof localStorage === 'undefined') return null
    let bytes = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      bytes += key.length + (localStorage.getItem(key)?.length ?? 0)
    }
    return bytes * 2 // UTF-16 code units → bytes
  } catch {
    return null
  }
}

// Returns { usage, quota, percent } for the origin, or null if usage can't be measured.
// Prefers navigator.storage.estimate() (covers IndexedDB + localStorage + caches); falls back to a
// localStorage-only measurement against an assumed ~5MB cap. Dependencies are injectable for tests.
export async function readStorageEstimate({
  nav = typeof navigator !== 'undefined' ? navigator : undefined,
  measureLocalBytes = measureLocalStorageBytes,
} = {}) {
  if (nav?.storage?.estimate) {
    try {
      const { usage = 0, quota = 0 } = await nav.storage.estimate()
      if (quota > 0) return { usage, quota, percent: Math.round((usage / quota) * 100) }
    } catch { /* fall through to the localStorage estimate */ }
  }
  const bytes = measureLocalBytes()
  if (bytes == null) return null
  return {
    usage: bytes,
    quota: ASSUMED_LOCALSTORAGE_CAP,
    percent: Math.round((bytes / ASSUMED_LOCALSTORAGE_CAP) * 100),
  }
}

// Reactive storage usage. Refreshes on mount and whenever the tab regains visibility (e.g. after a
// long chat session in another tab). `refresh` lets callers re-measure after a large write.
export function useStorageEstimate() {
  const [estimate, setEstimate] = useState(null)

  const refresh = useCallback(() => {
    readStorageEstimate().then(setEstimate)
  }, [])

  useEffect(() => {
    refresh()
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') refresh()
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  return { estimate, refresh }
}
