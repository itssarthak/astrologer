const KEY = 'astro:apiKey'

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
}

export function clearApiKey() {
  localStorage.removeItem(KEY)
}
