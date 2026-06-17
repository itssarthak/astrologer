import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProfilesProvider } from '../src/contexts/ProfilesContext'
import { clearApiKey } from '../src/lib/storage/keys'
import { hydrate, resetStorageForTests } from '../src/lib/storage/db'

// Mock pages so we can test routing without full deps
vi.mock('../src/pages/Onboarding', () => ({ default: () => <div>onboarding</div> }))
vi.mock('../src/pages/MainApp', () => ({ default: () => <div>mainapp</div> }))

import AppRouter from '../src/router'

beforeEach(async () => {
  localStorage.clear()
  await resetStorageForTests()
})

const renderRouter = () =>
  render(
    <ProfilesProvider>
      <MemoryRouter initialEntries={['/']}><AppRouter /></MemoryRouter>
    </ProfilesProvider>
  )

// Seed legacy localStorage, then hydrate the cache from it — exactly what <StorageGate> does at
// startup before the routes (and their guards) render.
async function seedSetup() {
  localStorage.setItem('astro:profiles', JSON.stringify([{ id: '1', name: 'Test' }]))
  localStorage.setItem('astro:activeProfileId', '1')
  localStorage.setItem('astro:apiKey', JSON.stringify({ provider: 'claude', key: 'sk-test' }))
  await hydrate()
}

test('redirects to /onboarding when no profile exists', async () => {
  await hydrate()
  renderRouter()
  expect(screen.getByText('onboarding')).toBeInTheDocument()
})

test('redirects to /app when profile exists', async () => {
  await seedSetup()
  renderRouter()
  expect(screen.getByText('mainapp')).toBeInTheDocument()
})

test('redirects back to onboarding when the API key is cleared at runtime', async () => {
  await seedSetup()
  renderRouter()
  expect(screen.getByText('mainapp')).toBeInTheDocument()
  // Don't return the (now async) clearApiKey promise into act — we only need the synchronous
  // cache update + notify to flush. Returning a thenable would defer the re-render past the assert.
  act(() => { clearApiKey() })
  expect(screen.getByText('onboarding')).toBeInTheDocument()
})
