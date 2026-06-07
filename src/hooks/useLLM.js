import { useState, useCallback } from 'react'
import { chat } from '../lib/llm/index'
import { getApiKey } from '../lib/storage/keys'
import { appendMessage, getHistory } from '../lib/storage/chat'
import { buildSystemPrompt } from '../lib/prompts/soul'

export function useLLM(profile, tab) {
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)

  const send = useCallback(async ({ userMessage, extraContext = '' }) => {
    const keyData = getApiKey()
    if (!keyData) throw new Error('No API key configured')
    if (!profile) throw new Error('No active profile')

    const systemPrompt = buildSystemPrompt(profile) + (extraContext ? `\n\n${extraContext}` : '')
    const history = getHistory(profile.id, tab)

    appendMessage(profile.id, tab, { role: 'user', content: userMessage })
    const messages = [...history, { role: 'user', content: userMessage }]

    setStreaming(true)
    setError(null)
    let fullResponse = ''

    try {
      await chat({
        provider: keyData.provider,
        key: keyData.key,
        messages,
        systemPrompt,
        onChunk: chunk => { fullResponse += chunk },
      })
      appendMessage(profile.id, tab, { role: 'assistant', content: fullResponse })
      return fullResponse
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setStreaming(false)
    }
  }, [profile, tab])

  return { send, streaming, error }
}
