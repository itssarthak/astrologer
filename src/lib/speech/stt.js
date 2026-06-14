// Speech-to-text primitive built on the Web Speech `webkitSpeechRecognition` API.
// Browser-only, no server. Returns a small {start, stop, abort} wrapper so hooks don't
// have to know about the underlying recognizer's event wiring.

export function isSTTSupported() {
  return (
    typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  )
}

const noop = () => {}

export function createRecognizer({
  lang = 'en-IN',
  onInterim,
  onFinal,
  onEnd,
  onError,
} = {}) {
  if (!isSTTSupported()) {
    return { start: noop, stop: noop, abort: noop, supported: false }
  }

  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  const rec = new Ctor()
  rec.lang = lang
  rec.continuous = false
  rec.interimResults = true

  rec.onresult = event => {
    let interim = ''
    let final = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      const transcript = result[0]?.transcript || ''
      if (result.isFinal) final += transcript
      else interim += transcript
    }
    if (final) onFinal?.(final.trim())
    else if (interim) onInterim?.(interim)
  }

  rec.onend = () => onEnd?.()
  rec.onerror = e => onError?.(e)

  return {
    supported: true,
    start: () => rec.start(),
    stop: () => rec.stop(),
    abort: () => rec.abort(),
  }
}
