// src/components/Tabs/ChatTab.jsx
import { useContext } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { useAgent } from '../../hooks/useAgent'
import { useChatThread } from '../../hooks/useChatThread'
import { useReportBusy } from '../../contexts/BusyContext'
import ChatMessages from '../Chat/ChatMessages'
import ChatGreeting from '../Chat/ChatGreeting'
import ChatInput from '../Chat/ChatInput'
import ChatToolbar from '../shared/ChatToolbar'
import { toolLabelActive } from '../../lib/llm/toolLabels'

export default function ChatTab() {
  const { activeProfile } = useContext(ProfilesContext)
  const { send, stop, busy, error, toolEvent, liveTools } = useAgent(activeProfile, 'chat')
  useReportBusy(busy)
  const { messages, streamingContent, reload, clearChat, submit } = useChatThread(activeProfile, 'chat')

  const handleSend = userMessage =>
    submit(userMessage, ({ onText }) => send({ userMessage, onText }))

  if (!activeProfile) return <div className="flex-1 flex items-center justify-center text-muted text-sm">No profile selected</div>

  return (
    <div className="flex flex-col h-full">
      <ChatToolbar title="Chat" onRefresh={reload} onClear={clearChat}
        refreshDisabled={busy} clearDisabled={busy || messages.length === 0} />
      <ChatMessages messages={messages} streaming={busy} streamingContent={streamingContent} streamingTools={liveTools}
        emptyState={<ChatGreeting name={activeProfile.name} />} />
      {busy && toolEvent && (
        <p className="px-4 py-2 text-xs font-medium text-primary bg-primary-light/50 border-t border-border flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
          {toolLabelActive(toolEvent.name)}…
        </p>
      )}
      {error && <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-t border-red-100">{error}</p>}
      <ChatInput onSend={handleSend} busy={busy} onStop={stop} placeholder="Ask your astrologer anything..." />
    </div>
  )
}
