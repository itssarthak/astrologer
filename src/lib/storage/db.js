// Low-level IndexedDB layer for the app's persistence, plus the in-memory cache that lets the
// small always-needed stores (profiles / api key / today) stay readable SYNCHRONOUSLY after a
// one-time async hydrate(). See docs/superpowers/specs/2026-06-15-indexeddb-storage-design.md.
//
// localStorage is kept as a transparent fallback: reads fall back to it, writes mirror to it for
// the small stores, and if IndexedDB can't open at all the whole layer degrades to pure
// localStorage so persistence never simply breaks.

const DB_NAME = 'askmyastro'
const DB_VERSION = 1

// Object stores. `messages` is one-record-per-chat-message, indexed by [profileId, tab].
const KEYED_STORES = { profiles: 'id', today: 'profileId', messages: 'id' }
const KV_STORE = 'kv'

// Synchronous in-memory mirror of the small stores. Populated by hydrate(); read by the
// profiles/keys/today modules so their public getters stay synchronous.
export const cache = { profiles: [], activeProfileId: null, apiKey: null, today: {} }

let available = typeof indexedDB !== 'undefined'
let openPromise = null

function openDB() {
  if (!available) return Promise.reject(new Error('IndexedDB unavailable'))
  if (openPromise) return openPromise
  openPromise = new Promise((resolve, reject) => {
    let req
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (err) {
      reject(err)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      for (const [name, keyPath] of Object.entries(KEYED_STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath })
          if (name === 'messages') store.createIndex('thread', ['profileId', 'tab'])
        }
      }
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
  return openPromise
}

// Run `fn(store)` inside a transaction and resolve with `fn`'s returned IDBRequest's result
// (or undefined) once the transaction completes. On any failure, marks IDB unavailable for the
// session is NOT done here — callers decide; we just reject.
async function withStore(name, mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode)
    const store = tx.objectStore(name)
    let result
    try {
      result = fn(store)
    } catch (err) {
      reject(err)
      return
    }
    tx.oncomplete = () => resolve(result && 'result' in result ? result.result : result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function reqResult(name, mode, op) {
  return withStore(name, mode, store => op(store))
}

// ---- keyed stores -------------------------------------------------------------------------

export async function idbPut(store, value) {
  if (!available) return
  try {
    await reqResult(store, 'readwrite', s => s.put(value))
  } catch (err) {
    console.warn(`idbPut(${store}) failed:`, err)
  }
}

export async function idbGet(store, key) {
  if (!available) return undefined
  try {
    return await reqResult(store, 'readonly', s => s.get(key))
  } catch (err) {
    console.warn(`idbGet(${store}) failed:`, err)
    return undefined
  }
}

export async function idbGetAll(store) {
  if (!available) return []
  try {
    return (await reqResult(store, 'readonly', s => s.getAll())) ?? []
  } catch (err) {
    console.warn(`idbGetAll(${store}) failed:`, err)
    return []
  }
}

export async function idbDelete(store, key) {
  if (!available) return
  try {
    await reqResult(store, 'readwrite', s => s.delete(key))
  } catch (err) {
    console.warn(`idbDelete(${store}) failed:`, err)
  }
}

// ---- kv singletons ------------------------------------------------------------------------

export async function idbPutKv(key, value) {
  if (!available) return
  try {
    await reqResult(KV_STORE, 'readwrite', s => s.put(value, key))
  } catch (err) {
    console.warn(`idbPutKv(${key}) failed:`, err)
  }
}

export async function idbGetKv(key) {
  if (!available) return undefined
  try {
    return await reqResult(KV_STORE, 'readonly', s => s.get(key))
  } catch (err) {
    console.warn(`idbGetKv(${key}) failed:`, err)
    return undefined
  }
}

export async function idbDeleteKv(key) {
  if (!available) return
  try {
    await reqResult(KV_STORE, 'readwrite', s => s.delete(key))
  } catch (err) {
    console.warn(`idbDeleteKv(${key}) failed:`, err)
  }
}

// ---- messages thread index ----------------------------------------------------------------

export async function idbGetAllByThread(profileId, tab) {
  if (!available) return []
  try {
    const rows = await withStore('messages', 'readonly', store =>
      store.index('thread').getAll(IDBKeyRange.only([profileId, tab])))
    return (rows ?? []).slice().sort((a, b) => a.seq - b.seq)
  } catch (err) {
    console.warn('idbGetAllByThread failed:', err)
    return []
  }
}

export async function idbDeleteThread(profileId, tab) {
  if (!available) return
  try {
    const keys = await withStore('messages', 'readonly', store =>
      store.index('thread').getAllKeys(IDBKeyRange.only([profileId, tab])))
    await withStore('messages', 'readwrite', store => {
      for (const k of keys ?? []) store.delete(k)
    })
  } catch (err) {
    console.warn('idbDeleteThread failed:', err)
  }
}

// ---- hydration ----------------------------------------------------------------------------

function readLegacyJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

// One-time async load of the small stores into `cache`. IndexedDB wins; where it's empty we seed
// from legacy localStorage (the data then migrates to IDB on its next write). Resolves even when
// IDB is unavailable — into degraded (localStorage-only) mode.
export async function hydrate() {
  try {
    await openDB()
  } catch (err) {
    available = false
    console.warn('IndexedDB unavailable, falling back to localStorage:', err)
  }

  if (available) {
    const profiles = await idbGetAll('profiles')
    cache.profiles = profiles.length ? profiles : readLegacyJSON('astro:profiles', [])

    const apiKey = await idbGetKv('apiKey')
    cache.apiKey = apiKey ?? readLegacyJSON('astro:apiKey', null)

    const activeId = await idbGetKv('activeProfileId')
    cache.activeProfileId = activeId ?? (localStorage.getItem('astro:activeProfileId') || null)

    const todayRows = await idbGetAll('today')
    cache.today = {}
    for (const row of todayRows) cache.today[row.profileId] = row
  } else {
    cache.profiles = readLegacyJSON('astro:profiles', [])
    cache.apiKey = readLegacyJSON('astro:apiKey', null)
    cache.activeProfileId = localStorage.getItem('astro:activeProfileId') || null
    cache.today = {}
  }
  return cache
}

// ---- availability / test helpers ----------------------------------------------------------

export function isIdbAvailable() {
  return available
}

export function setIdbAvailableForTests(value) {
  available = value
}

// Reset all in-memory + on-disk state so each test starts clean.
export async function resetStorageForTests() {
  cache.profiles = []
  cache.activeProfileId = null
  cache.apiKey = null
  cache.today = {}
  available = typeof indexedDB !== 'undefined'
  if (openPromise) {
    try { (await openPromise).close() } catch { /* ignore */ }
  }
  openPromise = null
  if (available) {
    await new Promise(resolve => {
      const req = indexedDB.deleteDatabase(DB_NAME)
      req.onsuccess = req.onerror = req.onblocked = () => resolve()
    })
  }
}
