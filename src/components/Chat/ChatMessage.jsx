import ToolChips from './ToolChips'
import Markdown from './Markdown'

export default function ChatMessage({ message, onSpeak, onStopSpeak, isSpeaking = false }) {
  const isUser = message.role === 'user'
  // Per-message play button: assistant messages only, and only when wired with onSpeak.
  const canSpeak = !isUser && typeof onSpeak === 'function' && message.content

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
      {canSpeak && (
        <button
          onClick={() => (isSpeaking ? onStopSpeak?.() : onSpeak(message.content))}
          title={isSpeaking ? 'Stop' : 'Read aloud'}
          className="text-xs text-muted hover:text-primary transition-colors px-1">
          {isSpeaking ? '⏹' : '🔊'}
        </button>
      )}
    </div>
  )
}
