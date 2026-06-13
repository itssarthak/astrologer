// Agentic chat loop. The model is given the tool schemas; each round it either returns a
// final answer or asks to call tools. We execute the tools in the browser, feed results
// back, and loop until it answers (or we hit maxRounds). Per-provider adapters translate a
// neutral conversation log to/from each API's native tool-use format.
import { TOOL_SCHEMAS, TOOLS_BY_NAME } from './tools'
import { resolveProviderConfig } from './providers'

const MAX_TOOL_RESULT_CHARS = 6000
// Final-answer rounds (after tools) often write a full interpretation; 2048 truncated them.
const MAX_ANSWER_TOKENS = 4096

// Parse tool-call arguments. On malformed JSON we return a sentinel (rather than silently
// using {}) so the dispatch loop can feed a clear error back to the model.
function safeJSON(s) {
  if (s && typeof s === 'object') return s
  try { return JSON.parse(s || '{}') } catch { return { __invalidArgs: String(s) } }
}

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

async function runOpenAIRound({ key, baseUrl, model, systemPrompt, log, signal }) {
  const endpoint = `${(baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`
  const resp = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      messages: toOpenAIMessages(systemPrompt, log),
      tools: TOOL_SCHEMAS.map(s => ({ type: 'function', function: s })),
      tool_choice: 'auto',
      max_tokens: MAX_ANSWER_TOKENS,
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `LLM error ${resp.status}`)
  }
  const msg = (await resp.json()).choices?.[0]?.message ?? {}
  const toolCalls = (msg.tool_calls ?? []).map(tc => ({ id: tc.id, name: tc.function?.name, args: safeJSON(tc.function?.arguments) }))
  return { text: msg.content || '', toolCalls }
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

async function runClaudeRound({ key, model, systemPrompt, log, signal }) {
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
      system: systemPrompt,
      messages: toClaudeMessages(log),
      tools: TOOL_SCHEMAS.map(s => ({ name: s.name, description: s.description, input_schema: s.parameters })),
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Claude error ${resp.status}`)
  }
  const blocks = (await resp.json()).content ?? []
  const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('')
  const toolCalls = blocks.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, args: b.input ?? {} }))
  return { text, toolCalls }
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

async function runGeminiRound({ key, model, systemPrompt, log, signal }) {
  const m = model || 'gemini-2.0-flash'
  // Key goes in the header, not the query string — query strings leak into history/proxy logs.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`
  const resp = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: toGeminiContents(log),
      tools: [{ functionDeclarations: TOOL_SCHEMAS.map(s => ({ name: s.name, description: s.description, parameters: s.parameters })) }],
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Gemini error ${resp.status}`)
  }
  const parts = (await resp.json()).candidates?.[0]?.content?.parts ?? []
  const text = parts.filter(p => p.text).map(p => p.text).join('')
  // Gemini matches functionResponse blocks to calls by name + order (it has no call ids), so we
  // keep response order identical to call order in toGeminiContents. The synthetic id is for our
  // own bookkeeping only.
  const toolCalls = parts
    .filter(p => p.functionCall)
    .map((p, i) => ({ id: `${p.functionCall.name}_${i}`, name: p.functionCall.name, args: p.functionCall.args ?? {} }))
  return { text, toolCalls }
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
 * @param {{provider,key,baseUrl?,model?,systemPrompt,userMessage,history?,onText?,onToolEvent?,maxRounds?}} opts
 */
export async function runAgent({ provider, key, baseUrl, model, systemPrompt, userMessage, history = [], onText, onToolEvent, signal, maxRounds = 6 }) {
  const runner = RUNNERS[provider]
  if (!runner) throw new Error(`No agent runner for provider: ${provider}`)

  const { baseUrl: resolvedBaseUrl, model: resolvedModel } = resolveProviderConfig(provider, { baseUrl, model })

  const log = [
    ...history.map(m => ({ type: 'text', role: m.role, content: m.content })),
    { type: 'text', role: 'user', content: userMessage },
  ]

  for (let round = 0; round < maxRounds; round++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const { text, toolCalls } = await runner({ key, baseUrl: resolvedBaseUrl, model: resolvedModel, systemPrompt, log, signal })

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
        const tool = TOOLS_BY_NAME[tc.name]
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
