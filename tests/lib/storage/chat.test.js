import { describe, it, expect, beforeEach } from 'vitest'
import { getHistory, appendMessage, clearHistory } from '../../../src/lib/storage/chat'

beforeEach(() => localStorage.clear())

describe('chat storage', () => {
  it('returns empty array for unknown profile+tab', () => {
    expect(getHistory('p1', 'today')).toEqual([])
  })

  it('appends messages and retrieves them', () => {
    appendMessage('p1', 'today', { role: 'user', content: 'Hello' })
    appendMessage('p1', 'today', { role: 'assistant', content: 'Hi' })
    expect(getHistory('p1', 'today')).toHaveLength(2)
  })

  it('clears history for a specific profile+tab', () => {
    appendMessage('p1', 'today', { role: 'user', content: 'Hello' })
    clearHistory('p1', 'today')
    expect(getHistory('p1', 'today')).toHaveLength(0)
  })

  it('isolates history per profile and tab', () => {
    appendMessage('p1', 'today', { role: 'user', content: 'A' })
    appendMessage('p1', 'chat', { role: 'user', content: 'B' })
    appendMessage('p2', 'today', { role: 'user', content: 'C' })
    expect(getHistory('p1', 'today')).toHaveLength(1)
    expect(getHistory('p1', 'chat')).toHaveLength(1)
    expect(getHistory('p2', 'today')).toHaveLength(1)
  })
})
