// Shared header for every chat-bearing tab: a Refresh action (recompute/reload) and a
// Clear chat action that requires confirmation, since clearing permanently deletes history.
import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { SpeakerIcon, HeadsetIcon } from '../Chat/VoiceIcons'

export default function ChatToolbar({
  title, onRefresh, onClear, refreshDisabled = false, clearDisabled = false,
  // Optional voice controls — rendered only when the matching API is supported.
  autoSpeak = false, onToggleAutoSpeak, ttsSupported = false, speaking = false,
  handsFree = false, onToggleHandsFree, voiceSupported = false,
  voices = [], voice = null, onSelectVoice,
  extraControls = null,
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface flex-shrink-0">
      <span className="text-xs font-semibold text-muted uppercase tracking-wide truncate">{title}</span>
      <div className="flex items-center gap-4">
        {extraControls}
        {ttsSupported && onToggleAutoSpeak && (
          <button onClick={onToggleAutoSpeak} aria-pressed={autoSpeak} aria-label={autoSpeak ? 'Stop reading replies aloud' : 'Read replies aloud'}
            title={autoSpeak ? 'Reading replies aloud — click to mute' : 'Read replies aloud'}
            className={`transition-colors ${autoSpeak ? 'text-primary' : 'text-muted hover:text-primary'}`}>
            <SpeakerIcon className="w-[18px] h-[18px]" muted={!autoSpeak} active={autoSpeak && speaking} />
          </button>
        )}
        {ttsSupported && voices.length > 1 && onSelectVoice && (
          <select value={voice?.voiceURI ?? ''} onChange={e => onSelectVoice(e.target.value)} title="Choose the voice"
            aria-label="Voice"
            className="max-w-[120px] text-xs rounded-md border border-border bg-surface px-1.5 py-0.5 text-muted hover:text-text focus:outline-none focus:border-primary">
            {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name.replace(/^(Microsoft|Google)\s+/, '')}</option>)}
          </select>
        )}
        {voiceSupported && onToggleHandsFree && (
          <button onClick={onToggleHandsFree} aria-pressed={handsFree} aria-label={handsFree ? 'Turn off hands-free' : 'Hands-free conversation'}
            title={handsFree ? 'Hands-free on — click to stop' : 'Hands-free conversation'}
            className={`relative transition-colors ${handsFree ? 'text-primary' : 'text-muted hover:text-primary'}`}>
            {handsFree && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
            <HeadsetIcon className="w-[18px] h-[18px]" />
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
