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
    expect(line).toContain('Saturn in Aquarius → natal H1 · SAV 27 (average)')
    expect(line).toMatch(/karaka:.*discipline/i)
  })

  it('marks retrograde and bands strong/weak', () => {
    const jup = transitLine({ planet: 'Jupiter', sign: 'Leo', natal_house: 7, retrograde: true }, sav)
    expect(jup).toContain('Jupiter in Leo → natal H7 (retro) · SAV 32 (strong)')
    expect(jup).toMatch(/karaka:.*wisdom|wealth/i)
    const mar = transitLine({ planet: 'Mars', sign: 'Aries', natal_house: 3, retrograde: false }, sav)
    expect(mar).toContain('Mars in Aries → natal H3 · SAV 20 (weak)')
    expect(mar).toMatch(/karaka:.*energy|courage/i)
  })

  it('omits the SAV suffix when the sign has no bindu (older charts / missing sav)', () => {
    const line1 = transitLine({ planet: 'Sun', sign: 'Pisces', natal_house: 2, retrograde: false }, sav)
    expect(line1).toContain('Sun in Pisces → natal H2')
    expect(line1).toMatch(/karaka:.*soul|father/i)
    const line2 = transitLine({ planet: 'Sun', sign: 'Pisces', natal_house: 2, retrograde: false }, undefined)
    expect(line2).toContain('Sun in Pisces → natal H2')
    expect(line2).toMatch(/karaka:.*soul|father/i)
  })

  it('appends the transiting planet karaka', () => {
    const line = transitLine({ planet: 'Saturn', sign: 'Libra', natal_house: 7, retrograde: false }, { Libra: 31 })
    expect(line).toContain('Saturn in Libra → natal H7')
    expect(line).toContain('SAV 31 (strong)')
    expect(line).toMatch(/karaka:.*discipline/i)
  })
})
