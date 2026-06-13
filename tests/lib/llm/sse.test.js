import { describe, it, expect } from 'vitest'
import { accumulateOpenAI, accumulateClaude, accumulateGemini } from '../../../src/lib/llm/sse'

describe('accumulateOpenAI', () => {
  it('collects streamed text and a tool call across deltas', () => {
    const acc = accumulateOpenAI()
    acc.push({ choices: [{ delta: { content: 'Hel' } }] })
    acc.push({ choices: [{ delta: { content: 'lo' } }] })
    acc.push({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'get_chart', arguments: '{"pro' } }] } }] })
    acc.push({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'file_name":"A"}' } }] } }] })
    const { text, toolCalls } = acc.result()
    expect(text).toBe('Hello')
    expect(toolCalls).toEqual([{ id: 'c1', name: 'get_chart', args: { profile_name: 'A' } }])
  })
})

describe('accumulateClaude', () => {
  it('collects text_delta and a tool_use via input_json_delta', () => {
    const acc = accumulateClaude()
    acc.push({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi' } })
    acc.push({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tu1', name: 'get_divisional' } })
    acc.push({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"varga":' } })
    acc.push({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '"d10"}' } })
    const { text, toolCalls } = acc.result()
    expect(text).toBe('Hi')
    expect(toolCalls).toEqual([{ id: 'tu1', name: 'get_divisional', args: { varga: 'd10' } }])
  })
})

describe('accumulateGemini', () => {
  it('collects text parts and a whole functionCall', () => {
    const acc = accumulateGemini()
    acc.push({ candidates: [{ content: { parts: [{ text: 'Hey' }] } }] })
    acc.push({ candidates: [{ content: { parts: [{ functionCall: { name: 'compute_numerology', args: { full_name: 'A', dob: '1990-01-01' } } }] } }] })
    const { text, toolCalls } = acc.result()
    expect(text).toBe('Hey')
    expect(toolCalls[0]).toMatchObject({ name: 'compute_numerology', args: { full_name: 'A', dob: '1990-01-01' } })
  })
})
