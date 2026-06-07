const KEY = 'astro:apiKey'

export function getApiKey() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

export function saveApiKey({ provider, key }) {
  localStorage.setItem(KEY, JSON.stringify({ provider, key }))
}

export function clearApiKey() {
  localStorage.removeItem(KEY)
}
