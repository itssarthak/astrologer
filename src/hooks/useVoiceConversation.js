import { useState, useCallback, useRef, useEffect } from 'react'

// Hands-free voice-conversation orchestrator. Drives a loop:
//   idle → listening → thinking → speaking → listening → …
//
// CONTRACT: the caller creates the `stt` (useSpeechToText) and `tts` (useTextToSpeech)
// instances itself so their state is shared with the rest of the UI. Because `stt` owns its
// own `onResult`, this hook can't register one — instead it EXPOSES `handleTranscript(text)`,
// and the caller MUST pass `onResult: handleTranscript` when it creates `stt`. That way a
// final transcript reaches this orchestrator while hands-free is engaged.
//
// `onSend(text) => Promise<replyText>` submits the user's message and resolves with the
// assistant's reply text (so we can speak it).
export function useVoiceConversation({ onSend, tts, stt }) {
  const supported = !!(tts?.supported && stt?.supported)
  const [handsFree, setHandsFree] = useState(false)
  const [mode, setMode] = useState('idle') // idle | listening | thinking | speaking

  // Refs so the effect/callbacks always see the latest values without re-wiring.
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

  // Called by the caller's `stt.onResult` with a final transcript. Only acts while hands-free.
  const handleTranscript = useCallback(async text => {
    if (!handsFreeRef.current) return
    const clean = (text || '').trim()
    setMode('thinking')
    sttRef.current?.stop() // mic stays off through thinking + speaking
    if (!clean) {
      // Nothing recognized — fall back to listening if still engaged.
      if (handsFreeRef.current) {
        setMode('listening')
        sttRef.current?.start()
      }
      return
    }
    let reply = ''
    try {
      reply = await onSendRef.current?.(clean)
    } catch {
      reply = ''
    }
    if (!handsFreeRef.current) return // toggled off mid-flight: stop here
    if (reply) {
      setMode('speaking')
      ttsRef.current?.speak(reply)
      // The speaking→listening hop is driven by the tts.speaking true→false effect below.
    } else {
      // No reply to speak — resume listening immediately.
      setMode('listening')
      sttRef.current?.start()
    }
  }, [])

  // Drive the next listen turn off the tts `speaking` transition true→false while in
  // 'speaking' mode (the hook's speak() doesn't accept an onEnd). The mic restarts ONLY
  // after speech ends AND hands-free is still engaged — this is what prevents a runaway loop
  // and lets toggle-off terminate cleanly (toggle-off sets mode=idle + stops tts).
  const wasSpeaking = useRef(false)
  useEffect(() => {
    const speaking = !!tts?.speaking
    const ended = wasSpeaking.current && !speaking
    wasSpeaking.current = speaking
    if (ended && handsFreeRef.current && modeRef.current === 'speaking') {
      setMode('listening')
      sttRef.current?.start()
    }
  }, [tts?.speaking])

  return { handsFree, toggleHandsFree, mode, supported, handleTranscript }
}
