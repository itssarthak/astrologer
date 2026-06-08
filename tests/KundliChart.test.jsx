import { render, screen } from '@testing-library/react'
import KundliChart from '../src/components/Kundli/KundliChart'

const mockChart = {
  ascendant: { sign: 'Aquarius' },
  houses: Array.from({ length: 12 }, (_, i) => ({
    number: i + 1,
    sign: ['Aquarius','Pisces','Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn'][i],
    occupants: i === 0 ? [{ celestialBody: 'Sun', sign: 'Aquarius', nakshatra: 'Shatabhisha', motion_type: 'direct' }] : []
  }))
}

test('renders SVG with chart content', () => {
  const { container } = render(<KundliChart chart={mockChart} />)
  const svg = container.querySelector('svg')
  expect(svg).toBeInTheDocument()
})

test('renders lagna sign in center', () => {
  render(<KundliChart chart={mockChart} />)
  const matches = screen.getAllByText(/aquarius/i)
  expect(matches.length).toBeGreaterThan(0)
})

test('renders Sun abbreviation in house 1', () => {
  render(<KundliChart chart={mockChart} />)
  expect(screen.getByText('Su')).toBeInTheDocument()
})
