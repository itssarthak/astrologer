import { renderHook, act } from '@testing-library/react'
import { useTextToSpeech } from '../src/hooks/useTextToSpeech'

let utterances

class MockUtterance {
  constructor(text) {
    this.text = text
    this.onend = null
  }
}

function makeSynth(voices) {
  return {
    getVoices: vi.fn(() => voices),
    cancel: vi.fn(),
    speak: vi.fn(u => utterances.push(u)),
    onvoiceschanged: null,
  }
}

beforeEach(() => {
  utterances = []
  localStorage.clear()
  window.SpeechSynthesisUtterance = MockUtterance
  window.speechSynthesis = makeSynth([
    { name: 'Indian', lang: 'en-IN', voiceURI: 'uri-in' },
    { name: 'Google US', lang: 'en-US', voiceURI: 'uri-us' },
  ])
})

afterEach(() => {
  delete window.speechSynthesis
  delete window.SpeechSynthesisUtterance
})

test('supported reflects stub', () => {
  const { result } = renderHook(() => useTextToSpeech())
  expect(result.current.supported).toBe(true)
})

test('supported false when absent', () => {
  delete window.speechSynthesis
  const { result } = renderHook(() => useTextToSpeech())
  expect(result.current.supported).toBe(false)
})

test('loads voices and picks en-IN default', () => {
  const { result } = renderHook(() => useTextToSpeech())
  expect(result.current.voices.length).toBe(2)
  expect(result.current.voice.lang).toBe('en-IN')
})

test('autoSpeak persists to localStorage', () => {
  const { result } = renderHook(() => useTextToSpeech())
  expect(result.current.autoSpeak).toBe(false)
  act(() => result.current.setAutoSpeak(true))
  expect(result.current.autoSpeak).toBe(true)
  expect(localStorage.getItem('astro.tts.autoSpeak')).toBe('true')
})

test('restores saved voiceURI', () => {
  localStorage.setItem('astro.tts.voiceURI', 'uri-us')
  const { result } = renderHook(() => useTextToSpeech())
  expect(result.current.voice.voiceURI).toBe('uri-us')
})

test('setVoice persists voiceURI', () => {
  const { result } = renderHook(() => useTextToSpeech())
  act(() => result.current.setVoice(result.current.voices[1]))
  expect(localStorage.getItem('astro.tts.voiceURI')).toBe('uri-us')
})

test('speak sets speaking true then false on end', () => {
  const { result } = renderHook(() => useTextToSpeech())
  act(() => result.current.speak('Hello there.'))
  expect(result.current.speaking).toBe(true)
  act(() => {
    utterances.forEach(u => u.onend && u.onend())
  })
  expect(result.current.speaking).toBe(false)
})

test('stop cancels and clears speaking', () => {
  const { result } = renderHook(() => useTextToSpeech())
  act(() => result.current.speak('Hello there.'))
  act(() => result.current.stop())
  expect(window.speechSynthesis.cancel).toHaveBeenCalled()
  expect(result.current.speaking).toBe(false)
})
