import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NumerologyMatchPanel from '../../src/components/Tabs/NumerologyMatchPanel'

const MATCH = {
  between: ['Alice', 'Bob'], indicative_score: 7, indicative_label: 'indicative, non-classical',
  summary_rating: 'Harmonious',
  core: { rating: 'Harmonious', score: 8 },
  driver_conductor: { rating: 'Mixed', score: 5 },
  grid: {
    rating: 'Mixed', score: 6, a_missing_filled_by_b: [5], b_missing_filled_by_a: [2], shared_strengths: [9],
    a_grid: { counts: { '1': 1, '4': 1 }, missing: [5, 7], repeated: [], kua: 3, arrows_strength: [], arrows_weakness: [] },
    b_grid: { counts: { '2': 1, '9': 2 }, missing: [3, 4], repeated: [9], kua: 6, arrows_strength: [], arrows_weakness: [] },
  },
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

  it('renders a Lo Shu grid for each partner', () => {
    render(<NumerologyMatchPanel match={MATCH} />)
    // One labelled grid per person (the panel header plus two grid headers).
    expect(screen.getAllByText('Lo Shu Grid').length).toBe(2)
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
  })

  it('renders nothing when no match is provided', () => {
    const { container } = render(<NumerologyMatchPanel match={null} />)
    expect(container.firstChild).toBeNull()
  })
})
