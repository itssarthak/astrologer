import { useState, useCallback } from 'react'
import {
  getProfiles, saveProfile, deleteProfile,
  getActiveProfileId, setActiveProfileId
} from '../lib/storage/profiles'

export function useProfiles() {
  const [profiles, setProfiles] = useState(() => getProfiles())
  const [activeProfileId, setActiveId] = useState(() => getActiveProfileId())

  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? null

  const addProfile = useCallback(profile => {
    saveProfile(profile)
    if (!getActiveProfileId()) {
      setActiveProfileId(profile.id)
      setActiveId(profile.id)
    }
    setProfiles(getProfiles())
  }, [])

  const removeProfile = useCallback(id => {
    deleteProfile(id)
    setProfiles(getProfiles())
    setActiveId(getActiveProfileId())
  }, [])

  const switchProfile = useCallback(id => {
    setActiveProfileId(id)
    setActiveId(id)
  }, [])

  const updateProfile = useCallback(profile => {
    saveProfile(profile)
    setProfiles(getProfiles())
  }, [])

  return { profiles, activeProfile, activeProfileId, addProfile, removeProfile, switchProfile, updateProfile }
}
