// API key storage. Reads come from the in-memory cache (hydrated at startup); writes mirror to
// localStorage and write through to IndexedDB. Cross-tab sync uses BroadcastChannel because the
// `storage` event does not fire for IndexedDB writes.
import { cache, idbPutKv, idbDeleteKv } from './db'

const KEY = 'astro:apiKey'

// Lets React views (e.g. route guards) re-render when the key is saved/cleared. See useApiKey.
const listeners = new Set()
function notify() {
  for (const l of listeners) l()
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('astro:apiKey') : null
if (channel) channel.onmessage = () => notify()

export function subscribeApiKey(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function getApiKey() {
  return cache.apiKey
}

export function saveApiKey({ provider, key, baseUrl, model }) {
  // baseUrl + model are only used by the OpenAI-compatible "custom" provider.
  const data = { provider, key }
  if (baseUrl) data.baseUrl = baseUrl
  if (model) data.model = model
  cache.apiKey = data
  localStorage.setItem(KEY, JSON.stringify(data))
  const p = idbPutKv('apiKey', data)
  notify()
  channel?.postMessage('changed')
  return p
}

export function clearApiKey() {
  cache.apiKey = null
  localStorage.removeItem(KEY)
  const p = idbDeleteKv('apiKey')
  notify()
  channel?.postMessage('changed')
  return p
}
