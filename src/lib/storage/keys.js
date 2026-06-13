const KEY = 'astro:apiKey'

// Lets React views (e.g. the route guards) re-render when the key is saved/cleared,
// instead of reading stale storage at mount time. See useApiKey.
const listeners = new Set()
function notify() {
  for (const l of listeners) l()
}

export function subscribeApiKey(cb) {
  listeners.add(cb)
  // Also react to changes from other tabs/windows.
  const onStorage = e => { if (e.key === KEY) cb() }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

export function getApiKey() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

export function saveApiKey({ provider, key, baseUrl, model }) {
  // baseUrl + model are only used by the OpenAI-compatible "custom" provider.
  const data = { provider, key }
  if (baseUrl) data.baseUrl = baseUrl
  if (model) data.model = model
  localStorage.setItem(KEY, JSON.stringify(data))
  notify()
}

export function clearApiKey() {
  localStorage.removeItem(KEY)
  notify()
}
