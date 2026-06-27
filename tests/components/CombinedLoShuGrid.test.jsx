import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CombinedLoShuGrid from '../../src/components/Tabs/CombinedLoShuGrid'

const A_GRID = { counts: { '1': 0, '2': 1, '3': 0, '4': 0, '5': 1, '6': 0, '7': 0, '8': 0, '9': 0 } }
const B_GRID = { counts: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 1, '9': 0 } }
const COMBINED = {
  has_raj_yog: true,
  completed_lines: [
    {
      name: 'Practical plane (8-1-6)', meaning: 'method, identity and comfort.', type: 'plane', orientation: 'horizontal',
      raj_yog: false, from: [{ number: 8, source: 'a' }, { number: 1, source: 'both' }, { number: 6, source: 'b' }],
    },
    {
      name: 'Thought plane (4-3-8)', meaning: 'planning and discipline.', type: 'plane', orientation: 'vertical',
      raj_yog: false, from: [{ number: 4, source: 'a' }, { number: 3, source: 'a' }, { number: 8, source: 'b' }],
    },
    {
      name: 'Diagonal 2-5-8', meaning: 'emotional resilience (Moon-Mercury-Saturn).', type: 'diagonal', orientation: 'diagonal',
      raj_yog: true, from: [{ number: 2, source: 'a' }, { number: 5, source: 'a' }, { number: 8, source: 'b' }],
    },
  ],
  diagonals: [
    { name: 'Diagonal 4-5-6', newly: false, from: null, missing_in_merged: [6] },
    { name: 'Diagonal 2-5-8', meaning: 'emotional resilience (Moon-Mercury-Saturn).', newly: true, missing_in_merged: [], from: [{ number: 2, source: 'a' }, { number: 5, source: 'a' }, { number: 8, source: 'b' }] },
  ],
}

describe('CombinedLoShuGrid', () => {
  it('groups completed lines under horizontal / vertical / diagonal headers', () => {
    render(<CombinedLoShuGrid aGrid={A_GRID} bGrid={B_GRID} combined={COMBINED} names={['Alice', 'Bob']} />)
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
    expect(screen.getByText('Horizontal planes')).toBeTruthy()
    expect(screen.getByText('Vertical planes')).toBeTruthy()
    expect(screen.getByText('Diagonals (Raj Yog)')).toBeTruthy()
    // The vertical plane is shown as such, not lumped with horizontals.
    expect(screen.getByText('Thought plane (4-3-8)')).toBeTruthy()
    expect(screen.getByText('Practical plane (8-1-6)')).toBeTruthy()
    expect(screen.getByText(/emotional resilience/)).toBeTruthy()
    expect(screen.getAllByText(/Raj Yog/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/8 from Bob/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders nothing without a combined block', () => {
    const { container } = render(<CombinedLoShuGrid aGrid={A_GRID} bGrid={B_GRID} combined={null} names={['A', 'B']} />)
    expect(container.firstChild).toBeNull()
  })

  it('always shows the diagonals row with the Raj Yog status when none complete', () => {
    const combined = {
      has_raj_yog: false, completed_lines: [],
      diagonals: [
        { name: 'Diagonal 4-5-6', newly: false, missing_in_merged: [5] },
        { name: 'Diagonal 2-5-8', newly: false, missing_in_merged: [5] },
      ],
    }
    render(<CombinedLoShuGrid aGrid={A_GRID} bGrid={B_GRID} combined={combined} names={['Alice', 'Bob']} />)
    expect(screen.getByText('Horizontal planes')).toBeTruthy()
    expect(screen.getByText('Vertical planes')).toBeTruthy()
    expect(screen.getByText(/none completed/)).toBeTruthy()
    expect(screen.getByText(/still missing 5/)).toBeTruthy()
  })
})
