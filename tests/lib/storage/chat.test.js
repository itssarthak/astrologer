import { describe, it, expect, beforeEach } from 'vitest'
import { getHistory, appendMessage, clearHistory } from '../../../src/lib/storage/chat'
import { resetStorageForTests, setIdbAvailableForTests } from '../../../src/lib/storage/db'

beforeEach(async () => {
  localStorage.clear()
  await resetStorageForTests()
})

describe('chat storage (async, per-record)', () => {
  it('returns empty array for unknown profile+tab', async () => {
    expect(await getHistory('p1', 'today')).toEqual([])
  })

  it('appends messages and retrieves them in order', async () => {
    await appendMessage('p1', 'today', { role: 'user', content: 'Hello' })
    await appendMessage('p1', 'today', { role: 'assistant', content: 'Hi' })
    const history = await getHistory('p1', 'today')
    expect(history.map(m => m.content)).toEqual(['Hello', 'Hi'])
  })

  it('assigns a stable id to each message', async () => {
    await appendMessage('p1', 'today', { role: 'user', content: 'Hello' })
    const [msg] = await getHistory('p1', 'today')
    expect(typeof msg.id).toBe('string')
    expect(msg.id.length).toBeGreaterThan(0)
  })

  it('preserves the optional tools field', async () => {
    await appendMessage('p1', 'chat', { role: 'assistant', content: 'x', tools: ['get_chart'] })
    const [msg] = await getHistory('p1', 'chat')
    expect(msg.tools).toEqual(['get_chart'])
  })

  it('clears history for a specific profile+tab', async () => {
    await appendMessage('p1', 'today', { role: 'user', content: 'Hello' })
    await clearHistory('p1', 'today')
    expect(await getHistory('p1', 'today')).toHaveLength(0)
  })

  it('isolates history per profile and tab', async () => {
    await appendMessage('p1', 'today', { role: 'user', content: 'A' })
    await appendMessage('p1', 'chat', { role: 'user', content: 'B' })
    await appendMessage('p2', 'today', { role: 'user', content: 'C' })
    expect(await getHistory('p1', 'today')).toHaveLength(1)
    expect(await getHistory('p1', 'chat')).toHaveLength(1)
    expect(await getHistory('p2', 'today')).toHaveLength(1)
  })

  it('reads a legacy localStorage thread when IndexedDB has none', async () => {
    localStorage.setItem('astro:chat:p1:today',
      JSON.stringify([{ id: 'a', role: 'user', content: 'legacy' }]))
    const history = await getHistory('p1', 'today')
    expect(history.map(m => m.content)).toEqual(['legacy'])
  })

  it('lazily migrates a legacy thread into IDB on the next append', async () => {
    localStorage.setItem('astro:chat:p1:today',
      JSON.stringify([{ id: 'a', role: 'user', content: 'legacy' }]))
    await appendMessage('p1', 'today', { role: 'assistant', content: 'new' })
    const history = await getHistory('p1', 'today')
    expect(history.map(m => m.content)).toEqual(['legacy', 'new'])
    // legacy localStorage key is cleaned up once migrated
    expect(localStorage.getItem('astro:chat:p1:today')).toBeNull()
  })

  it('persists messages to IndexedDB (survives a localStorage wipe)', async () => {
    await appendMessage('p1', 'chat', { role: 'user', content: 'durable' })
    localStorage.clear()   // drop any localStorage copy; IDB must still hold it
    const history = await getHistory('p1', 'chat')
    expect(history.map(m => m.content)).toEqual(['durable'])
  })

  it('degraded mode (no IDB) appends and reads via localStorage', async () => {
    setIdbAvailableForTests(false)
    await appendMessage('p1', 'today', { role: 'user', content: 'D1' })
    await appendMessage('p1', 'today', { role: 'assistant', content: 'D2' })
    const history = await getHistory('p1', 'today')
    expect(history.map(m => m.content)).toEqual(['D1', 'D2'])
  })
})
