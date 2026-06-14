import { renderHook, act } from '@testing-library/react'
import { useVoiceConversation } from '../src/hooks/useVoiceConversation'

// Build a mock tts/stt pair. `speaking` is controllable per-render via the holder object so
// we can simulate the speech true→false transition by re-rendering with a new value.
function makeMocks({ ttsSupported = true, sttSupported = true } = {}) {
  const stt = { supported: sttSupported, start: vi.fn(), stop: vi.fn() }
  const tts = { supported: ttsSupported, speak: vi.fn(), stop: vi.fn(), speaking: false }
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
  expect(tts.speak).toHaveBeenCalledWith('the stars say yes')
  expect(result.current.mode).toBe('speaking')
})

test('speech-end returns to listening', async () => {
  const mocks = makeMocks()
  const onSend = vi.fn().mockResolvedValue('a reply')
  const { result, rerender } = renderHook(
    ({ speaking }) =>
      useVoiceConversation({ onSend, tts: { ...mocks.tts, speaking }, stt: mocks.stt }),
    { initialProps: { speaking: false } }
  )

  act(() => result.current.toggleHandsFree())
  await act(async () => {
    await result.current.handleTranscript('hi')
  })
  expect(result.current.mode).toBe('speaking')

  // Simulate speech start then end via the speaking flag transition.
  act(() => rerender({ speaking: true }))
  mocks.stt.start.mockClear()
  act(() => rerender({ speaking: false }))

  expect(result.current.mode).toBe('listening')
  expect(mocks.stt.start).toHaveBeenCalledTimes(1)
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
