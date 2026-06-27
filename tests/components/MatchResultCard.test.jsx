// tests/components/MatchResultCard.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MatchResultCard from '../../src/components/Tabs/Match/MatchResultCard'

const A = { name: 'Asha' }
const B = { name: 'Bibek' }
const synastryData = {
  guna_milan: { total: 28, verdict: 'Good', breakdown: { nadi: { score: 8, max: 8 } }, profiles: null },
  overlay_summary: { lean: 'mixed', supportive: 3, challenging: 2, neutral: 5 },
  a_planets_in_b_houses: [], b_planets_in_a_houses: [],
  top_supportive: ['Venus supports affection'], top_challenging: [],
  marriage_factors: { a: { summary: 'A sum' }, b: { summary: 'B sum' } },
  dasha_overlap: {},
}
const numerologyMatch = null

const setup = (props = {}) => render(
  <MatchResultCard synastryData={synastryData} numerologyMatch={numerologyMatch}
    activeProfile={A} partnerProfile={B} read="" generatingRead={false} {...props} />)

describe('MatchResultCard', () => {
  it('renders nothing without synastryData', () => {
    const { container } = render(<MatchResultCard synastryData={null} activeProfile={A} partnerProfile={B} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows all four tab buttons', () => {
    setup()
    for (const t of ['Compatibility', 'Planets', 'Numerology', 'Read'])
      expect(screen.getByRole('button', { name: new RegExp(`^${t}`) })).toBeInTheDocument()
  })

  it('defaults to the Compatibility tab (Guna visible, planetary hidden)', () => {
    setup()
    expect(screen.getByText('Guna Milan')).toBeInTheDocument()
    expect(screen.queryByText('Planetary compatibility')).not.toBeInTheDocument()
  })

  it('clicking Planets reveals planetary content and hides Guna', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /^Planets/ }))
    expect(screen.getByText('Planetary compatibility')).toBeInTheDocument()
    expect(screen.queryByText('Guna Milan')).not.toBeInTheDocument()
  })

  it('clicking Read shows the passed read text', () => {
    setup({ read: 'You balance each other well.' })
    fireEvent.click(screen.getByRole('button', { name: /^Read/ }))
    expect(screen.getByText('You balance each other well.')).toBeInTheDocument()
  })

  it('marks the Read tab as generating while generatingRead is true', () => {
    setup({ generatingRead: true })
    const readBtn = screen.getByRole('button', { name: /^Read/ })
    expect(readBtn.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('resets to Compatibility when a new synastryData arrives', () => {
    const { rerender } = setup()
    fireEvent.click(screen.getByRole('button', { name: /^Planets/ }))
    expect(screen.getByText('Planetary compatibility')).toBeInTheDocument()
    rerender(<MatchResultCard synastryData={{ ...synastryData }} numerologyMatch={numerologyMatch}
      activeProfile={A} partnerProfile={B} read="" generatingRead={false} />)
    expect(screen.getByText('Guna Milan')).toBeInTheDocument()
    expect(screen.queryByText('Planetary compatibility')).not.toBeInTheDocument()
  })
})
