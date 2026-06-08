// src/components/Tabs/NumbersTab.jsx
import { useState, useContext } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { useLLM } from '../../hooks/useLLM'
import { getHistory } from '../../lib/storage/chat'
import { formatNumerologyContext } from '../../lib/prompts/formatters'
import ChatMessages from '../Chat/ChatMessages'
import ChatInput from '../Chat/ChatInput'

const NUM_LABELS = {
  life_path: 'Life Path',
  destiny: 'Destiny',
  soul_urge: 'Soul Urge',
  personality: 'Personality',
  personal_year: 'Personal Year',
}

export default function NumbersTab() {
  const { activeProfile } = useContext(ProfilesContext)
  const { send, streaming, error } = useLLM(activeProfile, 'numbers')
  const [messages, setMessages] = useState(() =>
    activeProfile ? getHistory(activeProfile.id, 'numbers') : []
  )
  const [streamingContent, setStreamingContent] = useState('')

  const numerology = activeProfile?.numerology

  const handleSend = async userMessage => {
    const extraContext = numerology ? formatNumerologyContext(numerology) : ''
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setStreamingContent('')
    try {
      await send({ userMessage, extraContext, onChunk: chunk => setStreamingContent(prev => prev + chunk) })
      setMessages(getHistory(activeProfile.id, 'numbers'))
      setStreamingContent('')
    } catch {
      setStreamingContent('')
    }
  }

  if (!activeProfile) return <div className="flex-1 flex items-center justify-center text-muted text-sm">No profile selected</div>

  return (
    <div className="flex flex-col h-full">
      {numerology && (
        <div className="p-4 border-b border-border">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Numerology Profile</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(NUM_LABELS).map(([key, label]) => {
              const chaldean = numerology.chaldean?.[key]
              const pythagorean = numerology.pythagorean?.[key]
              return (
                <div key={key} className="bg-surface border border-border rounded-xl p-3 flex flex-col gap-1">
                  <span className="text-xs text-muted">{label}</span>
                  <span className="text-2xl font-bold text-primary">{chaldean ?? '—'}</span>
                  {pythagorean && pythagorean !== chaldean && (
                    <span className="text-xs text-muted">Pyth: {pythagorean}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      <ChatMessages messages={messages} streaming={streaming} streamingContent={streamingContent} />
      {error && <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-t border-red-100">{error}</p>}
      <ChatInput onSend={handleSend} disabled={streaming} placeholder="Ask about your numbers..." />
    </div>
  )
}
