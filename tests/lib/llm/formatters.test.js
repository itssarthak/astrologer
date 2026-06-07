import { describe, it, expect } from 'vitest'
import { formatTransitContext, formatNumerologyContext, formatSynastryContext } from '../../../src/lib/prompts/formatters'

describe('formatTransitContext', () => {
  it('includes date and planet count', () => {
    const transit = {
      date: '2026-06-07', time: '07:00',
      panchanga: { tithi: 'Shukla Tritiya' },
      planets: [
        { planet: 'Sun', sign: 'Taurus', natal_house: 4, retrograde: false },
        { planet: 'Moon', sign: 'Scorpio', natal_house: 10, retrograde: false },
      ],
    }
    const result = formatTransitContext(transit, {})
    expect(result).toContain('2026-06-07')
    expect(result).toContain('H4')
    expect(result).toContain('H10')
  })

  it('marks retrograde planets', () => {
    const transit = {
      date: '2026-06-07', time: '07:00',
      panchanga: {},
      planets: [{ planet: 'Saturn', sign: 'Aquarius', natal_house: 1, retrograde: true }],
    }
    expect(formatTransitContext(transit, {})).toContain('retrograde')
  })
})

describe('formatNumerologyContext', () => {
  it('includes all five number types', () => {
    const num = {
      life_path: 7,
      destiny: { chaldean: 5, pythagorean: 6 },
      soul_urge: { chaldean: 3, pythagorean: 3 },
      personality: { chaldean: 2, pythagorean: 3 },
      personal_year: 9,
    }
    const result = formatNumerologyContext(num)
    expect(result).toContain('Life Path: 7')
    expect(result).toContain('Personal Year: 9')
  })
})

describe('formatSynastryContext', () => {
  it('includes both profile names and total score', () => {
    const synastry = {
      guna_milan: {
        total: 26, verdict: 'Strong',
        breakdown: {
          nadi: { score: 8, max: 8 },
          bhakoot: { score: 7, max: 7 },
        },
      },
      a_planets_in_b_houses: [{ planet: 'Jupiter', falls_in_house: 7, sign: 'Libra' }],
      b_planets_in_a_houses: [],
    }
    const result = formatSynastryContext(synastry, { name: 'Sarthak' }, { name: 'Tanya' })
    expect(result).toContain('Sarthak')
    expect(result).toContain('Tanya')
    expect(result).toContain('26/36')
  })
})
