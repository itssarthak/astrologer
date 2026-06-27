// tests/components/matchPrimitives.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FactorRow, OverlaySection, GUNA_ATTRS } from '../../src/components/Tabs/Match/matchPrimitives'

describe('matchPrimitives', () => {
  it('FactorRow renders its text', () => {
    render(<FactorRow text="Sun trine Moon" effect="supportive" />)
    expect(screen.getByText('Sun trine Moon')).toBeInTheDocument()
  })

  it('OverlaySection shows only non-neutral overlays, capped at 5 with a +N more', () => {
    const overlays = [
      ...Array.from({ length: 6 }, (_, i) => ({ planet: `P${i}`, falls_in_house: i + 1, house_meaning: 'x', effect: 'supportive' })),
      { planet: 'Q', falls_in_house: 2, house_meaning: 'y', effect: 'neutral' },
    ]
    render(<OverlaySection title="A → B" overlays={overlays} />)
    expect(screen.getByText('A → B')).toBeInTheDocument()
    expect(screen.getByText('+1 more')).toBeInTheDocument() // 6 non-neutral, 5 shown
  })

  it('OverlaySection shows a fallback when nothing is notable', () => {
    render(<OverlaySection title="A → B" overlays={[{ planet: 'P', falls_in_house: 1, house_meaning: 'x', effect: 'neutral' }]} />)
    expect(screen.getByText(/Mostly neutral/)).toBeInTheDocument()
  })

  it('GUNA_ATTRS lists the eight koota attributes', () => {
    expect(GUNA_ATTRS.map(([k]) => k)).toEqual(
      ['varna', 'vashya', 'yoni', 'sign_lord', 'gana', 'nadi', 'moon_sign', 'nakshatra'])
  })
})
