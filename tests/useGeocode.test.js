import { renderHook, act } from '@testing-library/react'
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

test('search with short query clears results', async () => {
  const { result } = renderHook(() => useGeocode())
  // first add a result to state
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ display_name: 'Delhi' }] })
  await act(async () => { result.current.search('De'); await vi.runAllTimersAsync() })
  // then try short query
  act(() => result.current.search('D'))
  expect(result.current.results).toEqual([])
})

test('search sets error on fetch failure', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false })
  const { result } = renderHook(() => useGeocode())
  await act(async () => { result.current.search('Delhi'); await vi.runAllTimersAsync() })
  expect(result.current.error).toBe('Geocoding failed')
  expect(result.current.results).toEqual([])
})

test('a newer search aborts the previous in-flight request', async () => {
  const signals = []
  global.fetch.mockImplementation((url, opts) => {
    signals.push(opts.signal)
    return new Promise(() => {}) // never resolves — simulates an in-flight request
  })
  const { result } = renderHook(() => useGeocode())
  await act(async () => { result.current.search('Delh'); await vi.advanceTimersByTimeAsync(400) })
  await act(async () => { result.current.search('Delhi'); await vi.advanceTimersByTimeAsync(400) })
  expect(signals).toHaveLength(2)
  expect(signals[0].aborted).toBe(true)   // the older request was cancelled
  expect(signals[1].aborted).toBe(false)  // the newest request is live
})

test('clear empties results', async () => {
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ display_name: 'Delhi' }] })
  const { result } = renderHook(() => useGeocode())
  await act(async () => { result.current.search('Delhi'); await vi.runAllTimersAsync() })
  expect(result.current.results).toHaveLength(1)
  act(() => result.current.clear())
  expect(result.current.results).toEqual([])
})
