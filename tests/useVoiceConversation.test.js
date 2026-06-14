import { renderHook, act } from '@testing-library/react'
import { useVoiceConversation } from '../src/hooks/useVoiceConversation'

// Build a mock tts/stt pair. `tts.speak(text, onEnd)` captures the onEnd callback into
// `tts._onEnd` so tests can fire it to simulate speech end (driving speech→listening).
function makeMocks({ ttsSupported = true, sttSupported = true } = {}) {
  const stt = { supported: sttSupported, start: vi.fn(), stop: vi.fn() }
  const tts = {
    supported: ttsSupported,
    speak: vi.fn((_text, onEnd) => { tts._onEnd = onEnd }),
    stop: vi.fn(),
    _onEnd: null,
  }
  return { stt, tts }
}

test('supported reflects both tts and stt', () => {
  const a = makeMocks()
  const { result } = renderHook(() => useVoiceConversation({ onSend: vi.fn(), ...a }))
  expect(result.current.supported).toBe(true)

  const b = makeMocks({ ttsSupported: false })
  const { result: r2 } = renderHook(() => useVoiceConversation({ onSend: vi.fn(), ...b }))
  expect(r2.current.supported).toBe(false)
})

test('toggling on starts listening', () => {
  const { tts, stt } = makeMocks()
  const { result } = renderHook(() => useVoiceConversation({ onSend: vi.fn(), tts, stt }))
  act(() => result.current.toggleHandsFree())
  expect(result.current.handsFree).toBe(true)
  expect(result.current.mode).toBe('listening')
  expect(stt.start).toHaveBeenCalledTimes(1)
})

test('a transcript while handsFree goes thinking → speaking and speaks the reply', async () => {
  const { tts, stt } = makeMocks()
  const onSend = vi.fn().mockResolvedValue('the stars say yes')
  const { result } = renderHook(() => useVoiceConversation({ onSend, tts, stt }))

  act(() => result.current.toggleHandsFree())
  stt.stop.mockClear()

  await act(async () => {
    await result.current.handleTranscript('will it rain')
  })

  expect(stt.stop).toHaveBeenCalled() // mic forced off before sending
  expect(onSend).toHaveBeenCalledWith('will it rain')
  expect(tts.speak).toHaveBeenCalledWith('the stars say yes', expect.any(Function))
  expect(result.current.mode).toBe('speaking')
})

test('speech-end (onEnd callback) returns to listening', async () => {
  const { tts, stt } = makeMocks()
  const onSend = vi.fn().mockResolvedValue('a reply')
  const { result } = renderHook(() => useVoiceConversation({ onSend, tts, stt }))

  act(() => result.current.toggleHandsFree())
  await act(async () => {
    await result.current.handleTranscript('hi')
  })
  expect(result.current.mode).toBe('speaking')

  // Fire the captured onEnd to simulate speech finishing.
  stt.start.mockClear()
  act(() => tts._onEnd())

  expect(result.current.mode).toBe('listening')
  expect(stt.start).toHaveBeenCalledTimes(1)
})

test('natural listen-end while handsFree+listening restarts the mic', async () => {
  const { tts, stt } = makeMocks()
  const { result } = renderHook(() => useVoiceConversation({ onSend: vi.fn(), tts, stt }))

  act(() => result.current.toggleHandsFree()) // listening, start called once
  stt.start.mockClear()

  // Recognizer ended naturally (silence) — still handsFree + listening, so restart.
  act(() => result.current.onListenEnd())
  expect(stt.start).toHaveBeenCalledTimes(1)
})

test('listen-end does NOT restart when not listening (e.g. thinking)', async () => {
  const { tts, stt } = makeMocks()
  let resolveSend
  const onSend = vi.fn(() => new Promise(r => { resolveSend = r }))
  const { result } = renderHook(() => useVoiceConversation({ onSend, tts, stt }))

  act(() => result.current.toggleHandsFree())
  let p
  act(() => { p = result.current.handleTranscript('hi') })
  expect(result.current.mode).toBe('thinking')

  stt.start.mockClear()
  act(() => result.current.onListenEnd()) // mic ended during thinking — no restart
  expect(stt.start).not.toHaveBeenCalled()

  await act(async () => { resolveSend('reply'); await p })
})

