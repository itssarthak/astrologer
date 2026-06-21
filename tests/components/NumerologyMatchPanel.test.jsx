import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NumerologyMatchPanel from '../../src/components/Tabs/NumerologyMatchPanel'

const MATCH = {
  between: ['Alice', 'Bob'], indicative_score: 7, indicative_label: 'indicative, non-classical',
  summary_rating: 'Harmonious',
  core: { rating: 'Harmonious', score: 8 },
  driver_conductor: { rating: 'Mixed', score: 5 },
  grid: { rating: 'Mixed', score: 6, a_missing_filled_by_b: [5], b_missing_filled_by_a: [2], shared_strengths: [9] },
}

describe('NumerologyMatchPanel', () => {
  it('renders the indicative score badge and dimension ratings', () => {
    render(<NumerologyMatchPanel match={MATCH} />)
    expect(screen.getByText('Numerology Compatibility')).toBeTruthy()
    expect(screen.getByText(/indicative, non-classical/)).toBeTruthy()
    expect(screen.getByText(/7\/10/)).toBeTruthy()
    // 'Harmonious' shows in both the summary badge and the Core dimension row
    expect(screen.getAllByText(/Harmonious/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Driver–Conductor/)).toBeTruthy()
  })

  it('renders nothing when no match is provided', () => {
    const { container } = render(<NumerologyMatchPanel match={null} />)
    expect(container.firstChild).toBeNull()
  })
})
