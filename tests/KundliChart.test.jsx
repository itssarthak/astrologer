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

test('renders the rashi (sign) number for house 1', () => {
  const { container } = render(<KundliChart chart={mockChart} />)
  // House 1's sign is Aquarius (11); the chart labels each house with its sign number.
  const signNum = Array.from(container.querySelectorAll('text')).find(el => el.textContent === '11')
  expect(signNum).toBeInTheDocument()
})

test('renders Sun abbreviation in house 1', () => {
  render(<KundliChart chart={mockChart} />)
  expect(screen.getByText('Su')).toBeInTheDocument()
})

test('marks retrograde planets with the ℞ symbol', () => {
  const chartWithRetro = {
    ascendant: { sign: 'Leo' },
    houses: Array.from({ length: 12 }, (_, i) => ({
      number: i + 1,
      sign: 'Aries',
      occupants: i === 0 ? [{ celestialBody: 'Saturn', sign: 'Aries', nakshatra: 'Ashwini', motion_type: 'retrograde' }] : []
    }))
  }
  const { container } = render(<KundliChart chart={chartWithRetro} />)
  const retroText = Array.from(container.querySelectorAll('text')).find(el => el.textContent === 'Sa℞')
  expect(retroText).toBeInTheDocument()
})

test('returns null for null chart', () => {
  const { container } = render(<KundliChart chart={null} />)
  expect(container.firstChild).toBeNull()
})
