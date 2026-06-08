import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BirthDetailsForm from '../src/components/shared/BirthDetailsForm'

vi.mock('../src/hooks/useGeocode', () => ({
  useGeocode: () => ({
    results: [{ display_name: 'Delhi, India', lat: '28.6139', lon: '77.2090' }],
    loading: false, error: null,
    search: vi.fn(), fetchTimezone: vi.fn().mockResolvedValue(5.5), clear: vi.fn()
  })
}))

test('renders all birth detail fields', () => {
  render(<BirthDetailsForm onSubmit={vi.fn()} submitLabel="Save" />)
  expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/time of birth/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/place of birth/i)).toBeInTheDocument()
})

test('calls onSubmit with profile data when form is submitted', async () => {
  const onSubmit = vi.fn()
  render(<BirthDetailsForm onSubmit={onSubmit} submitLabel="Continue" />)
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Alice' } })
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1990-01-15' } })
  fireEvent.change(screen.getByLabelText(/time of birth/i), { target: { value: '14:30' } })
  fireEvent.change(screen.getByLabelText(/place of birth/i), { target: { value: 'Delhi' } })
  fireEvent.click(screen.getByText('Delhi, India'))
  fireEvent.click(screen.getByText('Continue'))
  await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  expect(onSubmit.mock.calls[0][0].name).toBe('Alice')
  expect(onSubmit.mock.calls[0][0].lat).toBe(28.6139)
  expect(onSubmit.mock.calls[0][0].timezone_offset).toBe(5.5)
})
