import { useContext, useEffect, useRef } from 'react'
import { ProfilesContext } from '../contexts/ProfilesContext'
import { PyodideContext } from '../contexts/PyodideContext'
import { isProfileStale, recomputeProfile } from '../lib/migrateProfile'

// Once Pyodide is ready, silently recompute any saved profile whose stored engineVersion is
// older than the current CHART_ENGINE_VERSION and re-save it via updateProfile.
//
// ANTI-LOOP: the effect keys on [isReady] only (NOT on profiles), and every profile id is
// guarded by a useRef Set of ids already migrated/in-flight. We add the id to the set BEFORE
// awaiting, so a re-render that re-runs the effect (e.g. when updateProfile changes profiles)
// skips ids already handled. Combined with the version stamp written by recomputeProfile —
// after save isProfileStale is false — there is no recompute loop.
export function useProfileMigration() {
  const { profiles, updateProfile } = useContext(ProfilesContext)
  const { isReady, computeChart, getYogasAndDoshas, computeNumerology } = useContext(PyodideContext)

  // Latest profiles, read inside the effect without making profiles an effect dependency.
  const profilesRef = useRef(profiles)
  profilesRef.current = profiles

  const handledIds = useRef(new Set())

  useEffect(() => {
    if (!isReady) return
    let cancelled = false
    const compute = { computeChart, getYogasAndDoshas, computeNumerology }

    ;(async () => {
      for (const profile of profilesRef.current) {
        if (cancelled) return
        if (!isProfileStale(profile) || handledIds.current.has(profile.id)) continue
        handledIds.current.add(profile.id)
        try {
          const migrated = await recomputeProfile(profile, compute)
          if (cancelled) return
          updateProfile(migrated)
        } catch (err) {
          // A single bad profile must never break the app; leave it stale and move on.
          console.warn(`Profile migration failed for ${profile.id}:`, err)
        }
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady])
}

// Null-rendering mount point: placed inside <PyodideProvider> so it can read both contexts.
export default function ProfileMigration() {
  useProfileMigration()
  return null
}
