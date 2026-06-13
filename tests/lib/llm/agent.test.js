import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Drive runAgent through the OpenAI-compatible runner by stubbing fetch + the SSE reader.
// readSSE is mocked to immediately replay a scripted set of events into the runner's onEvent,
// which lets us exercise the streaming -> accumulate -> tool-dispatch -> final-text path
// without a real network or stream.
import { runAgent } from '../../../src/lib/llm/agent'

// Per-call scripts of SSE events the mocked readSSE will replay, in order.
let sseScripts
let lastRequestBody

vi.mock('../../../src/lib/llm/sse', async () => {
  const actual = await vi.importActual('../../../src/lib/llm/sse')
  return {
    ...actual,
    readSSE: async (_resp, onEvent) => {
      const events = sseScripts.shift() ?? []
      for (const ev of events) onEvent(ev)
    },
  }
})

beforeEach(() => {
  sseScripts = []
  lastRequestBody = null
  global.fetch = vi.fn(async (_url, opts) => {
    lastRequestBody = JSON.parse(opts.body)
    return { ok: true, body: {} }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const base = {
  provider: 'openai',
  key: 'k',
  systemPrompt: 'sys',
  userMessage: 'hi',
}

describe('runAgent', () => {
  it('returns final text and streams deltas when no tool is called', async () => {
    sseScripts = [[
      { choices: [{ delta: { content: 'Hel' } }] },
      { choices: [{ delta: { content: 'lo' } }] },
    ]]
    const chunks = []
    const text = await runAgent({ ...base, onDelta: c => chunks.push(c) })
    expect(text).toBe('Hello')
    expect(chunks.join('')).toBe('Hello')
  })

  it('omits the tools field when no tools are provided', async () => {
    sseScripts = [[{ choices: [{ delta: { content: 'ok' } }] }]]
    await runAgent({ ...base, tools: [] })
    expect(lastRequestBody.tools).toBeUndefined()
    expect(lastRequestBody.tool_choice).toBeUndefined()
    expect(lastRequestBody.stream).toBe(true)
  })

  it('dispatches a tool call then returns the follow-up answer', async () => {
    const execute = vi.fn(async () => ({ value: 42 }))
    const tools = [{ name: 'get_thing', description: 'd', parameters: { type: 'object' }, execute }]
    // Round 1: model asks for a tool. Round 2: model answers.
    sseScripts = [
      [{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'get_thing', arguments: '{}' } }] } }] }],
      [{ choices: [{ delta: { content: 'Answer' } }] }],
    ]
    const events = []
    const text = await runAgent({ ...base, tools, onToolEvent: e => events.push(e) })
    expect(execute).toHaveBeenCalledOnce()
    expect(text).toBe('Answer')
    expect(events).toContainEqual({ name: 'get_thing', status: 'running' })
    expect(events).toContainEqual({ name: 'get_thing', status: 'done' })
    // tools field present on the request when tools are supplied
    expect(lastRequestBody.tools).toHaveLength(1)
    expect(lastRequestBody.tool_choice).toBe('auto')
  })
})
