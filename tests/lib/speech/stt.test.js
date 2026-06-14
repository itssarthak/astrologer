import { isSTTSupported, createRecognizer } from '../../../src/lib/speech/stt'

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

// Build a SpeechRecognition result event the way the Web Speech API delivers it.
function resultEvent(items) {
  // items: [{ transcript, isFinal }]
  const results = items.map(it => {
    const arr = [{ transcript: it.transcript }]
    arr.isFinal = it.isFinal
    return arr
  })
  return { results, resultIndex: 0 }
}

beforeEach(() => {
  instances = []
})

afterEach(() => {
  delete window.webkitSpeechRecognition
  delete window.SpeechRecognition
  delete global.webkitSpeechRecognition
  delete global.SpeechRecognition
})

describe('isSTTSupported', () => {
  test('true with webkitSpeechRecognition', () => {
    window.webkitSpeechRecognition = MockRecognition
    expect(isSTTSupported()).toBe(true)
  })
  test('true with SpeechRecognition', () => {
    window.SpeechRecognition = MockRecognition
    expect(isSTTSupported()).toBe(true)
  })
  test('false when absent', () => {
    expect(isSTTSupported()).toBe(false)
  })
})

describe('createRecognizer', () => {
  test('returns no-op shape when unsupported', () => {
    const r = createRecognizer({})
    expect(r.supported).toBe(false)
    expect(() => { r.start(); r.stop(); r.abort() }).not.toThrow()
  })

  test('configures recognizer flags and lang', () => {
    window.webkitSpeechRecognition = MockRecognition
    const r = createRecognizer({ lang: 'en-GB' })
    r.start()
    const rec = instances[0]
    expect(rec.lang).toBe('en-GB')
    expect(rec.continuous).toBe(false)
    expect(rec.interimResults).toBe(true)
    expect(rec.start).toHaveBeenCalled()
    expect(r.supported).not.toBe(false)
  })

  test('default lang en-IN', () => {
    window.webkitSpeechRecognition = MockRecognition
    createRecognizer()
    expect(instances[0].lang).toBe('en-IN')
  })

  test('routes interim and final results', () => {
    window.webkitSpeechRecognition = MockRecognition
    const onInterim = vi.fn()
    const onFinal = vi.fn()
    createRecognizer({ onInterim, onFinal })
    const rec = instances[0]

    rec.onresult(resultEvent([{ transcript: 'hello', isFinal: false }]))
    expect(onInterim).toHaveBeenCalledWith('hello')
    expect(onFinal).not.toHaveBeenCalled()

    rec.onresult(resultEvent([{ transcript: 'hello world', isFinal: true }]))
    expect(onFinal).toHaveBeenCalledWith('hello world')
  })

  test('routes onend and onerror', () => {
    window.webkitSpeechRecognition = MockRecognition
    const onEnd = vi.fn()
    const onError = vi.fn()
    createRecognizer({ onEnd, onError })
    const rec = instances[0]
    rec.onend()
    expect(onEnd).toHaveBeenCalled()
    const err = { error: 'no-speech' }
    rec.onerror(err)
    expect(onError).toHaveBeenCalledWith(err)
  })

  test('prefers standard SpeechRecognition over webkit', () => {
    window.SpeechRecognition = MockRecognition
    window.webkitSpeechRecognition = function () { throw new Error('should not be used') }
    expect(() => createRecognizer()).not.toThrow()
  })
})
