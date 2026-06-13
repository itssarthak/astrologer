import { describe, it, expect } from 'vitest'
import { savBand, transitLine } from '../../../src/lib/llm/tools'

describe('savBand', () => {
  it('bands SAV bindus: >=30 strong, 25-29 average, <25 weak', () => {
    expect(savBand(35)).toBe('strong')
    expect(savBand(30)).toBe('strong')
    expect(savBand(29)).toBe('average')
    expect(savBand(25)).toBe('average')
    expect(savBand(24)).toBe('weak')
    expect(savBand(0)).toBe('weak')
  })
})

describe('transitLine', () => {
  const sav = { Aquarius: 27, Leo: 32, Aries: 20 }

  it('appends SAV bindu + band when available for the transiting sign', () => {
    const line = transitLine({ planet: 'Saturn', sign: 'Aquarius', natal_house: 1, retrograde: false }, sav)
    expect(line).toBe('Saturn in Aquarius → natal H1 · SAV 27 (average)')
  })

  it('marks retrograde and bands strong/weak', () => {
    expect(transitLine({ planet: 'Jupiter', sign: 'Leo', natal_house: 7, retrograde: true }, sav))
      .toBe('Jupiter in Leo → natal H7 (retro) · SAV 32 (strong)')
    expect(transitLine({ planet: 'Mars', sign: 'Aries', natal_house: 3, retrograde: false }, sav))
      .toBe('Mars in Aries → natal H3 · SAV 20 (weak)')
  })

  it('omits the SAV suffix when the sign has no bindu (older charts / missing sav)', () => {
    expect(transitLine({ planet: 'Sun', sign: 'Pisces', natal_house: 2, retrograde: false }, sav))
      .toBe('Sun in Pisces → natal H2')
    expect(transitLine({ planet: 'Sun', sign: 'Pisces', natal_house: 2, retrograde: false }, undefined))
      .toBe('Sun in Pisces → natal H2')
  })
})
