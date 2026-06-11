import { useState, useCallback, useRef } from 'react'

const NOMINATIM = import.meta.env.DEV
  ? '/api/nominatim/search'
  : 'https://nominatim.openstreetmap.org/search'
const TIMEAPI = import.meta.env.DEV
  ? '/api/timeapi/api/timezone/coordinate'
  : 'https://timeapi.io/api/timezone/coordinate'

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
    if (data.currentUtcOffset?.seconds != null) return data.currentUtcOffset.seconds / 3600
    // fallback: parse string like "+05:30" or "-07:00"
    const raw = data.utcOffset ?? data.currentUtcOffset
    const sign = String(raw).startsWith('-') ? -1 : 1
    const [h, m] = String(raw).replace(/^[+-]/, '').split(':').map(Number)
    return sign * (h + (m || 0) / 60)
  }, [])

  const clear = useCallback(() => setResults([]), [])

  return { results, loading, error, search, fetchTimezone, clear }
}
