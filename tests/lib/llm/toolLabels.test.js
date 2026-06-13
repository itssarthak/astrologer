import { describe, it, expect } from 'vitest'
import { TOOL_LABELS, toolLabel, toolLabelActive } from '../../../src/lib/llm/toolLabels'
import { TOOLS } from '../../../src/lib/llm/tools'

describe('toolLabels', () => {
  it('has an active + past label for every registered tool', () => {
    for (const tool of TOOLS) {
      expect(TOOL_LABELS[tool.name], `missing label for ${tool.name}`).toBeTruthy()
      expect(TOOL_LABELS[tool.name].active).toBeTruthy()
      expect(TOOL_LABELS[tool.name].past).toBeTruthy()
    }
  })

  it('does not define labels for tools that no longer exist', () => {
    const names = new Set(TOOLS.map(t => t.name))
    for (const key of Object.keys(TOOL_LABELS)) {
      expect(names.has(key), `stale label for removed tool ${key}`).toBe(true)
    }
  })

  it('falls back to the raw name for an unknown tool', () => {
    expect(toolLabel('mystery')).toBe('mystery')
    expect(toolLabelActive('mystery')).toBe('Running mystery')
  })
})
