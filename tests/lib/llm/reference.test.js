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
