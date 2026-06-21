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

describe('planetLines (with shadbala)', () => {
  it('appends rupas/min_required when present, omits when absent', () => {
    const lines = planetLines(FACTS)
    expect(lines[0]).toContain('Saturn: Capricorn (H5), moolatrikona, strong')
    expect(lines[0]).toContain('7.8/7 rupas')
    expect(lines[1]).not.toContain('rupas') // Sun has no shadbala numbers
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

describe('divisionalPlacementLine', () => {
  it('includes dignity and nakshatra/pada when present', () => {
    const occ = { celestialBody: 'Mars', sign: 'Aries', dignities: { dignity: 'exalted' }, nakshatra: 'Ashwini', pada: 1, motion_type: 'direct' }
    expect(divisionalPlacementLine(occ, 3)).toBe('Mars in Aries (H3) — exalted, Ashwini pada 1')
  })

  it('marks retrograde and tolerates missing dignity/nakshatra', () => {
    const occ = { celestialBody: 'Venus', sign: 'Libra', motion_type: 'retrograde' }
    expect(divisionalPlacementLine(occ, 7)).toBe('Venus in Libra (H7) retro')
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
