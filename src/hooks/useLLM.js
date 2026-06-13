import { useState, useCallback, useRef } from 'react'
import { chat } from '../lib/llm/index'
import { getApiKey } from '../lib/storage/keys'
import { appendMessage, getHistory } from '../lib/storage/chat'
import { buildSystemPrompt } from '../lib/prompts/soul'
import { trackEvent } from '../lib/analytics'

export function useLLM(profile, tab) {
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const send = useCallback(async ({ userMessage, extraContext = '', onChunk }) => {
    const keyData = getApiKey()
    if (!keyData) throw new Error('No API key configured')
    if (!profile) throw new Error('No active profile')

    const systemPrompt = buildSystemPrompt(profile) + (extraContext ? `\n\n${extraContext}` : '')
    const history = getHistory(profile.id, tab)

    appendMessage(profile.id, tab, { role: 'user', content: userMessage })
    // Send only role/content — stored messages carry an `id` (and chat tabs may carry `tools`)
    // that providers must not receive.
    const messages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ]

    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)
    setError(null)
    let fullResponse = ''

    try {
      await chat({
        provider: keyData.provider,
        key: keyData.key,
        baseUrl: keyData.baseUrl,
        model: keyData.model,
        messages,
        systemPrompt,
        signal: controller.signal,
        onChunk: chunk => {
          fullResponse += chunk
          onChunk?.(chunk)
        },
      })
      appendMessage(profile.id, tab, { role: 'assistant', content: fullResponse })
      return fullResponse
    } catch (err) {
      if (err.name === 'AbortError') {
        // Stopped by the user — keep whatever streamed so far, no error.
        if (fullResponse) appendMessage(profile.id, tab, { role: 'assistant', content: fullResponse })
        return fullResponse
      }
      setError(err.message)
      trackEvent('llm_error', { where: tab })
      throw err
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [profile, tab])

  const stop = useCallback(() => abortRef.current?.abort(), [])

  return { send, streaming, error, stop }
}
