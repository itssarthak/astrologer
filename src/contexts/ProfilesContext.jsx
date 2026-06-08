import { createContext, useState, useCallback } from 'react'
import {
  getProfiles, saveProfile, deleteProfile,
  getActiveProfileId, setActiveProfileId,
} from '../lib/storage/profiles'

export const ProfilesContext = createContext(null)

export function ProfilesProvider({ children }) {
  const [profiles, setProfiles] = useState(() => getProfiles())
  const [activeProfileId, setActiveId] = useState(() => getActiveProfileId())

  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? null

  const addProfile = useCallback(profile => {
    saveProfile(profile)
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

  const refreshProfiles = useCallback(() => {
    setProfiles(getProfiles())
    setActiveId(getActiveProfileId())
  }, [])

  return (
    <ProfilesContext.Provider value={{ profiles, activeProfile, activeProfileId, addProfile, removeProfile, switchProfile, refreshProfiles }}>
      {children}
    </ProfilesContext.Provider>
  )
}
