import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock pages so we can test routing without full deps
vi.mock('../src/pages/Onboarding', () => ({ default: () => <div>onboarding</div> }))
vi.mock('../src/pages/MainApp', () => ({ default: () => <div>mainapp</div> }))

import AppRouter from '../src/router'

test('redirects to /onboarding when no profile in localStorage', () => {
  localStorage.clear()
  render(<MemoryRouter initialEntries={['/']}><AppRouter /></MemoryRouter>)
  expect(screen.getByText('onboarding')).toBeInTheDocument()
})

test('redirects to /app when profile exists', () => {
  localStorage.setItem('astro:profiles', JSON.stringify([{ id: '1', name: 'Test' }]))
  localStorage.setItem('astro:activeProfileId', '1')
  localStorage.setItem('astro:apiKey', JSON.stringify({ provider: 'claude', key: 'sk-test' }))
  render(<MemoryRouter initialEntries={['/']}><AppRouter /></MemoryRouter>)
  expect(screen.getByText('mainapp')).toBeInTheDocument()
})
