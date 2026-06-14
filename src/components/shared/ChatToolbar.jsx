// Shared header for every chat-bearing tab: a Refresh action (recompute/reload) and a
// Clear chat action that requires confirmation, since clearing permanently deletes history.
import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'

export default function ChatToolbar({
  title, onRefresh, onClear, refreshDisabled = false, clearDisabled = false,
  // Optional voice controls — rendered only when the matching API is supported.
  autoSpeak = false, onToggleAutoSpeak, ttsSupported = false,
  handsFree = false, onToggleHandsFree, voiceSupported = false,
  extraControls = null,
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface flex-shrink-0">
      <span className="text-xs font-semibold text-muted uppercase tracking-wide truncate">{title}</span>
      <div className="flex items-center gap-4">
        {extraControls}
        {ttsSupported && onToggleAutoSpeak && (
          <button onClick={onToggleAutoSpeak} title="Read replies aloud" aria-pressed={autoSpeak}
            className={`text-sm transition-colors ${autoSpeak ? 'text-primary' : 'text-muted hover:text-text'}`}>
            🔊
          </button>
        )}
        {voiceSupported && onToggleHandsFree && (
          <button onClick={onToggleHandsFree} title="Hands-free conversation" aria-pressed={handsFree}
            className={`text-sm transition-colors ${handsFree ? 'text-primary' : 'text-muted hover:text-text'}`}>
            🎧
          </button>
        )}
        {onRefresh && (
          <button onClick={onRefresh} disabled={refreshDisabled}
            className="text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline">
            ↻ Refresh
          </button>
        )}
        {onClear && (
          <button onClick={() => setConfirming(true)} disabled={clearDisabled}
            className="text-xs text-muted hover:text-red-500 transition-colors disabled:opacity-50 disabled:hover:text-muted">
            🗑 Clear chat
          </button>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title="Clear this conversation?"
          message="This permanently deletes every message in this tab for this profile. This can't be undone."
          confirmLabel="Delete forever"
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); onClear() }}
        />
      )}
    </div>
  )
}
