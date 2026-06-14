// Text-to-speech primitive built on the Web Speech `speechSynthesis` API.
// No server involved — everything runs in the browser. Chrome quirks handled:
//  - voices load asynchronously (onvoiceschanged), so callers subscribe via onVoicesReady.
//  - long utterances get cut off around ~15s, so we chunk text into sentence-sized pieces
//    and speak them sequentially.

export function isTTSSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function getEnglishVoices() {
  if (!isTTSSupported()) return []
  const voices = window.speechSynthesis.getVoices() || []
  return voices.filter(v => v.lang?.startsWith('en'))
}

// Calls `cb` with the current English voices immediately, and again whenever the browser
// finishes (re)loading voices. Returns an unsubscribe fn.
export function onVoicesReady(cb) {
  if (!isTTSSupported()) return () => {}
  const synth = window.speechSynthesis
  cb(getEnglishVoices())
  const handler = () => cb(getEnglishVoices())
  synth.onvoiceschanged = handler
  return () => {
    // Only clear if we're still the active handler (don't clobber a later subscriber).
    if (synth.onvoiceschanged === handler) synth.onvoiceschanged = null
  }
}

// Prefer an Indian-English voice, then a higher-quality Google/Natural en voice,
// then any English voice, else null.
export function pickDefaultVoice(voices) {
  if (!voices || voices.length === 0) return null
  const indian = voices.find(v => v.lang === 'en-IN')
  if (indian) return indian
  const quality = voices.find(
    v => /Google|Natural/.test(v.name || '') && v.lang?.startsWith('en')
  )
  if (quality) return quality
  const anyEn = voices.find(v => v.lang?.startsWith('en'))
  return anyEn || null
}

// Strip the bits of markdown our replies use so they don't get read aloud literally.
export function stripMarkdown(text) {
  if (!text) return ''
  return String(text)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) / ![alt](url) -> text/alt
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1') // inline/fenced code -> contents
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1') // **bold** _em_ *it* -> text
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '') // ## heading -> heading
    .replace(/^[ \t]*[-*+][ \t]+/gm, '') // - bullet -> bullet
    .replace(/^[ \t]*>[ \t]?/gm, '') // > quote -> quote
    .replace(/[*_]/g, '') // any stray emphasis chars
    .trim()
}

const MAX_CHUNK = 200

// Split text into chunks of ~MAX_CHUNK chars, breaking on sentence boundaries where
// possible so each utterance stays under Chrome's ~15s speech cutoff.
function chunkText(text) {
  const sentences = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [text]
  const chunks = []
  let cur = ''
  for (const s of sentences) {
    const piece = s.trim()
    if (!piece) continue
    if (piece.length > MAX_CHUNK) {
      // A single very long "sentence" — flush current, then hard-split on word boundaries.
      if (cur) { chunks.push(cur); cur = '' }
      const words = piece.split(/\s+/)
      let line = ''
      for (const w of words) {
        if ((line + ' ' + w).trim().length > MAX_CHUNK) {
          if (line) chunks.push(line)
          line = w
        } else {
          line = (line + ' ' + w).trim()
        }
      }
      if (line) chunks.push(line)
    } else if ((cur + ' ' + piece).trim().length > MAX_CHUNK) {
      if (cur) chunks.push(cur)
      cur = piece
    } else {
      cur = (cur + ' ' + piece).trim()
    }
  }
  if (cur) chunks.push(cur)
  return chunks
}

// Speak `text`. Cancels any in-progress speech first, strips markdown, chunks, and speaks
// each chunk in order via one utterance each. `onEnd` fires after the last chunk ends.
export function speak(text, { voice, rate = 1, pitch = 1, onEnd } = {}) {
  if (!isTTSSupported()) return
  const synth = window.speechSynthesis
  synth.cancel()

  const clean = stripMarkdown(text)
  const chunks = chunkText(clean)
  if (chunks.length === 0) {
    onEnd?.()
    return { cancel: () => synth.cancel() }
  }

  let cancelled = false
  let i = 0
  const speakNext = () => {
    if (cancelled) return
    if (i >= chunks.length) {
      onEnd?.()
      return
    }
    const u = new window.SpeechSynthesisUtterance(chunks[i])
    if (voice) u.voice = voice
    u.rate = rate
    u.pitch = pitch
    u.onend = () => {
      i++
      speakNext()
    }
    u.onerror = () => {
      i++
      speakNext()
    }
    synth.speak(u)
  }
  speakNext()

  return {
    cancel: () => {
      cancelled = true
      synth.cancel()
    },
  }
}

export function cancelSpeech() {
  if (!isTTSSupported()) return
  window.speechSynthesis.cancel()
}
