import { describe, it, expect } from 'vitest'
import { formatNumerologyContext, formatNumerologyMatchContext } from '../../../src/lib/prompts/formatters'

const NUM = {
  life_path: 4,
  destiny: { chaldean: 5, pythagorean: 6 },
  soul_urge: { chaldean: 2, pythagorean: 3 },
  personality: { chaldean: 3, pythagorean: 3 },
  personal_year: 8,
  loshu: { counts: { '1': 3, '9': 2 }, missing: [5, 7], repeated: [1, 9], kua: 3, kua_note: null,
           arrows_strength: ['Will (9-5-1)'], arrows_weakness: ['Action (2-7-6)'] },
}

describe('formatNumerologyContext', () => {
  it('includes the Lo Shu grid summary', () => {
    const out = formatNumerologyContext(NUM)
    expect(out).toContain('Lo Shu')
    expect(out).toContain('Missing: 5, 7')
    expect(out).toContain('Will (9-5-1)')
  })

  it('still renders without a loshu block (older profiles)', () => {
    const { loshu, ...legacy } = NUM
    const out = formatNumerologyContext(legacy)
    expect(out).toContain('Life Path: 4')
    expect(out).not.toContain('Lo Shu')
  })
})

describe('formatNumerologyMatchContext', () => {
  it('renders the indicative score and per-dimension ratings', () => {
    const m = { between: ['A', 'B'], indicative_score: 7, indicative_label: 'indicative, non-classical',
      summary_rating: 'Harmonious',
      core: { rating: 'Harmonious', score: 8 }, driver_conductor: { rating: 'Mixed', score: 5 },
      grid: { rating: 'Mixed', score: 6, a_missing_filled_by_b: [5], b_missing_filled_by_a: [2], shared_strengths: [9] } }
    const out = formatNumerologyMatchContext(m)
    expect(out).toContain('indicative, non-classical')
    expect(out).toContain('7/10')
    expect(out).toContain('Harmonious')
  })
})