test('empty transcript keeps listening (no send, no mode change away from listening)', async () => {
  const { tts, stt } = makeMocks()
  const onSend = vi.fn().mockResolvedValue('x')
  const { result } = renderHook(() => useVoiceConversation({ onSend, tts, stt }))

  act(() => result.current.toggleHandsFree())
  await act(async () => {
    await result.current.handleTranscript('   ')
  })
  expect(onSend).not.toHaveBeenCalled()
  expect(result.current.mode).toBe('listening')

  // The mic restart on silence comes from onListenEnd.
  stt.start.mockClear()
  act(() => result.current.onListenEnd())
  expect(stt.start).toHaveBeenCalledTimes(1)
})

test('fatal stt error turns hands-free OFF and lands idle', () => {
  const { tts, stt } = makeMocks()
  const { result } = renderHook(() => useVoiceConversation({ onSend: vi.fn(), tts, stt }))

  act(() => result.current.toggleHandsFree())
  expect(result.current.handsFree).toBe(true)

  act(() => result.current.onListenError({ error: 'not-allowed' }))
  expect(result.current.handsFree).toBe(false)
  expect(result.current.mode).toBe('idle')
  expect(stt.stop).toHaveBeenCalled()
  expect(tts.stop).toHaveBeenCalled()
})

test('benign stt error (no-speech) leaves hands-free engaged', () => {
  const { tts, stt } = makeMocks()
  const { result } = renderHook(() => useVoiceConversation({ onSend: vi.fn(), tts, stt }))

  act(() => result.current.toggleHandsFree())
  act(() => result.current.onListenError({ error: 'no-speech' }))
  expect(result.current.handsFree).toBe(true)
  expect(tts.stop).not.toHaveBeenCalled()
})

test('toggling off stops stt + tts and sets idle', () => {
  const { tts, stt } = makeMocks()
  const { result } = renderHook(() => useVoiceConversation({ onSend: vi.fn(), tts, stt }))
  act(() => result.current.toggleHandsFree())
  act(() => result.current.toggleHandsFree())
  expect(result.current.handsFree).toBe(false)
  expect(result.current.mode).toBe('idle')
  expect(stt.stop).toHaveBeenCalled()
  expect(tts.stop).toHaveBeenCalled()
})

test('transcript is ignored when not handsFree', async () => {
  const { tts, stt } = makeMocks()
  const onSend = vi.fn().mockResolvedValue('x')
  const { result } = renderHook(() => useVoiceConversation({ onSend, tts, stt }))
  await act(async () => {
    await result.current.handleTranscript('hello')
  })
  expect(onSend).not.toHaveBeenCalled()
  expect(result.current.mode).toBe('idle')
})

test('toggling off mid-flight prevents speaking', async () => {
  const { tts, stt } = makeMocks()
  let resolveSend
  const onSend = vi.fn(() => new Promise(r => { resolveSend = r }))
  const { result } = renderHook(() => useVoiceConversation({ onSend, tts, stt }))

  act(() => result.current.toggleHandsFree())
  let p
  act(() => { p = result.current.handleTranscript('hi') })
  expect(result.current.mode).toBe('thinking')

  act(() => result.current.toggleHandsFree()) // off while awaiting onSend
  await act(async () => { resolveSend('late reply'); await p })

  expect(tts.speak).not.toHaveBeenCalled()
  expect(result.current.mode).toBe('idle')
})

test('unsupported → toggle no-ops', () => {
  const { tts, stt } = makeMocks({ sttSupported: false })
  const { result } = renderHook(() => useVoiceConversation({ onSend: vi.fn(), tts, stt }))
  act(() => result.current.toggleHandsFree())
  expect(result.current.handsFree).toBe(false)
  expect(result.current.mode).toBe('idle')
  expect(stt.start).not.toHaveBeenCalled()
})
