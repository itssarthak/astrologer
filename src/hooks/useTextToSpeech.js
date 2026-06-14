import { useState, useEffect, useCallback, useRef } from 'react'
import {
  isTTSSupported,
  onVoicesReady,
  pickDefaultVoice,
  speak as ttsSpeak,
  cancelSpeech,
} from '../lib/speech/tts'

const AUTO_SPEAK_KEY = 'astro.tts.autoSpeak'
const VOICE_URI_KEY = 'astro.tts.voiceURI'

function readAutoSpeak() {
  try {
    return localStorage.getItem(AUTO_SPEAK_KEY) === 'true'
  } catch {
    return false
  }
}

export function useTextToSpeech() {
  const supported = isTTSSupported()
  const [voices, setVoices] = useState([])
  const [voice, setVoiceState] = useState(null)
  const [speaking, setSpeaking] = useState(false)
  const [autoSpeak, setAutoSpeakState] = useState(readAutoSpeak)

  // `voice` lives in state for rendering but speak() needs the latest without re-creating
  // its callback on every voice change.
  const voiceRef = useRef(null)
  voiceRef.current = voice

  // Load voices (async in Chrome) and pick a default — honoring a saved voiceURI.
  useEffect(() => {
    if (!supported) return
    const unsub = onVoicesReady(list => {
      setVoices(list)
      setVoiceState(prev => {
        if (prev && list.some(v => v.voiceURI === prev.voiceURI)) return prev
        let savedUri = null
        try {
          savedUri = localStorage.getItem(VOICE_URI_KEY)
        } catch {
          savedUri = null
        }
        const saved = savedUri && list.find(v => v.voiceURI === savedUri)
        return saved || pickDefaultVoice(list)
      })
    })
    return unsub
  }, [supported])

  const setAutoSpeak = useCallback(value => {
    setAutoSpeakState(value)
    try {
      localStorage.setItem(AUTO_SPEAK_KEY, value ? 'true' : 'false')
    } catch {
      // ignore storage failures (private mode / quota)
    }
  }, [])

  const setVoice = useCallback(v => {
    setVoiceState(v)
    try {
      if (v?.voiceURI) localStorage.setItem(VOICE_URI_KEY, v.voiceURI)
    } catch {
      // ignore storage failures
    }
  }, [])

  const speak = useCallback(
    (text, onEnd) => {
      if (!supported || !text) return
      setSpeaking(true)
      ttsSpeak(text, {
        voice: voiceRef.current,
        onEnd: () => {
          setSpeaking(false)
          onEnd?.()
        },
      })
    },
    [supported]
  )

  const stop = useCallback(() => {
    cancelSpeech()
    setSpeaking(false)
  }, [])

  // Stop speaking if the component using this hook unmounts.
  useEffect(() => () => cancelSpeech(), [])

  return {
    supported,
    speaking,
    autoSpeak,
    setAutoSpeak,
    voices,
    voice,
    setVoice,
    speak,
    stop,
  }
}
