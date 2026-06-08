import { useState, useCallback, useRef } from 'react'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const TIMEAPI = 'https://timeapi.io/api/time/current/coordinate'

export function useGeocode() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  const search = useCallback(query => {
    if (!query || query.length < 2) { setResults([]); return }

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
        const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } })
        if (!resp.ok) throw new Error('Geocoding failed')
        const data = await resp.json()
        setResults(data)
      } catch (err) {
        setError(err.message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }, [])

  const fetchTimezone = useCallback(async (lat, lon) => {
    const resp = await fetch(`${TIMEAPI}?latitude=${lat}&longitude=${lon}`)
    if (!resp.ok) throw new Error('Timezone lookup failed')
    const data = await resp.json()
    return data.currentUtcOffset.seconds / 3600
  }, [])

  const clear = useCallback(() => setResults([]), [])

  return { results, loading, error, search, fetchTimezone, clear }
}
