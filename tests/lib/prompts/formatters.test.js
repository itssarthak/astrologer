import { describe, it, expect } from 'vitest'
import { formatChartContext, formatNumerologyContext, formatNumerologyMatchContext, formatSynastryContext } from '../../../src/lib/prompts/formatters'

const NUM = {
  life_path: 4,
  destiny: { chaldean: 5, pythagorean: 6 },
  soul_urge: { chaldean: 2, pythagorean: 3 },
  personality: { chaldean: 3, pythagorean: 3 },
  personal_year: 8,
  mulank: 4,
  bhagyank: 5,
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
    const { loshu: _loshu, ...legacy } = NUM
    const out = formatNumerologyContext(legacy)
    expect(out).toContain('Life Path: 4')
    expect(out).not.toContain('Lo Shu')
  })

  it('includes driver/destiny number meanings', () => {
    const out = formatNumerologyContext({ ...NUM, mulank: 4, bhagyank: 5 })
    expect(out).toMatch(/Driver.*4.*Rahu/i)
    expect(out).toMatch(/Destiny.*5.*Mercury/i)
  })
})

describe('formatChartContext', () => {
  const CHART = {
    d1Chart: { houses: [
      { number: 1, sign: 'Aries', occupants: [] },
      { number: 7, sign: 'Libra', occupants: [
        { celestialBody: 'Saturn', sign: 'Libra', motion_type: 'direct', dignities: { dignity: 'exalted' } },
      ] },
    ] },
    dashas: { current: { mahadashas: { Venus: { antardashas: { Saturn: {} } } } } },
  }
  it('annotates placements with karaka, house and dignity meaning', () => {
    const out = formatChartContext(CHART, [], {})
    expect(out).toMatch(/Saturn in Libra \(house 7\)/)
    expect(out).toMatch(/karaka:.*discipline/i)
    expect(out).toMatch(/house:.*marriage/i)
    expect(out).toMatch(/dignity:.*best results|strength/i)
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

describe('formatSynastryContext per-person gunas', () => {
  const synastry = {
    guna_milan: {
      total: 28, max: 36, verdict: 'Strong',
      breakdown: { varna: { score: 1, max: 1 }, yoni: { score: 3, max: 4 } },
      profiles: {
        a: { moon_sign: 'Aries', nakshatra: 'Ashwini', varna: 'Kshatriya', vashya: 'Chatushpada', yoni: 'Horse', sign_lord: 'Mars', gana: 'Deva', nadi: 'Vata' },
        b: { moon_sign: 'Taurus', nakshatra: 'Bharani', varna: 'Vaishya', vashya: 'Chatushpada', yoni: 'Elephant', sign_lord: 'Venus', gana: 'Manushya', nadi: 'Pitta' },
      },
    },
    overlay_summary: { supportive: 2, challenging: 1, neutral: 0, lean: 'harmonious' },
    a_planets_in_b_houses: [], b_planets_in_a_houses: [], top_supportive: [], top_challenging: [],
  }

  it('renders each person\'s varna/yoni/gana etc.', () => {
    const out = formatSynastryContext(synastry, { name: 'Alice' }, { name: 'Bob' })
    expect(out).toContain('Per-person gunas')
    expect(out).toContain('Alice: Varna Kshatriya')
    expect(out).toContain('Yoni Horse')
    expect(out).toContain('Bob: Varna Vaishya')
    expect(out).toContain('Yoni Elephant')
  })
})
