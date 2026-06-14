import { useState, useCallback, useRef, useEffect } from 'react'
import { isSTTSupported, createRecognizer } from '../lib/speech/stt'

export function useSpeechToText({ onResult } = {}) {
  const supported = isSTTSupported()
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recognizerRef = useRef(null)

  // Keep the latest onResult without re-wiring the recognizer.
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const start = useCallback(() => {
    if (!supported) return
    if (!recognizerRef.current) {
      recognizerRef.current = createRecognizer({
        onInterim: text => setInterim(text),
        onFinal: text => {
          onResultRef.current?.(text)
          setInterim('')
        },
        onEnd: () => setListening(false),
        onError: () => setListening(false),
      })
    }
    setInterim('')
    setListening(true)
    recognizerRef.current.start()
  }, [supported])

  const stop = useCallback(() => {
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
