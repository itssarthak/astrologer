import { render, screen } from '@testing-library/react'
import StorageGate from '../src/components/StorageGate'
import { getProfiles } from '../src/lib/storage/profiles'
import { resetStorageForTests } from '../src/lib/storage/db'

beforeEach(async () => {
  localStorage.clear()
  await resetStorageForTests()
})

function Child() {
  return <div>profile:{getProfiles()[0]?.name ?? 'none'}</div>
}

test('does not render children until hydration completes', () => {
  localStorage.setItem('astro:profiles', JSON.stringify([{ id: '1', name: 'Hydrated' }]))
  render(<StorageGate><Child /></StorageGate>)
  // Synchronously after mount the gate is still hydrating, so the child is absent.
  expect(screen.queryByText(/profile:/)).toBeNull()
})

test('renders children once hydrated, with the cache populated from storage', async () => {
  localStorage.setItem('astro:profiles', JSON.stringify([{ id: '1', name: 'Hydrated' }]))
  render(<StorageGate><Child /></StorageGate>)
  // After hydration the child renders and sees the hydrated cache (no flash of empty state).
  expect(await screen.findByText('profile:Hydrated')).toBeInTheDocument()
})
