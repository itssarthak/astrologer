import ToolChips from './ToolChips'
import Markdown from './Markdown'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}>
      {/* Tools the agent called for this answer */}
      <ToolChips tools={message.tools} />
      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? 'bg-user-bubble text-text rounded-br-sm whitespace-pre-wrap'
          : 'bg-surface border border-border text-text rounded-bl-sm'
      }`}>
        {isUser ? message.content : <Markdown>{message.content}</Markdown>}
      </div>
    </div>
  )
}
