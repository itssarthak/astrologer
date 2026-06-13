import { toolLabel } from '../../lib/llm/toolLabels'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  const tools = message.tools ?? []

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}>
      {/* Tools the agent called for this answer */}
      {tools.length > 0 && (
        <div className="flex flex-wrap gap-1 max-w-[85%]">
          {tools.map((name, i) => (
            <span key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-light/60 border border-primary/20 text-primary text-[11px] font-medium">
              🔧 {toolLabel(name)}
            </span>
          ))}
        </div>
      )}
      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        isUser ? 'bg-user-bubble text-text rounded-br-sm' : 'bg-surface border border-border text-text rounded-bl-sm'
      }`}>
        {message.content}
      </div>
    </div>
  )
}
