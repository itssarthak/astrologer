// src/components/Tabs/ChatTab.jsx
import { useState, useContext } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { useLLM } from '../../hooks/useLLM'
import { getHistory } from '../../lib/storage/chat'
import ChatMessages from '../Chat/ChatMessages'
import ChatInput from '../Chat/ChatInput'

export default function ChatTab() {
  const { activeProfile } = useContext(ProfilesContext)
  const { send, streaming, error } = useLLM(activeProfile, 'chat')
  const [messages, setMessages] = useState(() =>
    activeProfile ? getHistory(activeProfile.id, 'chat') : []
  )
  const [streamingContent, setStreamingContent] = useState('')

  const handleSend = async userMessage => {
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setStreamingContent('')
    try {
      await send({
        userMessage,
        onChunk: chunk => setStreamingContent(prev => prev + chunk),
      })
      setMessages(activeProfile ? getHistory(activeProfile.id, 'chat') : [])
      setStreamingContent('')
    } catch {
      setStreamingContent('')
    }
  }

  if (!activeProfile) return <div className="flex-1 flex items-center justify-center text-muted text-sm">No profile selected</div>

  return (
    <div className="flex flex-col h-full">
      <ChatMessages messages={messages} streaming={streaming} streamingContent={streamingContent} />
      {error && <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-t border-red-100">{error}</p>}
      <ChatInput onSend={handleSend} disabled={streaming} placeholder="Ask your astrologer anything..." />
    </div>
  )
}
