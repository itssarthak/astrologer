import {
  isTTSSupported,
  getEnglishVoices,
  onVoicesReady,
  pickDefaultVoice,
  speak,
  cancelSpeech,
  stripMarkdown,
} from '../../../src/lib/speech/tts'

// Collected utterances so a test can drive their onend.
let utterances

function makeSynth(voices = []) {
  return {
    getVoices: vi.fn(() => voices),
    cancel: vi.fn(),
    speak: vi.fn(u => {
      utterances.push(u)
    }),
    onvoiceschanged: null,
  }
}

class MockUtterance {
  constructor(text) {
    this.text = text
    this.voice = null
    this.rate = 1
    this.pitch = 1
    this.onend = null
    this.onerror = null
  }
}

beforeEach(() => {
  utterances = []
  vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance)
  window.SpeechSynthesisUtterance = MockUtterance
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete window.speechSynthesis
  delete window.SpeechSynthesisUtterance
})

describe('isTTSSupported', () => {
  test('true when speechSynthesis is present', () => {
    window.speechSynthesis = makeSynth()
    expect(isTTSSupported()).toBe(true)
  })
  test('false when absent', () => {
    delete window.speechSynthesis
    expect(isTTSSupported()).toBe(false)
  })
})

describe('getEnglishVoices', () => {
  test('filters to en* langs', () => {
    window.speechSynthesis = makeSynth([
      { name: 'A', lang: 'en-US' },
      { name: 'B', lang: 'hi-IN' },
      { name: 'C', lang: 'en-IN' },
      { name: 'D', lang: undefined },
    ])
    const v = getEnglishVoices()
    expect(v.map(x => x.name)).toEqual(['A', 'C'])
  })
  test('empty when unsupported', () => {
    delete window.speechSynthesis
    expect(getEnglishVoices()).toEqual([])
  })
})

describe('onVoicesReady', () => {
  test('calls cb immediately and on voiceschanged, returns unsub', () => {
    const synth = makeSynth([{ name: 'A', lang: 'en-US' }])
    window.speechSynthesis = synth
    const cb = vi.fn()
    const unsub = onVoicesReady(cb)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb.mock.calls[0][0].map(x => x.name)).toEqual(['A'])

    // simulate Chrome firing voiceschanged
    synth.getVoices = vi.fn(() => [
      { name: 'A', lang: 'en-US' },
      { name: 'B', lang: 'en-GB' },
    ])
    synth.onvoiceschanged()
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb.mock.calls[1][0].map(x => x.name)).toEqual(['A', 'B'])

    unsub()
    expect(synth.onvoiceschanged).toBe(null)
  })
  test('no-op unsub when unsupported', () => {
    delete window.speechSynthesis
    const cb = vi.fn()
    const unsub = onVoicesReady(cb)
    expect(cb).not.toHaveBeenCalled()
    expect(() => unsub()).not.toThrow()
  })
})

describe('pickDefaultVoice', () => {
  test('prefers a high-quality voice over a plain en-IN system voice', () => {
    const voices = [
      { name: 'Some IN', lang: 'en-IN' },        // plain locale voice (often robotic)
      { name: 'Google US English', lang: 'en-US' }, // higher quality
    ]
    expect(pickDefaultVoice(voices).name).toBe('Google US English')
  })
  test('among quality voices, prefers en-IN', () => {
    const voices = [
      { name: 'Google UK English', lang: 'en-GB' },
      { name: 'Google India English', lang: 'en-IN' },
    ]
    expect(pickDefaultVoice(voices).name).toBe('Google India English')
  })
  test('neural/natural voices score highest', () => {
    const voices = [
      { name: 'Google US English', lang: 'en-US' },
      { name: 'Microsoft Aria Natural', lang: 'en-US' },
    ]
    expect(pickDefaultVoice(voices).name).toBe('Microsoft Aria Natural')
  })
  test('avoids known low-quality voices when a better one exists', () => {
    const voices = [
      { name: 'Microsoft David', lang: 'en-US' },  // robotic — penalised
      { name: 'Samantha', lang: 'en-US' },          // named premium
    ]
    expect(pickDefaultVoice(voices).name).toBe('Samantha')
  })
  test('falls back to the first en voice when none have quality markers', () => {
    const voices = [{ name: 'First', lang: 'en-AU' }, { name: 'Second', lang: 'en-US' }]
    expect(pickDefaultVoice(voices).name).toBe('First')
  })
  test('null when none', () => {
    expect(pickDefaultVoice([])).toBe(null)
    expect(pickDefaultVoice(null)).toBe(null)
  })
})

describe('stripMarkdown', () => {
  test('removes bold/italic markers', () => {
    expect(stripMarkdown('**bold** and _em_ and *it*')).toBe('bold and em and it')
  })
  test('removes leading bullets and headings', () => {
    expect(stripMarkdown('- item one\n## Heading\n- item two')).toBe('item one\nHeading\nitem two')
  })
  test('keeps link text only', () => {
    expect(stripMarkdown('see [Google](https://g.com) now')).toBe('see Google now')
  })
})

describe('speak', () => {
  test('guards when unsupported', () => {
    delete window.speechSynthesis
    expect(() => speak('hi')).not.toThrow()
  })

  test('cancels current, chunks long text, onEnd after last', () => {
    const synth = makeSynth([])
    window.speechSynthesis = synth
    const onEnd = vi.fn()
    // 3 long sentences, each > 200 chars combined forces multiple chunks.
    const long = ('Sentence one is fairly long and has many words to fill space here. ').repeat(3)
      + ('Another distinct sentence follows with more content to push us over the limit. ').repeat(3)
    speak(long, { rate: 1.2, pitch: 0.9, onEnd })

    expect(synth.cancel).toHaveBeenCalled()
    // First chunk is spoken immediately; subsequent chunks are spoken sequentially as
    // each prior utterance ends (dodges Chrome's ~15s cutoff).
    expect(utterances.length).toBe(1)
    expect(utterances[0].rate).toBe(1.2)
    expect(utterances[0].pitch).toBe(0.9)

    // onEnd not called until the last chunk ends. Drive each utterance's onend, which
    // triggers the next chunk to be spoken, until the queue drains.
    let i = 0
    while (i < utterances.length) {
      const u = utterances[i]
      i++
      expect(onEnd).not.toHaveBeenCalled() // not yet — more chunks remain
      if (u.onend) u.onend()
    }
    // We saw more than one chunk total (long multi-sentence input was split).
    expect(utterances.length).toBeGreaterThan(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  test('sets voice on utterances', () => {
    window.speechSynthesis = makeSynth([])
    const voice = { name: 'V', lang: 'en-IN' }
    speak('Hello world.', { voice })
    expect(utterances[0].voice).toBe(voice)
  })
})

describe('cancelSpeech', () => {
  test('calls synth.cancel when supported', () => {
    const synth = makeSynth([])
    window.speechSynthesis = synth
    cancelSpeech()
    expect(synth.cancel).toHaveBeenCalled()
  })
  test('guards when unsupported', () => {
    delete window.speechSynthesis
    expect(() => cancelSpeech()).not.toThrow()
  })
})
