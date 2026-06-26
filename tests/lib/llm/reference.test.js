import { it, expect } from 'vitest'
import { lookupReference, DIVISIONALS, SHODASAVARGA } from '../../../src/lib/llm/reference'

it('resolves a divisional by id, marking non-standard ones', () => {
  const d5 = lookupReference('d5')[0]
  expect(d5).toMatchObject({ topic: 'divisional', id: 'd5', name: 'Panchamsa', standard: false })
  const d9 = lookupReference('d9')[0]
  expect(d9).toMatchObject({ id: 'd9', name: 'Navamsa', standard: true })
})

it('resolves a divisional by name — Trimsamsa is D30 (not D5)', () => {
  const t = lookupReference('trimsamsa')[0]
  expect(t).toMatchObject({ topic: 'divisional', id: 'd30', name: 'Trimsamsa' })
  expect(DIVISIONALS.d5.name).not.toMatch(/Trimsamsa/i)
})

it('knows planets, terms, and the dasha system', () => {
  expect(lookupReference('Saturn')[0]).toMatchObject({ topic: 'planet', planet: 'Saturn' })
  expect(lookupReference('kendra')[0]).toMatchObject({ topic: 'term', term: 'kendra' })
  expect(lookupReference('vimshottari')[0]).toMatchObject({ topic: 'dasha-system', total: 120 })
})

it('returns nothing for an unknown term (so the agent says it is unsure, not invents)', () => {
  expect(lookupReference('d999')).toEqual([])
  expect(lookupReference('flibbertigibbet')).toEqual([])
})

it('the standard Shodasavarga set is the 16 classical charts', () => {
  expect(SHODASAVARGA).toHaveLength(16)
  expect(SHODASAVARGA).toContain('d30')
  expect(SHODASAVARGA).not.toContain('d5')
})

import {
  HOUSES, SIGNS, NUMEROLOGY_NUMBERS,
  houseMeaning, signMeaning, numberMeaning, dignityEffect, planetKaraka,
} from '../../../src/lib/llm/reference'

it('has a signification for every house 1-12 with classifications', () => {
  for (let n = 1; n <= 12; n++) {
    expect(HOUSES[n]).toBeDefined()
    expect(typeof HOUSES[n].signifies).toBe('string')
    expect(Array.isArray(HOUSES[n].classifications)).toBe(true)
  }
  expect(HOUSES[1].classifications).toEqual(expect.arrayContaining(['kendra', 'trikona']))
  expect(HOUSES[6].classifications).toEqual(expect.arrayContaining(['dusthana', 'upachaya']))
})

it('houseMeaning accepts number or string, undefined for out of range', () => {
  expect(houseMeaning(7)).toMatch(/marriage/i)
  expect(houseMeaning('7')).toMatch(/marriage/i)
  expect(houseMeaning(13)).toBeUndefined()
})

it('has all 12 signs with element/quality/ruler/nature and looks up case-insensitively', () => {
  expect(Object.keys(SIGNS)).toHaveLength(12)
  expect(signMeaning('scorpio')).toMatchObject({ ruler: 'Mars', element: 'water' })
  expect(signMeaning('Unknownia')).toBeUndefined()
})

it('has numerology numbers 1-9 with the canonical Chaldean rulers', () => {
  const rulers = { 1: 'Sun', 2: 'Moon', 3: 'Jupiter', 4: 'Rahu', 5: 'Mercury', 6: 'Venus', 7: 'Ketu', 8: 'Saturn', 9: 'Mars' }
  for (let n = 1; n <= 9; n++) {
    expect(NUMEROLOGY_NUMBERS[n].ruler).toBe(rulers[n])
    expect(typeof NUMEROLOGY_NUMBERS[n].traits).toBe('string')
  }
  expect(numberMeaning(3)).toMatchObject({ ruler: 'Jupiter' })
  expect(numberMeaning('3')).toMatchObject({ ruler: 'Jupiter' })
  expect(numberMeaning(0)).toBeUndefined()
})

it('dignityEffect normalises both canonical and raw jyotishganit dignity strings', () => {
  expect(dignityEffect('exalted')).toMatch(/strong|strength/i)
  expect(dignityEffect('deep_exaltation')).toBe(dignityEffect('exalted'))
  expect(dignityEffect('own_sign')).toBe(dignityEffect('own'))
  expect(dignityEffect('deep_debilitation')).toBe(dignityEffect('debilitated'))
  expect(dignityEffect('nonsense')).toBeUndefined()
})

it('planetKaraka returns the karaka of a known planet, case-insensitive', () => {
  expect(planetKaraka('venus')).toMatch(/marriage|love/i)
  expect(planetKaraka('Pluto')).toBeUndefined()
})

it('astro_reference lookup covers houses, signs and numbers', () => {
  expect(lookupReference('7th house')).toEqual(
    expect.arrayContaining([expect.objectContaining({ topic: 'house', house: 7 })]))
  expect(lookupReference('Scorpio')).toEqual(
    expect.arrayContaining([expect.objectContaining({ topic: 'sign', sign: 'Scorpio' })]))
  expect(lookupReference('number 8')).toEqual(
    expect.arrayContaining([expect.objectContaining({ topic: 'number', number: 8 })]))
})
