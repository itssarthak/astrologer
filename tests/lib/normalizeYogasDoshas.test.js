import { describe, it, expect } from 'vitest'
import { normalizeYogasDoshas } from '../../src/hooks/usePyodide'

describe('normalizeYogasDoshas', () => {
  it('normalizes the Pyodide-fallback yoga shape ({name,category,planets})', () => {
    const out = normalizeYogasDoshas({
      yogas_active: [{ name: 'Lakshmi', category: 'Raja', planets: ['Venus'] }],
      doshas: { manglik: { present: true, text: 'Manglik' } },
    })
    expect(out.yogas_active[0]).toEqual({ name: 'Lakshmi', category: 'Raja', description: null })
    expect(out.doshas.manglik).toEqual({ present: true, text: 'Manglik' })
  })

  it('normalizes the Lambda yoga shape ({name,description})', () => {
    const out = normalizeYogasDoshas({
      yogas_active: [{ name: 'Gajakesari', description: 'Jupiter–Moon' }],
      doshas: { kala_sarpa: { present: false, text: 'No Kala Sarpa' } },
    })
    expect(out.yogas_active[0]).toEqual({ name: 'Gajakesari', category: null, description: 'Jupiter–Moon' })
  })

  it('preserves the richer dosha detail when the engine supplies it', () => {
    const out = normalizeYogasDoshas({
      yogas_active: [],
      doshas: {
        manglik: { present: true, text: 'Mangal Dosha present', severity: 'full', cancelled: false },
        kalathra: { present: true, text: 'Kalathra', afflictors: ['Saturn'] },
      },
    })
    expect(out.doshas.manglik).toEqual({ present: true, text: 'Mangal Dosha present', severity: 'full', cancelled: false })
    expect(out.doshas.kalathra).toEqual({ present: true, text: 'Kalathra', afflictors: ['Saturn'] })
  })

  it('coerces missing/odd inputs to the canonical contract', () => {
    const out = normalizeYogasDoshas({ yogas_active: ['BareString'], doshas: { x: null } })
    expect(out.yogas_active[0]).toEqual({ name: 'BareString', category: null, description: null })
    expect(out.doshas.x).toEqual({ present: false, text: '' })
    expect(normalizeYogasDoshas()).toEqual({ yogas_active: [], doshas: {} })
  })
})
