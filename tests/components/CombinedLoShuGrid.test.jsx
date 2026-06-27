import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CombinedLoShuGrid from '../../src/components/Tabs/CombinedLoShuGrid'

const A_GRID = { counts: { '1': 0, '2': 1, '3': 0, '4': 0, '5': 1, '6': 0, '7': 0, '8': 0, '9': 0 } }
const B_GRID = { counts: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 1, '9': 0 } }
const COMBINED = {
  has_raj_yog: true,
  completed_lines: [
    {
      name: 'Diagonal 2-5-8', cells: [2, 5, 8], meaning: 'emotional resilience (Moon-Mercury-Saturn).',
      type: 'diagonal', raj_yog: true,
      from: [{ number: 2, source: 'a' }, { number: 5, source: 'a' }, { number: 8, source: 'b' }],
    },
  ],
}

describe('CombinedLoShuGrid', () => {
  it('renders the legend, completed line, sourced meaning and Raj Yog badge', () => {
    render(<CombinedLoShuGrid aGrid={A_GRID} bGrid={B_GRID} combined={COMBINED} names={['Alice', 'Bob']} />)
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
    expect(screen.getByText(/emotional resilience/)).toBeTruthy()
    expect(screen.getAllByText(/Raj Yog/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/8 from Bob/)).toBeTruthy()
  })

  it('renders nothing without a combined block', () => {
    const { container } = render(<CombinedLoShuGrid aGrid={A_GRID} bGrid={B_GRID} combined={null} names={['A', 'B']} />)
    expect(container.firstChild).toBeNull()
  })

  it('notes when the pairing completes no new lines', () => {
    render(<CombinedLoShuGrid aGrid={A_GRID} bGrid={B_GRID} combined={{ has_raj_yog: false, completed_lines: [] }} names={['Alice', 'Bob']} />)
    expect(screen.getByText(/No new planes/)).toBeTruthy()
  })
})
