import { describe, it, expect } from 'vitest'
import { assembleSystemPrompt } from '../../../src/lib/prompts/systemPrompt'
import { TOOL_GUIDANCE, LAYMAN_REMINDER, instructionFor } from '../../../src/lib/llm/tabConfig'

const profile = {
  name: 'Asha', dob: '1990-06-15', time: '14:30', place: 'Mumbai', gender: 'female',
  chart: { d1Chart: { houses: [{ number: 1, sign: 'Virgo', occupants: [] }] } },
}

describe('assembleSystemPrompt', () => {
  it('fills the profile placeholders (name, no leftover {{tokens}})', () => {
    const p = assembleSystemPrompt(profile, 'chart')
    expect(p).toContain('Asha')
    expect(p).not.toMatch(/\{\{\w+\}\}/)
  })

  it('includes the per-tab instruction', () => {
    const p = assembleSystemPrompt(profile, 'today')
    expect(p).toContain(instructionFor('today'))
  })

  it('includes the tool guidance when tools are enabled, omits it when not', () => {
    expect(assembleSystemPrompt(profile, 'chart', { toolsEnabled: true })).toContain(TOOL_GUIDANCE)
    expect(assembleSystemPrompt(profile, 'chart', { toolsEnabled: false })).not.toContain(TOOL_GUIDANCE)
  })

  it('places the layman reminder LAST so it re-anchors tone after the data context', () => {
    const ctx = '## Computed Birth Chart\n- Mercury in Taurus (house 9)'
    const p = assembleSystemPrompt(profile, 'chart', { extraContext: ctx })
    expect(p).toContain(ctx)
    // The reminder must come after the computed-data context, and be the final section.
    expect(p.indexOf(LAYMAN_REMINDER)).toBeGreaterThan(p.indexOf(ctx))
    expect(p.trimEnd().endsWith(LAYMAN_REMINDER.trimEnd())).toBe(true)
  })

  it('the layman reminder forbids the jargon categories', () => {
    const p = assembleSystemPrompt(profile, 'chart')
    // Spot-check the guardrails are actually present in the assembled prompt.
    expect(p.toLowerCase()).toContain('layman')
    expect(p).toMatch(/Sanskrit term/i)
  })
})
