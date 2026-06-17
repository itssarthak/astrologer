import { v4 as uuidv4 } from 'uuid'
import { isIdbAvailable, idbPut, idbGetAllByThread, idbDeleteThread } from './db'

// Per-(profile, tab) chat history. Each message is one IndexedDB record in the `messages` store
// (indexed by [profileId, tab]), so appending is a single per-record write rather than rewriting
// the whole thread. localStorage is kept as a legacy read source + degraded-mode store.
//
// Senders pass only {role, content, tools?}; we add a stable id for React keys. Never trust these
// ids in provider requests — the chat hook strips messages to {role, content} before sending.
const prefix = 'astro:chat'

function storageKey(profileId, tab) {
  return `${prefix}:${profileId}:${tab}`
}

function readLegacy(profileId, tab) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(profileId, tab)) ?? '[]')
  } catch {
    return []
  }
}

// Drop the IDB-internal columns (profileId, tab, seq) so callers get the same
// {id, role, content, tools?} shape as the old localStorage records.
function toMessage(row) {
  const message = { id: row.id, role: row.role, content: row.content }
  if (row.tools !== undefined) message.tools = row.tools
  return message
}

export async function getHistory(profileId, tab) {
  if (isIdbAvailable()) {
    const rows = await idbGetAllByThread(profileId, tab)
    if (rows.length) return rows.map(toMessage)
    // Not yet migrated — fall back to any legacy localStorage thread (migrates on next append).
    return readLegacy(profileId, tab)
  }
  return readLegacy(profileId, tab)
}

// Move a legacy localStorage thread into IDB (once) so IDB stays the single source of truth and
// new appends don't split history. Returns the number of messages now stored for this thread.
async function migrateLegacyThread(profileId, tab) {
  const existing = await idbGetAllByThread(profileId, tab)
  if (existing.length) return existing.length
  const legacy = readLegacy(profileId, tab)
  if (!legacy.length) return 0
  for (let i = 0; i < legacy.length; i++) {
    const { id, ...rest } = legacy[i]
    await idbPut('messages', { id: id ?? uuidv4(), profileId, tab, seq: i, ...rest })
  }
  localStorage.removeItem(storageKey(profileId, tab))
  return legacy.length
}

export async function appendMessage(profileId, tab, message) {
  if (isIdbAvailable()) {
    const seq = await migrateLegacyThread(profileId, tab)
    await idbPut('messages', { id: uuidv4(), profileId, tab, seq, ...message })
    return
  }
  // Degraded mode: append to the localStorage array (old behavior, old size limits).
  const history = readLegacy(profileId, tab)
  history.push({ id: uuidv4(), ...message })
  localStorage.setItem(storageKey(profileId, tab), JSON.stringify(history))
}

export async function clearHistory(profileId, tab) {
  localStorage.removeItem(storageKey(profileId, tab))
  await idbDeleteThread(profileId, tab)
}
