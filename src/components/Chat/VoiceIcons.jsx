// Reactive line-style SVG icons for the voice controls (mic, speaker, headset, stop).
// Stroke uses currentColor so Tailwind text-color classes drive them; size via className.

// `active` — shows animated broadcast arcs beside the capsule when recording.
export function MicIcon({ className = '', active = false }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
        className={active ? 'animate-pulse' : ''} />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
      {active && (
        // Broadcast arcs on either side of the mic — "transmitting audio" signal.
        <>
          <path d="M4.5 10a8 8 0 0 0 0 4" strokeOpacity="0.6"
            className="animate-pulse" />
          <path d="M19.5 10a8 8 0 0 1 0 4" strokeOpacity="0.6"
            className="animate-pulse" style={{ animationDelay: '200ms' }} />
        </>
      )}
    </svg>
  )
}

// Speaker with sound waves. `muted` → an ✕ instead of waves (auto-speak off);
// `active` → the waves pulse with a staggered ripple (currently speaking).
export function SpeakerIcon({ className = '', muted = false, active = false }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      {muted ? (
        <>
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </>
      ) : (
        <>
          {/* Inner wave pulses first; outer lags so it looks like sound propagating outward. */}
          <path d="M15.5 8.5a5 5 0 0 1 0 7"
            className={active ? 'animate-pulse' : ''}
            style={active ? { animationDelay: '0ms' } : {}} />
          <path d="M18.5 5.5a9 9 0 0 1 0 13"
            className={active ? 'animate-pulse' : ''}
            style={active ? { animationDelay: '300ms' } : {}} />
        </>
      )}
    </svg>
  )
}

export function HeadsetIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M20 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2Z" fill="currentColor" />
      <path d="M4 15a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2Z" fill="currentColor" />
      {/* mic boom — distinguishes from plain headphones */}
      <path d="M18 17v1a3 3 0 0 1-3 3h-3" />
    </svg>
  )
}

export function StopIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  )
}
