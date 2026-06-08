export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        isUser ? 'bg-user-bubble text-text rounded-br-sm' : 'bg-surface border border-border text-text rounded-bl-sm'
      }`}>
        {message.content}
      </div>
    </div>
  )
}
