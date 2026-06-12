import { useState, useCallback } from 'react'
import { runAgent, providerSupportsTools } from '../lib/llm/agent'
import { getApiKey } from '../lib/storage/keys'
import { appendMessage, getHistory } from '../lib/storage/chat'
import { buildSystemPrompt } from '../lib/prompts/soul'

const TOOL_GUIDANCE = `
# Tools
You can call tools to compute and look things up. Use them whenever the answer depends on
astrological data — never guess or fabricate placements, scores, transits, or numbers.
- get_chart / list_profiles — read a saved person's chart or see who's available
- get_today_transit — current transits for the active profile
- match_profiles — Kundali Match / compatibility between two saved people
- compute_numerology — numerology from a name + DOB
- geocode_place + compute_chart — compute a fresh chart for someone not saved
- web_search — factual/encyclopedic lookups
Call tools when needed, then answer in plain English. If a tool errors, explain what you need.
`

export function useAgent(profile, tab) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [toolEvent, setToolEvent] = useState(null)

  const send = useCallback(async ({ userMessage, onText }) => {
    const keyData = getApiKey()
    if (!keyData) throw new Error('No API key configured')
    if (!profile) throw new Error('No active profile')

    const systemPrompt = buildSystemPrompt(profile) + '\n\n' + TOOL_GUIDANCE
    const history = getHistory(profile.id, tab)

    appendMessage(profile.id, tab, { role: 'user', content: userMessage })
    setBusy(true)
    setError(null)
    setToolEvent(null)

    try {
      const text = await runAgent({
        provider: keyData.provider,
        key: keyData.key,
        baseUrl: keyData.baseUrl,
        model: keyData.model,
        systemPrompt,
        userMessage,
        history,
        onText,
        onToolEvent: e => setToolEvent(e.status === 'done' ? null : e),
      })
      appendMessage(profile.id, tab, { role: 'assistant', content: text })
      return text
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setBusy(false)
      setToolEvent(null)
    }
  }, [profile, tab])

  return { send, busy, error, toolEvent, supportsTools: providerSupportsTools(getApiKey()?.provider) }
}
