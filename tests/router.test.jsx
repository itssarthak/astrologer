import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProfilesProvider } from '../src/contexts/ProfilesContext'
import { clearApiKey } from '../src/lib/storage/keys'

// Mock pages so we can test routing without full deps
vi.mock('../src/pages/Onboarding', () => ({ default: () => <div>onboarding</div> }))
vi.mock('../src/pages/MainApp', () => ({ default: () => <div>mainapp</div> }))

import AppRouter from '../src/router'

const renderRouter = () =>
  render(
    <ProfilesProvider>
      <MemoryRouter initialEntries={['/']}><AppRouter /></MemoryRouter>
    </ProfilesProvider>
  )

function seedSetup() {
  localStorage.setItem('astro:profiles', JSON.stringify([{ id: '1', name: 'Test' }]))
  localStorage.setItem('astro:activeProfileId', '1')
  localStorage.setItem('astro:apiKey', JSON.stringify({ provider: 'claude', key: 'sk-test' }))
}

test('redirects to /onboarding when no profile in localStorage', () => {
  localStorage.clear()
  renderRouter()
  expect(screen.getByText('onboarding')).toBeInTheDocument()
})

test('redirects to /app when profile exists', () => {
  seedSetup()
  renderRouter()
  expect(screen.getByText('mainapp')).toBeInTheDocument()
})

test('redirects back to onboarding when the API key is cleared at runtime', () => {
  seedSetup()
  renderRouter()
  expect(screen.getByText('mainapp')).toBeInTheDocument()
  act(() => clearApiKey())
  expect(screen.getByText('onboarding')).toBeInTheDocument()
})
