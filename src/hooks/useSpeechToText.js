import { useState, useCallback, useRef, useEffect } from 'react'
import { isSTTSupported, createRecognizer } from '../lib/speech/stt'

export function useSpeechToText({ onResult, onEnd, onError } = {}) {
  const supported = isSTTSupported()
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recognizerRef = useRef(null)
  // Tracks whether the recognizer is actually running, so start() can no-op while busy
  // (calling rec.start() twice throws InvalidStateError in Web Speech).
  const runningRef = useRef(false)

  // Keep the latest callbacks without re-wiring the recognizer.
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const start = useCallback(() => {
    if (!supported) return
    if (runningRef.current) return // already listening — no-op (avoids InvalidStateError)
    if (!recognizerRef.current) {
      recognizerRef.current = createRecognizer({
        onInterim: text => setInterim(text),
        onFinal: text => {
          onResultRef.current?.(text)
          setInterim('')
        },
        onEnd: () => {
          runningRef.current = false
          setListening(false)
          onEndRef.current?.()
        },
        onError: e => {
          runningRef.current = false
          setListening(false)
          onErrorRef.current?.(e)
        },
      })
    }
    setInterim('')
    runningRef.current = true
    setListening(true)
    try {
      recognizerRef.current.start()
    } catch {
      // Underlying recognizer was still winding down (InvalidStateError). Reset state so a
      // later start() can retry rather than wedging.
      runningRef.current = false
      setListening(false)
    }
  }, [supported])

  const stop = useCallback(() => {
    // Leave runningRef true until the recognizer's onend actually fires (it's still winding down).
    recognizerRef.current?.stop()
    setListening(false)
  }, [])

  // Abort any in-flight recognition on unmount.
  useEffect(
    () => () => {
      recognizerRef.current?.abort()
    },
    []
  )

  return { supported, listening, interim, start, stop }
}
