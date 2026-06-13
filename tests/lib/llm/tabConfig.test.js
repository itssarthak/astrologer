import { it, expect } from 'vitest'
import { enabledToolsFor, TAB_CONFIG } from '../../../src/lib/llm/tabConfig'

it('every tab enables all tools by default', () => {
  expect(enabledToolsFor('chat').length).toBeGreaterThan(0)
  expect(enabledToolsFor('today').map(t => t.name)).toContain('get_today_transit')
})

it('disabledTools removes a tool from a tab', () => {
  const orig = TAB_CONFIG.numbers.disabledTools
  TAB_CONFIG.numbers.disabledTools = ['web_search']
  expect(enabledToolsFor('numbers').map(t => t.name)).not.toContain('web_search')
  TAB_CONFIG.numbers.disabledTools = orig
})

it('unknown tab falls back to all tools', () => {
  expect(enabledToolsFor('nope').length).toBe(enabledToolsFor('chat').length)
})
