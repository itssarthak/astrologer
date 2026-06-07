const KEY = 'astro:profiles'
const ACTIVE_KEY = 'astro:activeProfileId'

export function getProfiles() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveProfile(profile) {
  const profiles = getProfiles()
  const idx = profiles.findIndex(p => p.id === profile.id)
  if (idx >= 0) {
    profiles[idx] = profile
  } else {
    profiles.push(profile)
  }
  localStorage.setItem(KEY, JSON.stringify(profiles))
}

export function deleteProfile(id) {
  const profiles = getProfiles().filter(p => p.id !== id)
  localStorage.setItem(KEY, JSON.stringify(profiles))
  if (getActiveProfileId() === id) {
    setActiveProfileId(profiles[0]?.id ?? null)
  }
}

export function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveProfileId(id) {
  if (id == null) {
    localStorage.removeItem(ACTIVE_KEY)
  } else {
    localStorage.setItem(ACTIVE_KEY, id)
  }
}

export function getActiveProfile() {
  const id = getActiveProfileId()
  return getProfiles().find(p => p.id === id) ?? null
}
