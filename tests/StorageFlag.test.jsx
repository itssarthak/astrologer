import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

// Drive the flag from a controllable estimate.
let mockEstimate = null
vi.mock('../src/hooks/useStorageEstimate', () => ({
  useStorageEstimate: () => ({ estimate: mockEstimate, refresh: () => {} }),
}))

import StorageFlag from '../src/components/StorageFlag'

beforeEach(() => { mockEstimate = null })

test('renders nothing when usage is below the warn threshold', () => {
  mockEstimate = { usage: 80, quota: 100, percent: 80 }
  const { container } = render(<StorageFlag />)
  expect(container).toBeEmptyDOMElement()
})

test('renders nothing when no estimate is available', () => {
  mockEstimate = null
  const { container } = render(<StorageFlag />)
  expect(container).toBeEmptyDOMElement()
})

test('shows a warning at or above 90% with the percentage', () => {
  mockEstimate = { usage: 92, quota: 100, percent: 92 }
  render(<StorageFlag />)
  expect(screen.getByRole('status')).toHaveTextContent('92%')
  expect(screen.getByText(/almost full/i)).toBeInTheDocument()
})

test('can be dismissed for the session', () => {
  mockEstimate = { usage: 92, quota: 100, percent: 92 }
  render(<StorageFlag />)
  fireEvent.click(screen.getByLabelText(/dismiss/i))
  expect(screen.queryByRole('status')).toBeNull()
})

test('re-surfaces after dismissal once usage climbs another step', () => {
  mockEstimate = { usage: 92, quota: 100, percent: 92 }
  const { rerender } = render(<StorageFlag />)
  fireEvent.click(screen.getByLabelText(/dismiss/i))
  expect(screen.queryByRole('status')).toBeNull()

  // Usage worsens past the next 5-point step → warning comes back.
  mockEstimate = { usage: 98, quota: 100, percent: 98 }
  rerender(<StorageFlag />)
  expect(screen.getByRole('status')).toHaveTextContent('98%')
})
