// Plain geocoding helpers (no React) so both the useGeocode hook and the agent tools can
// reach OpenStreetMap Nominatim + timeapi.io. Dev routes through the Vite proxy to dodge
// CORS; production calls the public endpoints directly (both allow browser CORS).
const NOMINATIM = import.meta.env.DEV
  ? '/api/nominatim/search'
  : 'https://nominatim.openstreetmap.org/search'
const TIMEAPI = import.meta.env.DEV
  ? '/api/timeapi/api/timezone/coordinate'
  : 'https://timeapi.io/api/timezone/coordinate'

export async function searchPlaces(query) {
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
  const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!resp.ok) throw new Error('Geocoding failed')
  return resp.json()
}

export async function fetchTimezoneOffset(lat, lon) {
  const resp = await fetch(`${TIMEAPI}?latitude=${lat}&longitude=${lon}`)
  if (!resp.ok) throw new Error('Timezone lookup failed')
  const data = await resp.json()
  if (data.currentUtcOffset?.seconds != null) return data.currentUtcOffset.seconds / 3600
  const raw = data.utcOffset ?? data.currentUtcOffset
  const sign = String(raw).startsWith('-') ? -1 : 1
  const [h, m] = String(raw).replace(/^[+-]/, '').split(':').map(Number)
  return sign * (h + (m || 0) / 60)
}
