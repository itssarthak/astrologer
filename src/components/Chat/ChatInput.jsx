import { useState, useRef } from 'react'

export default function ChatInput({ onSend, disabled, busy = false, onStop, placeholder = 'Ask a question...' }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  const handleSend = () => {
    const msg = value.trim()
    if (!msg || disabled || busy) return
    onSend(msg)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = e => {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <div className="flex gap-2 p-3 border-t border-border bg-surface">
      <textarea ref={textareaRef} value={value} onChange={handleInput} onKeyDown={handleKeyDown}
        placeholder={placeholder} rows={1} disabled={disabled}
        className="flex-1 resize-none overflow-hidden rounded-xl border border-border bg-white px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-primary disabled:opacity-50" />
      {busy && onStop ? (
        <button onClick={onStop}
          className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-white" />
          Stop
        </button>
      ) : (
        <button onClick={handleSend} disabled={disabled || busy || !value.trim()}
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          Send
        </button>
      )}
    </div>
  )
}
