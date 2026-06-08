import { renderHook, act, waitFor } from '@testing-library/react'
import { useGeocode } from '../src/hooks/useGeocode'

beforeAll(() => vi.useFakeTimers())
afterAll(() => vi.useRealTimers())

beforeEach(() => {
  global.fetch = vi.fn()
})

test('returns empty results by default', () => {
  const { result } = renderHook(() => useGeocode())
  expect(result.current.results).toEqual([])
  expect(result.current.loading).toBe(false)
})

test('search calls Nominatim and returns results', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => [
      { display_name: 'Delhi, India', lat: '28.6139', lon: '77.2090' }
    ]
  })

  const { result } = renderHook(() => useGeocode())

  await act(async () => {
    result.current.search('Delhi')
    await vi.runAllTimersAsync()  // flush the debounce + async work inside
  })

  expect(result.current.loading).toBe(false)
  expect(result.current.results[0].display_name).toBe('Delhi, India')
})

test('fetchTimezone calls timeapi.io', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ currentUtcOffset: { seconds: 19800 } })
  })

  const { result } = renderHook(() => useGeocode())
  let offset
  await act(async () => {
    offset = await result.current.fetchTimezone(28.6139, 77.2090)
  })
  expect(offset).toBe(5.5)
})
