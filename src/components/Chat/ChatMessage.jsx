import ToolChips from './ToolChips'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}>
      {/* Tools the agent called for this answer */}
      <ToolChips tools={message.tools} />
      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        isUser ? 'bg-user-bubble text-text rounded-br-sm' : 'bg-surface border border-border text-text rounded-bl-sm'
      }`}>
        {message.content}
      </div>
    </div>
  )
}
