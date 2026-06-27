// tests/components/matchSections.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import GunaMilanSection from '../../src/components/Tabs/Match/GunaMilanSection'
import StrongestCurrentsSection from '../../src/components/Tabs/Match/StrongestCurrentsSection'
import PlanetaryOverlaysSection from '../../src/components/Tabs/Match/PlanetaryOverlaysSection'
import MarriageSection from '../../src/components/Tabs/Match/MarriageSection'

const A = { name: 'Asha' }
const B = { name: 'Bibek' }
const guna = {
  total: 28, verdict: 'Good',
  breakdown: { varna: { score: 1, max: 1 }, nadi: { score: 8, max: 8 } },
  profiles: {
    a: { varna: 'Brahmin', vashya: 'Nara', yoni: 'Horse', sign_lord: 'Mars', gana: 'Deva', nadi: 'Aadi', moon_sign: 'Aries', nakshatra: 'Ashwini' },
    b: { varna: 'Kshatriya', vashya: 'Jalachara', yoni: 'Elephant', sign_lord: 'Venus', gana: 'Manava', nadi: 'Madhya', moon_sign: 'Taurus', nakshatra: 'Rohini' },
  },
}
const synastry = {
  top_supportive: ['Venus supports affection'],
  top_challenging: ['Saturn slows things'],
  overlay_summary: { lean: 'mixed', supportive: 3, challenging: 2, neutral: 5 },
  a_planets_in_b_houses: [{ planet: 'Venus', falls_in_house: 7, house_meaning: 'partnership', effect: 'supportive' }],
  b_planets_in_a_houses: [{ planet: 'Mars', falls_in_house: 1, house_meaning: 'self', effect: 'challenging' }],
  marriage_factors: { a: { summary: 'A summary' }, b: { summary: 'B summary' } },
  dasha_overlap: { note: 'Both in Venus periods' },
}

describe('Match sections', () => {
  it('GunaMilanSection shows the score and a koota + per-person attrs', () => {
    render(<GunaMilanSection guna={guna} activeProfile={A} partnerProfile={B} />)
    expect(screen.getByText('Guna Milan')).toBeInTheDocument()
    expect(screen.getByText('/36')).toBeInTheDocument()
    expect(screen.getByText('Brahmin')).toBeInTheDocument()
    expect(screen.getByText('Kshatriya')).toBeInTheDocument()
  })

  it('StrongestCurrentsSection lists supportive and challenging factors, null when empty', () => {
    const { container, rerender } = render(<StrongestCurrentsSection synastryData={synastry} />)
    expect(screen.getByText('Venus supports affection')).toBeInTheDocument()
    expect(screen.getByText('Saturn slows things')).toBeInTheDocument()
    rerender(<StrongestCurrentsSection synastryData={{ top_supportive: [], top_challenging: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('PlanetaryOverlaysSection shows lean + counts + both overlay lists, null without summary', () => {
    const { container, rerender } = render(
      <PlanetaryOverlaysSection synastryData={synastry} summary={synastry.overlay_summary} activeProfile={A} partnerProfile={B} />)
    expect(screen.getByText('Planetary compatibility')).toBeInTheDocument()
    expect(screen.getByText(/3 supportive/)).toBeInTheDocument()
    expect(screen.getByText('Asha → Bibek')).toBeInTheDocument()
    rerender(<PlanetaryOverlaysSection synastryData={synastry} summary={null} activeProfile={A} partnerProfile={B} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('MarriageSection shows per-person summaries + current period, null without marriage_factors', () => {
    const { container, rerender } = render(<MarriageSection synastryData={synastry} activeProfile={A} partnerProfile={B} />)
    expect(screen.getByText('Marriage significators')).toBeInTheDocument()
    expect(screen.getByText('A summary')).toBeInTheDocument()
    expect(screen.getByText(/Both in Venus periods/)).toBeInTheDocument()
    rerender(<MarriageSection synastryData={{}} activeProfile={A} partnerProfile={B} />)
    expect(container).toBeEmptyDOMElement()
  })
})
