// Shared SSE plumbing for the streaming agent runners.

// Read an SSE body, invoking onEvent(parsedJSON) for each `data:` line (skips [DONE]/malformed).
export async function readSSE(resp, onEvent, signal) {
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    if (signal?.aborted) { try { await reader.cancel() } catch { /* noop */ } throw new DOMException('Aborted', 'AbortError') }
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try { onEvent(JSON.parse(data)) } catch { /* skip keep-alives / partials */ }
    }
  }
}

function parseArgs(s) {
  if (s && typeof s === 'object') return s
  try { return JSON.parse(s || '{}') } catch { return { __invalidArgs: String(s) } }
}

// OpenAI-compatible: text in choices[].delta.content; tool calls in choices[].delta.tool_calls[]
// streamed by index (id+name on first delta, arguments concatenated across deltas).
export function accumulateOpenAI() {
  let text = ''
  const calls = [] // by index: { id, name, args: '' }
  return {
    push(ev) {
      const d = ev.choices?.[0]?.delta
      if (!d) return
      if (d.content) text += d.content
      for (const tc of d.tool_calls ?? []) {
        const i = tc.index ?? 0
        calls[i] ??= { id: tc.id, name: tc.function?.name, args: '' }
        if (tc.id) calls[i].id = tc.id
        if (tc.function?.name) calls[i].name = tc.function.name
        if (tc.function?.arguments) calls[i].args += tc.function.arguments
      }
    },
    result() {
      return { text, toolCalls: calls.filter(Boolean).map(c => ({ id: c.id, name: c.name, args: parseArgs(c.args) })) }
    },
  }
}

// Anthropic: content blocks by index. text_delta -> text; tool_use block (content_block_start)
// then input_json_delta fragments -> args JSON.
export function accumulateClaude() {
  let text = ''
  const blocks = {} // index -> { id, name, args: '' }
  return {
    push(ev) {
      if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
        blocks[ev.index] = { id: ev.content_block.id, name: ev.content_block.name, args: '' }
      } else if (ev.type === 'content_block_delta') {
        if (ev.delta?.type === 'text_delta') text += ev.delta.text
        else if (ev.delta?.type === 'input_json_delta' && blocks[ev.index]) blocks[ev.index].args += ev.delta.partial_json
      }
    },
    result() {
      return { text, toolCalls: Object.values(blocks).map(b => ({ id: b.id, name: b.name, args: parseArgs(b.args) })) }
    },
  }
}

// Gemini: candidates[].content.parts — text parts and whole functionCall parts (no arg streaming).
export function accumulateGemini() {
  let text = ''
  const calls = []
  return {
    push(ev) {
      for (const p of ev.candidates?.[0]?.content?.parts ?? []) {
        if (p.text) text += p.text
        if (p.functionCall) calls.push({ id: `${p.functionCall.name}_${calls.length}`, name: p.functionCall.name, args: p.functionCall.args ?? {} })
      }
    },
    result() { return { text, toolCalls: calls } },
  }
}
