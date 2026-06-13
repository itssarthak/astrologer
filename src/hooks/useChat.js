import { useState, useCallback, useRef, useMemo } from 'react'
import { runAgent, providerSupportsTools } from '../lib/llm/agent'
import { getApiKey } from '../lib/storage/keys'
import { useApiKey } from './useApiKey'
import { appendMessage, getHistory } from '../lib/storage/chat'
import { buildSystemPrompt } from '../lib/prompts/soul'
import { enabledToolsFor, instructionFor, TOOL_GUIDANCE } from '../lib/llm/tabConfig'
import { trackEvent } from '../lib/analytics'

export function useChat(profile, tab) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [toolEvent, setToolEvent] = useState(null)
  const [liveTools, setLiveTools] = useState([])
  const abortRef = useRef(null)

  const send = useCallback(async ({ userMessage, extraContext = '', onChunk }) => {
    const keyData = getApiKey()
    if (!keyData) throw new Error('No API key configured')
    if (!profile) throw new Error('No active profile')

    const tools = enabledToolsFor(tab)
    const base = buildSystemPrompt(profile)
    const guidance = tools.length ? `\n\n${TOOL_GUIDANCE}` : ''
    const systemPrompt = `${base}${guidance}\n\n# This view\n${instructionFor(tab)}${extraContext ? `\n\n${extraContext}` : ''}`
    const history = getHistory(profile.id, tab)

    appendMessage(profile.id, tab, { role: 'user', content: userMessage })
    const controller = new AbortController()
    abortRef.current = controller
    const usedTools = []
    setBusy(true); setError(null); setToolEvent(null); setLiveTools([])

    let streamed = ''
    try {
      const text = await runAgent({
        provider: keyData.provider, key: keyData.key, baseUrl: keyData.baseUrl, model: keyData.model,
        systemPrompt, userMessage, history, tools,
        onDelta: chunk => { streamed += chunk; onChunk?.(chunk) },
        onToolEvent: e => {
          if (e.status === 'running' && !usedTools.includes(e.name)) { usedTools.push(e.name); setLiveTools([...usedTools]) }
          setToolEvent(e.status === 'done' ? null : e)
        },
        signal: controller.signal,
      })
      appendMessage(profile.id, tab, { role: 'assistant', content: text, tools: usedTools.length ? usedTools : undefined })
      return text
    } catch (err) {
      if (err.name === 'AbortError') {
        if (streamed) appendMessage(profile.id, tab, { role: 'assistant', content: streamed, tools: usedTools.length ? usedTools : undefined })
        return streamed
      }
      setError(err.message)
      trackEvent('chat_error', { provider: keyData.provider })
      throw err
    } finally {
      setBusy(false); setToolEvent(null); setLiveTools([]); abortRef.current = null
    }
  }, [profile, tab])

  const stop = useCallback(() => abortRef.current?.abort(), [])
  const keyData = useApiKey()
  const supportsTools = useMemo(() => providerSupportsTools(keyData?.provider), [keyData?.provider])

  // `streaming` aliases `busy` for tabs that read a `streaming` flag.
  return { send, stop, busy, streaming: busy, error, toolEvent, liveTools, supportsTools }
}
