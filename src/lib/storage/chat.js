import { v4 as uuidv4 } from 'uuid'

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
  // Stable id for stable React keys. Senders pass only {role, content, tools?}; never trust
  // these ids in provider requests — useLLM strips messages down to {role, content}.
  history.push({ id: uuidv4(), ...message })
  localStorage.setItem(storageKey(profileId, tab), JSON.stringify(history))
}

export function clearHistory(profileId, tab) {
  localStorage.removeItem(storageKey(profileId, tab))
}
