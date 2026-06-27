// tests/components/ChartPanel.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ChartPanel from '../../src/components/Kundli/ChartPanel'

const profile = {
  chart: {
    d1Chart: { houses: [{ number: 1, sign: 'Virgo', occupants: [] }] },
    divisionalCharts: { d9: { houses: [{ number: 1, sign: 'Aries', occupants: [] }] } },
  },
  yogas: [{ name: 'Gajakesari' }],
  doshas: { mangal: { present: true } },
}

describe('ChartPanel', () => {
  it('returns nothing when no chart', () => {
    const { container } = render(<ChartPanel profile={{}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a varga tab per computed divisional plus D1', () => {
    render(<ChartPanel profile={profile} />)
    expect(screen.getByRole('button', { name: 'D1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'D9' })).toBeInTheDocument()
  })

  it('shows yogas and doshas', () => {
    render(<ChartPanel profile={profile} />)
    expect(screen.getByText('Gajakesari')).toBeInTheDocument()
    expect(screen.getByText('mangal')).toBeInTheDocument()
  })

  it('switches the active varga on tab click', () => {
    render(<ChartPanel profile={profile} />)
    fireEvent.click(screen.getByRole('button', { name: 'D9' }))
    expect(screen.getByText('D9').className).toContain('bg-primary')
  })
})
