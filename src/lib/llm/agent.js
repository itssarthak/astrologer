// Agentic chat loop. The model is given the tool schemas; each round it either returns a
// final answer or asks to call tools. We execute the tools in the browser, feed results
// back, and loop until it answers (or we hit maxRounds). Per-provider adapters translate a
// neutral conversation log to/from each API's native tool-use format.
import { resolveProviderConfig } from './providers'
import { readSSE, accumulateOpenAI, accumulateClaude, accumulateGemini } from './sse'

const MAX_TOOL_RESULT_CHARS = 6000
// Final-answer rounds (after tools) often write a full interpretation; 2048 truncated them.
const MAX_ANSWER_TOKENS = 4096

// ── OpenAI-compatible (OpenAI / OpenRouter / Custom) ──────────────────────────────
function toOpenAIMessages(systemPrompt, log) {
  const out = [{ role: 'system', content: systemPrompt }]
  for (const e of log) {
    if (e.type === 'text') out.push({ role: e.role, content: e.content })
    else if (e.type === 'tool_calls') out.push({
      role: 'assistant',
      content: e.assistantText || null,
      tool_calls: e.toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.args ?? {}) } })),
    })
    else if (e.type === 'tool_results') for (const r of e.results) out.push({ role: 'tool', tool_call_id: r.id, content: r.content })
  }
  return out
}

async function runOpenAIRound({ key, baseUrl, model, systemPrompt, log, signal, toolSchemas = [], onDelta }) {
  const endpoint = `${(baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`
  const resp = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      messages: toOpenAIMessages(systemPrompt, log),
      ...(toolSchemas.length
        ? { tools: toolSchemas.map(s => ({ type: 'function', function: s })), tool_choice: 'auto' }
        : {}),
      max_tokens: MAX_ANSWER_TOKENS,
      stream: true,
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `LLM error ${resp.status}`)
  }
  const acc = accumulateOpenAI()
  let last = ''
  await readSSE(resp, ev => {
    acc.push(ev)
    const { text } = acc.result()
    if (text !== last) { onDelta?.(text.slice(last.length)); last = text }
  }, signal)
  return acc.result()
}

// ── Anthropic (Claude) ────────────────────────────────────────────────────────────
function toClaudeMessages(log) {
  return log.map(e => {
    if (e.type === 'text') return { role: e.role, content: e.content }
    if (e.type === 'tool_calls') {
      const content = []
      if (e.assistantText) content.push({ type: 'text', text: e.assistantText })
      for (const tc of e.toolCalls) content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args ?? {} })
      return { role: 'assistant', content }
    }
    // tool_results -> a single user turn with tool_result blocks
    return { role: 'user', content: e.results.map(r => ({ type: 'tool_result', tool_use_id: r.id, content: r.content })) }
  })
}

