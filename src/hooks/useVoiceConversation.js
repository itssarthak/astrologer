import { useState, useCallback, useRef } from 'react'

// Hands-free voice-conversation orchestrator. Drives a loop:
//   idle → listening → thinking → speaking → listening → …
//
// CONTRACT: the caller creates the `stt` (useSpeechToText) and `tts` (useTextToSpeech)
// instances itself so their state is shared with the rest of the UI. Because `stt` owns its
// own callbacks, this hook can't register them — instead it EXPOSES `handleTranscript`,
// `onListenEnd`, and `onListenError`, and the caller MUST wire them:
//   onResult: handleTranscript (final transcript while engaged)
//   onEnd:    onListenEnd      (natural mic silence — restart if still listening)
//   onError:  onListenError    (benign vs fatal mic errors)
//
// The loop is fully CALLBACK-DRIVEN — it does NOT poll `tts.speaking`. The speech→listening
// hop is driven by the onEnd callback passed into `tts.speak(reply, onSpeechEnd)`.
//
// `onSend(text) => Promise<replyText>` submits the user's message and resolves with the
// assistant's reply text (so we can speak it).
export function useVoiceConversation({ onSend, tts, stt }) {
  const supported = !!(tts?.supported && stt?.supported)
  const [handsFree, setHandsFree] = useState(false)
  const [mode, setMode] = useState('idle') // idle | listening | thinking | speaking

  // Refs so callbacks always see the latest values without re-wiring.
  const handsFreeRef = useRef(false)
  handsFreeRef.current = handsFree
  const modeRef = useRef('idle')
  modeRef.current = mode
  const ttsRef = useRef(tts)
  ttsRef.current = tts
  const sttRef = useRef(stt)
  sttRef.current = stt
  const onSendRef = useRef(onSend)
  onSendRef.current = onSend

  // start the mic (the underlying start() is guarded against double-start in useSpeechToText).
  const safeStartListening = useCallback(() => {
    sttRef.current?.start()
  }, [])

  // Fired when speech playback finishes. Resume listening only if still engaged + still speaking.
  const onSpeechEnd = useCallback(() => {
    if (handsFreeRef.current && modeRef.current === 'speaking') {
      setMode('listening')
      safeStartListening()
    }
  }, [safeStartListening])

  // Called by the caller's `stt.onResult` with a final transcript. Only acts while hands-free.
  const handleTranscript = useCallback(
    async text => {
      if (!handsFreeRef.current) return
      const clean = (text || '').trim()
      if (!clean) {
        // Nothing recognized — keep listening. The mic will be restarted by onListenEnd
        // when the recognizer fires its end event.
        return
      }
      setMode('thinking')
      sttRef.current?.stop() // mic stays off through thinking + speaking
      let reply = ''
      try {
        reply = await onSendRef.current?.(clean)
      } catch {
        reply = ''
      }
      if (!handsFreeRef.current) return // toggled off mid-flight: stop here
      if (reply) {
        setMode('speaking')
        ttsRef.current?.speak(reply, onSpeechEnd)
      } else {
        // No reply to speak — resume listening immediately.
        setMode('listening')
        safeStartListening()
      }
    },
    [onSpeechEnd, safeStartListening]
  )

  // Wired to useSpeechToText's onEnd. Natural mic silence: restart if still listening.
  const onListenEnd = useCallback(() => {
    if (handsFreeRef.current && modeRef.current === 'listening') {
      safeStartListening()
    }
  }, [safeStartListening])

  // Wired to useSpeechToText's onError.
  const onListenError = useCallback(e => {
    const code = e?.error
    const fatal = code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture'
    if (fatal) {
      // Permission/hardware failure — tear everything down so the toggle reflects reality.
      sttRef.current?.stop()
      ttsRef.current?.stop()
      setHandsFree(false)
      setMode('idle')
    }
    // Benign ('no-speech' / 'aborted' / anything else): onListenEnd will restart if still listening.
  }, [])

  const toggleHandsFree = useCallback(() => {
    if (!supported) return // no-op when unsupported
    setHandsFree(prev => {
      const next = !prev
      if (next) {
        setMode('listening')
        sttRef.current?.start()
      } else {
        sttRef.current?.stop()
        ttsRef.current?.stop()
        setMode('idle')
      }
      return next
    })
  }, [supported])

  return {
    handsFree,
    toggleHandsFree,
    mode,
    supported,
    handleTranscript,
    onListenEnd,
    onListenError,
  }
}
