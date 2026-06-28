// src/components/Tabs/ChatTab.jsx
import { useContext, useState, useCallback } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { useChat } from '../../hooks/useChat'
import { useChatThread } from '../../hooks/useChatThread'
import { useReportBusy } from '../../contexts/BusyContext'
import ChatMessages from '../Chat/ChatMessages'
import ChatGreeting from '../Chat/ChatGreeting'
import ChatInput from '../Chat/ChatInput'
import ChatToolbar from '../shared/ChatToolbar'
import ChartPanel from '../Kundli/ChartPanel'
import TemplatePrompts from '../Chat/TemplatePrompts'
import { toolLabelActive } from '../../lib/llm/toolLabels'

export default function ChatTab() {
  const { activeProfile } = useContext(ProfilesContext)
  const { send, stop, busy, error, toolEvent, liveTools } = useChat(activeProfile, 'chat')
  useReportBusy(busy)
  const { messages, streamingContent, reload, clearChat, submit } = useChatThread(activeProfile, 'chat')

  // Right-side chart panel: collapsible (desktop) / above-chat section (mobile).
  const [chartOpen, setChartOpen] = useState(true)
  // A tapped template prompt that REPLACES the input. A fresh {text} object each tap so
  // re-picking the same chip re-fills.
  const [promptFill, setPromptFill] = useState(undefined)

  const handleSend = useCallback(async userMessage => {
    await submit(userMessage, async ({ onChunk }) => { await send({ userMessage, onChunk }) })
  }, [submit, send])

  // Template chip pick = fill the input (no auto-send).
  const handlePickPrompt = useCallback(text => setPromptFill({ text }), [])

  if (!activeProfile) return <div className="flex-1 flex items-center justify-center text-muted text-sm">No profile selected</div>

  const hasChart = !!activeProfile.chart
  const emptyState = (
    <div className="flex flex-col items-start gap-1">
      <ChatGreeting name={activeProfile.name} />
      <TemplatePrompts onPick={handlePickPrompt} />
    </div>
  )

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0">
      {/* Chart panel: above chat on mobile, right column on desktop. Collapsible. */}
      {hasChart && chartOpen && (
        <div className="order-first md:order-last flex-shrink-0 border-b md:border-b-0 md:border-l border-border bg-surface
                        max-h-[40%] md:max-h-none md:h-full md:w-[340px] overflow-y-auto">
          <ChartPanel profile={activeProfile} />
        </div>
      )}

      {/* Chat column */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <ChatToolbar title="Chat" onRefresh={reload} onClear={clearChat}
          refreshDisabled={busy} clearDisabled={busy || messages.length === 0}
          extraControls={hasChart && (
            <button onClick={() => setChartOpen(o => !o)} title={chartOpen ? 'Hide chart' : 'Show chart'}
              aria-label={chartOpen ? 'Hide chart' : 'Show chart'} aria-pressed={chartOpen}
              className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors">
              <span aria-hidden="true">{chartOpen ? '🪐' : '☆'}</span>
            </button>
          )} />
        <ChatMessages messages={messages} streaming={busy} streamingContent={streamingContent} streamingTools={liveTools}
          emptyState={emptyState} />
        {busy && toolEvent && (
          <p className="px-4 py-2 text-xs font-medium text-primary bg-primary-light/50 border-t border-border flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
            {toolLabelActive(toolEvent.name)}…
          </p>
        )}
        {error && <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-t border-red-100">{error}</p>}
        <ChatInput onSend={handleSend} busy={busy} onStop={stop} placeholder="Ask your astrologer anything..."
          replaceText={promptFill} />
      </div>
    </div>
  )
}
