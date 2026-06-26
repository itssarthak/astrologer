import { describe, it, expect } from 'vitest'
import { planetLines, planetAspects, divisionalPlacementLine, trimCrossAspect } from '../../../src/lib/llm/tools'

const FACTS = {
  planets: {
    Saturn: {
      sign: 'Capricorn', house: 5, dignity: 'moolatrikona', strength: 'strong', retrograde: false,
      rupas: 7.8, min_required: 7, nakshatra: 'Uttara Ashadha', pada: 2,
      aspects_gives: [{ to_planet: 'Mars', aspect_type: '3' }, { to_house: 7, aspect_type: '7' }],
      aspects_receives: [], conjuncts: ['Moon'],
    },
    Sun: {
      sign: 'Leo', house: 12, dignity: 'own', strength: 'adequate', retrograde: false,
      // a `receives` entry names the aspecting planet via from_planet (NOT to_planet)
      aspects_gives: [], aspects_receives: [{ from_planet: 'Saturn', aspect_type: '7' }], conjuncts: [],
    },
  },
}

describe('planetLines (with shadbala + meanings)', () => {
  it('appends karaka, house and dignity meaning clauses', () => {
    const lines = planetLines(FACTS)
    expect(lines[0]).toContain('Saturn: Capricorn (H5), moolatrikona, strong')
    expect(lines[0]).toContain('7.8/7 rupas')
    expect(lines[0]).toMatch(/karaka:.*discipline/i)        // planet karaka (Saturn)
    expect(lines[0]).toMatch(/house:.*children/i)           // H5 signification
    expect(lines[0]).toMatch(/dignity:.*comfortable|strong/i) // moolatrikona effect
    expect(lines[1]).not.toContain('rupas')                 // Sun has no shadbala
    expect(lines[1]).toMatch(/karaka:.*soul|father/i)
  })
})

describe('planetAspects', () => {
  it('returns gives/receives/conjuncts per planet', () => {
    const all = planetAspects(FACTS)
    expect(all).toHaveLength(2)
    const sat = all.find(a => a.planet === 'Saturn')
    expect(sat.gives).toContain('Mars (3)')
    expect(sat.gives).toContain('H7 (7)')
    expect(sat.conjuncts).toEqual(['Moon'])
  })

  it('filters to a single planet (case-insensitive)', () => {
    const out = planetAspects(FACTS, 'sun')
    expect(out).toHaveLength(1)
    expect(out[0].planet).toBe('Sun')
    expect(out[0].receives).toContain('Saturn (7)')
    // guard against the from_planet/to_planet mix-up that rendered "Hundefined"
    expect(out[0].receives.join(' ')).not.toMatch(/undefined/)
  })
})

describe('divisionalPlacementLine (with meanings)', () => {
  it('appends the planet karaka', () => {
    const occ = { celestialBody: 'Mars', sign: 'Aries', motion_type: 'direct',
      dignities: { dignity: 'exalted' }, nakshatra: 'Ashwini', pada: 1 }
    const line = divisionalPlacementLine(occ, 3)
    expect(line).toContain('Mars in Aries (H3) — exalted, Ashwini pada 1')
    expect(line).toMatch(/karaka:.*energy|courage/i)
  })
})

describe('trimCrossAspect', () => {
  it('labels both owners and keeps orb/tightness/weight', () => {
    const ca = { from: 'Jupiter', from_owner: 'A', to: 'Venus', type: 'aspect', effect: 'supportive', tightness: 'tight', orb: 0.5, weight: 1.5, note: 'warms' }
    expect(trimCrossAspect(ca)).toEqual({
      from: 'A:Jupiter', to: 'B:Venus', type: 'aspect', effect: 'supportive', tightness: 'tight', orb: 0.5, weight: 1.5, note: 'warms',
    })
  })
})
