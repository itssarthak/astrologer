import { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage'
import ToolChips from './ToolChips'
import Markdown from './Markdown'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function ChatMessages({ messages, streaming, streamingContent = '', streamingTools = [], emptyState = null }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, streamingTools])

  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4">
      {/* Greeting before any conversation — only when nothing has been said and nothing is streaming */}
      {messages.length === 0 && !streaming && emptyState}
      {messages.map((msg, i) => <ChatMessage key={msg.id ?? i} message={msg} />)}
      {streaming && (
        <div className="flex flex-col items-start gap-1">
          {/* Tools shown live as the agent calls them, before the completion arrives */}
          <ToolChips tools={streamingTools} />
          {streamingContent ? (
            <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm text-sm leading-relaxed bg-surface border border-border text-text">
              <Markdown>{streamingContent}</Markdown>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-surface border border-border">
              <LoadingSpinner size="sm" />
            </div>
          )}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
