import { useState, useRef, useEffect } from 'react'
import { MicIcon } from './VoiceIcons'

export default function ChatInput({
  onSend, disabled, busy = false, onStop, placeholder = 'Ask a question...',
  // Optional manual push-to-talk mic. Rendered only when micSupported.
  micSupported = false, listening = false, interim = '', onMicToggle,
  // When set (changes), its value is injected into the textarea (final transcript review).
  injectText,
}) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  // Inject a final transcript from the caller (e.g. manual mic result) for the user to review.
  const lastInject = useRef(undefined)
  useEffect(() => {
    if (injectText !== undefined && injectText !== lastInject.current) {
      lastInject.current = injectText
      if (injectText) setValue(prev => (prev ? prev + ' ' : '') + injectText)
    }
  }, [injectText])

  // Esc stops an in-flight reply from anywhere on the page (not only the textarea).
  useEffect(() => {
    if (!busy || !onStop) return
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); onStop() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onStop])

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

  const effectivePlaceholder = listening ? (interim || 'Listening…') : placeholder

  return (
    <div className="flex gap-2 p-3 border-t border-border bg-surface">
      {micSupported && onMicToggle && (
        <button onClick={onMicToggle} disabled={disabled || busy}
          title={listening ? 'Stop listening' : 'Speak'} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Speak'}
          className={`relative grid place-items-center w-10 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            listening
              ? 'bg-red-500 text-white'
              : 'bg-surface border border-border text-muted hover:text-primary hover:border-primary'
          }`}>
          {listening && <span className="absolute inset-0 rounded-xl bg-red-500/40 animate-ping" />}
          <MicIcon className="relative w-5 h-5" active={listening} />
        </button>
      )}
      <textarea ref={textareaRef} value={value} onChange={handleInput} onKeyDown={handleKeyDown}
        placeholder={effectivePlaceholder} rows={1} disabled={disabled}
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