async function runClaudeRound({ key, model, systemPrompt, log, signal, toolSchemas = [], onDelta }) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-6',
      max_tokens: MAX_ANSWER_TOKENS,
      // Cache the system prompt — the agentic loop re-sends it every round, so caching it
      // meaningfully cuts cost + latency across the tool-call rounds.
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: toClaudeMessages(log),
      ...(toolSchemas.length
        ? { tools: toolSchemas.map(s => ({ name: s.name, description: s.description, input_schema: s.parameters })) }
        : {}),
      stream: true,
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Claude error ${resp.status}`)
  }
  const acc = accumulateClaude()
  let last = ''
  await readSSE(resp, ev => {
    acc.push(ev)
    const { text } = acc.result()
    if (text !== last) { onDelta?.(text.slice(last.length)); last = text }
  }, signal)
  return acc.result()
}

// ── Gemini ──────────────────────────────────────────────────────────────────────
function toGeminiContents(log) {
  return log.map(e => {
    if (e.type === 'text') return { role: e.role === 'assistant' ? 'model' : 'user', parts: [{ text: e.content }] }
    if (e.type === 'tool_calls') {
      const parts = []
      if (e.assistantText) parts.push({ text: e.assistantText })
      for (const tc of e.toolCalls) parts.push({ functionCall: { name: tc.name, args: tc.args ?? {} } })
      return { role: 'model', parts }
    }
    return { role: 'user', parts: e.results.map(r => ({ functionResponse: { name: r.name, response: { result: r.content } } })) }
  })
}

async function runGeminiRound({ key, model, systemPrompt, log, signal, toolSchemas = [], onDelta }) {
  const m = model || 'gemini-2.0-flash'
  // Key goes in the header, not the query string — query strings leak into history/proxy logs.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse`
  const resp = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: toGeminiContents(log),
      ...(toolSchemas.length
        ? { tools: [{ functionDeclarations: toolSchemas.map(s => ({ name: s.name, description: s.description, parameters: s.parameters })) }] }
        : {}),
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Gemini error ${resp.status}`)
  }
  // Gemini matches functionResponse blocks to calls by name + order (it has no call ids), so the
  // accumulator keeps response order identical to call order. The synthetic id is for bookkeeping.
  const acc = accumulateGemini()
  let last = ''
  await readSSE(resp, ev => {
    acc.push(ev)
    const { text } = acc.result()
    if (text !== last) { onDelta?.(text.slice(last.length)); last = text }
  }, signal)
  return acc.result()
}

const RUNNERS = {
  claude: runClaudeRound,
  openai: runOpenAIRound,
  openrouter: runOpenAIRound,
  custom: runOpenAIRound,
  gemini: runGeminiRound,
}

export function providerSupportsTools(provider) {
  return provider in RUNNERS
}

/**
 * Run the agentic loop. Returns the final assistant text.
 * @param {{provider,key,baseUrl?,model?,systemPrompt,userMessage,history?,tools?,onText?,onDelta?,onToolEvent?,signal?,maxRounds?}} opts
 */
export async function runAgent({ provider, key, baseUrl, model, systemPrompt, userMessage, history = [], tools = [], onText, onDelta, onToolEvent, signal, maxRounds = 6 }) {
  const runner = RUNNERS[provider]
  if (!runner) throw new Error(`No agent runner for provider: ${provider}`)

  const toolSchemas = tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters }))
  const byName = Object.fromEntries(tools.map(t => [t.name, t]))

  const { baseUrl: resolvedBaseUrl, model: resolvedModel } = resolveProviderConfig(provider, { baseUrl, model })

  const log = [
    ...history.map(m => ({ type: 'text', role: m.role, content: m.content })),
    { type: 'text', role: 'user', content: userMessage },
  ]

  for (let round = 0; round < maxRounds; round++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const { text, toolCalls } = await runner({ key, baseUrl: resolvedBaseUrl, model: resolvedModel, systemPrompt, log, signal, toolSchemas, onDelta })

    if (!toolCalls || toolCalls.length === 0) {
      onText?.(text || '')
      return text || ''
    }

    log.push({ type: 'tool_calls', toolCalls, assistantText: text })
    const results = []
    for (const tc of toolCalls) {
      onToolEvent?.({ name: tc.name, status: 'running' })
      let content
      try {
        const tool = byName[tc.name]
        if (!tool) throw new Error(`unknown tool ${tc.name}`)
        if (tc.args?.__invalidArgs !== undefined) {
          throw new Error(`could not parse the arguments you sent for ${tc.name} — resend them as valid JSON`)
        }
        const out = await tool.execute(tc.args ?? {}, { signal })
        content = typeof out === 'string' ? out : JSON.stringify(out)
      } catch (err) {
        if (err.name === 'AbortError') throw err // user stopped — bubble up, don't feed back as a tool error
        content = `Error: ${err.message}`
      }
      if (content.length > MAX_TOOL_RESULT_CHARS) content = content.slice(0, MAX_TOOL_RESULT_CHARS) + '…(truncated)'
      results.push({ id: tc.id, name: tc.name, content })
      onToolEvent?.({ name: tc.name, status: 'done' })
    }
    log.push({ type: 'tool_results', results })
  }

  const msg = 'I couldn’t finish that in a reasonable number of steps — try narrowing the question.'
  onText?.(msg)
  return msg
}
