import { renderHook, act } from '@testing-library/react'
import { useSpeechToText } from '../src/hooks/useSpeechToText'

let instances

class MockRecognition {
  constructor() {
    this.lang = ''
    this.continuous = null
    this.interimResults = null
    this.onresult = null
    this.onend = null
    this.onerror = null
    this.start = vi.fn()
    this.stop = vi.fn()
    this.abort = vi.fn()
    instances.push(this)
  }
}

function resultEvent(transcript, isFinal) {
  const arr = [{ transcript }]
  arr.isFinal = isFinal
  return { results: [arr], resultIndex: 0 }
}

beforeEach(() => {
  instances = []
  window.webkitSpeechRecognition = MockRecognition
})

afterEach(() => {
  delete window.webkitSpeechRecognition
  delete window.SpeechRecognition
})

test('supported reflects stub', () => {
  const { result } = renderHook(() => useSpeechToText())
  expect(result.current.supported).toBe(true)
})

test('supported false when absent', () => {
  delete window.webkitSpeechRecognition
  const { result } = renderHook(() => useSpeechToText())
  expect(result.current.supported).toBe(false)
})

test('start sets listening and creates recognizer', () => {
  const { result } = renderHook(() => useSpeechToText())
  act(() => result.current.start())
  expect(result.current.listening).toBe(true)
  expect(instances.length).toBe(1)
  expect(instances[0].start).toHaveBeenCalled()
})

test('interim updates state, final calls onResult and clears interim', () => {
  const onResult = vi.fn()
  const { result } = renderHook(() => useSpeechToText({ onResult }))
  act(() => result.current.start())
  const rec = instances[0]

  act(() => rec.onresult(resultEvent('hel', false)))
  expect(result.current.interim).toBe('hel')

  act(() => rec.onresult(resultEvent('hello', true)))
  expect(onResult).toHaveBeenCalledWith('hello')
  expect(result.current.interim).toBe('')
})

test('onend clears listening', () => {
  const { result } = renderHook(() => useSpeechToText())
  act(() => result.current.start())
  act(() => instances[0].onend())
  expect(result.current.listening).toBe(false)
})

test('onerror clears listening', () => {
  const { result } = renderHook(() => useSpeechToText())
  act(() => result.current.start())
  act(() => instances[0].onerror({ error: 'no-speech' }))
  expect(result.current.listening).toBe(false)
})

test('stop stops recognizer and clears listening', () => {
  const { result } = renderHook(() => useSpeechToText())
  act(() => result.current.start())
  act(() => result.current.stop())
  expect(instances[0].stop).toHaveBeenCalled()
  expect(result.current.listening).toBe(false)
})
