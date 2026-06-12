// src/components/Tabs/ChatTab.jsx
import { useState, useContext } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { useAgent } from '../../hooks/useAgent'
import { getHistory, clearHistory } from '../../lib/storage/chat'
import ChatMessages from '../Chat/ChatMessages'
import ChatInput from '../Chat/ChatInput'
import ChatToolbar from '../shared/ChatToolbar'

export default function ChatTab() {
  const { activeProfile } = useContext(ProfilesContext)
  const { send, busy, error, toolEvent } = useAgent(activeProfile, 'chat')
  const [messages, setMessages] = useState(() =>
    activeProfile ? getHistory(activeProfile.id, 'chat') : []
  )
  const [streamingContent, setStreamingContent] = useState('')

  const handleSend = async userMessage => {
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setStreamingContent('')
    try {
      await send({ userMessage, onText: t => setStreamingContent(t) })
      setMessages(activeProfile ? getHistory(activeProfile.id, 'chat') : [])
      setStreamingContent('')
    } catch {
      setStreamingContent('')
    }
  }

  const reload = () => setMessages(activeProfile ? getHistory(activeProfile.id, 'chat') : [])
  const clearChat = () => { clearHistory(activeProfile.id, 'chat'); setMessages([]) }

  if (!activeProfile) return <div className="flex-1 flex items-center justify-center text-muted text-sm">No profile selected</div>

  return (
    <div className="flex flex-col h-full">
      <ChatToolbar title="Chat" onRefresh={reload} onClear={clearChat}
        refreshDisabled={busy} clearDisabled={busy || messages.length === 0} />
      <ChatMessages messages={messages} streaming={busy} streamingContent={streamingContent} />
      {busy && toolEvent && (
        <p className="px-4 py-1.5 text-xs text-primary bg-primary-light/40 border-t border-border flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Using <span className="font-mono">{toolEvent.name}</span>…
        </p>
      )}
      {error && <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-t border-red-100">{error}</p>}
      <ChatInput onSend={handleSend} disabled={busy} placeholder="Ask your astrologer anything..." />
    </div>
  )
}
