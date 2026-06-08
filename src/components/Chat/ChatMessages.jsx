import { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function ChatMessages({ messages, streaming, streamingContent = '' }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4">
      {messages.map((msg, i) => <ChatMessage key={i} message={msg} />)}
      {streaming && streamingContent && (
        <div className="flex justify-start">
          <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm text-sm leading-relaxed bg-surface border border-border text-text whitespace-pre-wrap">
            {streamingContent}
          </div>
        </div>
      )}
      {streaming && !streamingContent && (
        <div className="flex justify-start">
          <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-surface border border-border">
            <LoadingSpinner size="sm" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
