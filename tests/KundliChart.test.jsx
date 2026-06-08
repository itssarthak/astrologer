import { render, screen } from '@testing-library/react'
import KundliChart from '../src/components/Kundli/KundliChart'

// mockChart: ascendant is Leo, H1 sign is Aquarius — distinct so lagna center is unambiguous
const mockChart = {
  ascendant: { sign: 'Leo' },
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
  const { container } = render(<KundliChart chart={mockChart} />)
  // Find SVG text nodes containing 'Leo' (the ascendant sign, not in any house)
  const lagnaText = Array.from(container.querySelectorAll('text')).find(el => el.textContent === 'Leo')
  expect(lagnaText).toBeInTheDocument()
})

test('renders Sun abbreviation in house 1', () => {
  render(<KundliChart chart={mockChart} />)
  expect(screen.getByText('Su')).toBeInTheDocument()
})

test('renders retrograde suffix R for retrograde planets', () => {
  const chartWithRetro = {
    ascendant: { sign: 'Leo' },
    houses: Array.from({ length: 12 }, (_, i) => ({
      number: i + 1,
      sign: 'Aries',
      occupants: i === 0 ? [{ celestialBody: 'Saturn', sign: 'Aries', nakshatra: 'Ashwini', motion_type: 'retrograde' }] : []
    }))
  }
  const { container } = render(<KundliChart chart={chartWithRetro} />)
  const retroText = Array.from(container.querySelectorAll('text')).find(el => el.textContent === 'SaR')
  expect(retroText).toBeInTheDocument()
})

test('returns null for null chart', () => {
  const { container } = render(<KundliChart chart={null} />)
  expect(container.firstChild).toBeNull()
})
