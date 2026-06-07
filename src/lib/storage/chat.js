const prefix = 'astro:chat'

function storageKey(profileId, tab) {
  return `${prefix}:${profileId}:${tab}`
}

export function getHistory(profileId, tab) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(profileId, tab)) ?? '[]')
  } catch {
    return []
  }
}

export function appendMessage(profileId, tab, message) {
  const history = getHistory(profileId, tab)
  history.push(message)
  localStorage.setItem(storageKey(profileId, tab), JSON.stringify(history))
}

export function clearHistory(profileId, tab) {
  localStorage.removeItem(storageKey(profileId, tab))
}
