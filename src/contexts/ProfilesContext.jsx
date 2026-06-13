import { createContext, useState, useCallback, useMemo } from 'react'
import {
  getProfiles, saveProfile, deleteProfile,
  getActiveProfileId, setActiveProfileId,
} from '../lib/storage/profiles'

export const ProfilesContext = createContext(null)

export function ProfilesProvider({ children }) {
  const [profiles, setProfiles] = useState(() => getProfiles())
  const [activeProfileId, setActiveId] = useState(() => getActiveProfileId())

  const activeProfile = useMemo(
    () => profiles.find(p => p.id === activeProfileId) ?? null,
    [profiles, activeProfileId],
  )

  const addProfile = useCallback(profile => {
    saveProfile(profile)
    if (!getActiveProfileId()) {
      setActiveProfileId(profile.id)
      setActiveId(profile.id)
    }
    setProfiles(getProfiles())
  }, [])

  const updateProfile = useCallback(profile => {
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

  const value = useMemo(
    () => ({ profiles, activeProfile, activeProfileId, addProfile, updateProfile, removeProfile, switchProfile }),
    [profiles, activeProfile, activeProfileId, addProfile, updateProfile, removeProfile, switchProfile],
  )

  return (
    <ProfilesContext.Provider value={value}>
      {children}
    </ProfilesContext.Provider>
  )
}
