import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoShuGrid from '../../src/components/Tabs/LoShuGrid'

const GRID = {
  counts: { '1': 3, '2': 0, '3': 1, '4': 2, '5': 0, '6': 1, '7': 0, '8': 1, '9': 2 },
  missing: [2, 5, 7], repeated: [1, 4, 9], kua: 3, kua_note: null,
  lines: [
    { name: 'Will (9-5-1)', cells: [9, 5, 1], state: 'partial', meaning: 'determination...' },
    { name: 'Mental plane (4-9-2)', cells: [4, 9, 2], state: 'partial', meaning: 'thinking...' },
  ],
  arrows_strength: [], arrows_weakness: ['Action (2-7-6)'],
}

describe('LoShuGrid', () => {
  it('renders counts, missing, repeated and Kua', () => {
    render(<LoShuGrid grid={GRID} />)
    expect(screen.getByText('Lo Shu Grid')).toBeTruthy()
    expect(screen.getByText(/Missing:/)).toHaveTextContent('2, 5, 7')
    expect(screen.getByText(/Repeated/)).toHaveTextContent('1, 4, 9')
    expect(screen.getByText(/Kua:/)).toHaveTextContent('3')
  })

  it('shows the Kua note when Kua is omitted', () => {
    render(<LoShuGrid grid={{ ...GRID, kua: null, kua_note: 'Kua omitted (requires male/female).' }} />)
    expect(screen.getByText(/Kua omitted/)).toBeTruthy()
  })

  it('renders nothing without a grid', () => {
    const { container } = render(<LoShuGrid grid={null} />)
    expect(container.firstChild).toBeNull()
  })
})
