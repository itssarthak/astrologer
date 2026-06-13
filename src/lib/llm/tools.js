// Agent tool registry. Each tool has a JSON-Schema `parameters` block (sent to the LLM) and
// an async `execute(args)` that runs in the browser — calling the in-browser Pyodide compute
// functions, reading saved profiles, geocoding, or web searching. Returns stay concise so
// they fit comfortably back into the model's context.
import { computeChart, computeTransit, computeSynastry, computeNumerology, computeChartFacts } from '../pyodide/index'
import { getProfiles, getActiveProfile } from '../storage/profiles'
import { searchPlaces, fetchTimezoneOffset } from '../geocode'

function summarizeChart(chart) {
  const houses = chart?.d1Chart?.houses ?? []
  const ascendant = houses.find(h => h.number === 1)?.sign ?? 'unknown'
  const planets = []
  for (const h of houses) {
    for (const occ of h.occupants ?? []) {
      const parts = [`${occ.celestialBody} in ${occ.sign} (H${h.number})`]
      if (occ.nakshatra) parts.push(occ.nakshatra)
      if (occ.motion_type === 'retrograde') parts.push('retrograde')
      planets.push(parts.join(', '))
    }
  }
  return { ascendant, planets }
}

function findProfileByName(name) {
  if (!name) return getActiveProfile()
  const profiles = getProfiles()
  const lower = name.trim().toLowerCase()
  return profiles.find(p => p.name?.toLowerCase() === lower)
    ?? profiles.find(p => p.name?.toLowerCase().includes(lower))
    ?? null
}

export const TOOLS = [
  {
    name: 'list_profiles',
    description: 'List the saved profiles (name, birth date, place) and which one is active. Use this to find out who is available before pulling a chart or running a match.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute() {
      const active = getActiveProfile()
      return getProfiles().map(p => ({ name: p.name, dob: p.dob, place: p.place, active: p.id === active?.id }))
    },
  },
  {
    name: 'get_chart',
    description: "Get a saved profile's natal chart: ascendant, planetary placements with dignity and strength, the current dasha period chain, active yogas and doshas. Defaults to the active profile if no name is given.",
    parameters: {
      type: 'object',
      properties: { profile_name: { type: 'string', description: 'Name of a saved profile. Omit for the active profile.' } },
      required: [],
    },
    async execute({ profile_name }) {
      const profile = findProfileByName(profile_name)
      if (!profile?.chart) throw new Error(`No saved chart found for "${profile_name ?? 'active profile'}".`)
      const facts = await computeChartFacts(profile.chart)
      // Strength-annotated planets the model can weight (was: name+sign only).
      const planets = Object.entries(facts.planets).map(([name, f]) =>
        `${name}: ${f.sign} (H${f.house}), ${f.dignity}, ${f.strength}${f.retrograde ? ', retrograde' : ''}`)
      const d = facts.dasha
      return {
        name: profile.name,
        ascendant: facts.lagna,
        planets,
        // Full running period, not just the mahadasha label.
        dasha: [d.maha, d.antar, d.pratyantar].filter(Boolean).join(' → '),
        yogas: (profile.yogas ?? []).map(y => y.name ?? y).slice(0, 12),
        doshas: Object.entries(profile.doshas ?? {}).filter(([, v]) => v?.present).map(([k]) => k),
      }
    },
  },
  {
    name: 'get_divisional',
    description: "Get a saved profile's divisional (varga) chart placements. D9 (Navamsa) is the key chart for marriage and dharma questions; also D10 (career), D7 (children), D2/D3/D12 etc. Defaults to the active profile and D9.",
    parameters: {
      type: 'object',
      properties: {
        varga: { type: 'string', description: 'Divisional chart id: d2, d3, d4, d7, d9, d10, d12, d16, d20, d24, d27, d30, d40, d45, d60. Default d9.' },
        profile_name: { type: 'string', description: 'Name of a saved profile. Omit for the active profile.' },
      },
      required: [],
    },
    async execute({ varga, profile_name }) {
      const profile = findProfileByName(profile_name)
      if (!profile?.chart) throw new Error(`No saved chart found for "${profile_name ?? 'active profile'}".`)
      const key = (varga || 'd9').toLowerCase()
      const dv = profile.chart?.divisionalCharts?.[key]
      if (!dv?.houses) throw new Error(`Divisional chart "${key}" is not available for ${profile.name}.`)
      const placements = []
      for (const h of dv.houses) {
        for (const occ of h.occupants ?? []) {
          placements.push(`${occ.celestialBody} in ${occ.sign} (H${h.number})${occ.motion_type === 'retrograde' ? ' retro' : ''}`)
        }
      }
      return { name: profile.name, varga: key, ascendant: dv.ascendant, placements }
    },
  },
  {
    name: 'get_today_transit',
    description: "Compute today's planetary transits against the active profile's natal chart (which planets are hitting which natal houses now, plus the panchanga).",
    parameters: { type: 'object', properties: {}, required: [] },
    async execute() {
      const p = getActiveProfile()
      if (!p?.chart) throw new Error('No active profile chart to compute transits against.')
      const lagna = p.chart?.d1Chart?.houses?.find(h => h.number === 1)?.sign
      const t = await computeTransit(lagna, p.lat, p.lon, p.timezone_offset)
      if (t.error) throw new Error(t.error)
      return {
        date: t.date,
        panchanga: t.panchanga,
        planets: (t.planets ?? []).map(x => `${x.planet} in ${x.sign} → natal H${x.natal_house}${x.retrograde ? ' (retro)' : ''}`),
      }
    },
  },
  {
    name: 'match_profiles',
    description: 'Run Kundali Match (synastry) between the active profile and another saved profile: Guna Milan score and the planetary house-overlay analysis (which placements are supportive vs challenging).',
    parameters: {
      type: 'object',
      properties: { partner_name: { type: 'string', description: 'Name of the other saved profile to match against the active profile.' } },
      required: ['partner_name'],
    },
    async execute({ partner_name }) {
      const a = getActiveProfile()
      const b = findProfileByName(partner_name)
      if (!a?.chart) throw new Error('No active profile chart.')
      if (!b?.chart) throw new Error(`No saved profile named "${partner_name}".`)
      const s = await computeSynastry(a.chart, b.chart, a.gender, b.gender)
      return {
        between: [a.name, b.name],
        guna_milan: { total: s.guna_milan.total, max: 36, verdict: s.guna_milan.verdict, breakdown: s.guna_milan.breakdown },
        overlay_summary: s.overlay_summary,
        notable_overlays: [...(s.a_planets_in_b_houses ?? []), ...(s.b_planets_in_a_houses ?? [])]
          .filter(o => o.effect !== 'neutral')
          .map(o => `${o.planet} → H${o.falls_in_house} (${o.house_meaning}): ${o.effect}`),
      }
    },
  },
  {
    name: 'compute_numerology',
    description: 'Compute a numerology profile (Chaldean primary + Pythagorean) from a full birth name and date of birth.',
    parameters: {
      type: 'object',
      properties: {
        full_name: { type: 'string', description: 'Full birth name.' },
        dob: { type: 'string', description: 'Date of birth, YYYY-MM-DD.' },
      },
      required: ['full_name', 'dob'],
    },
    async execute({ full_name, dob }) {
      return computeNumerology(full_name, dob)
    },
  },
  {
    name: 'geocode_place',
    description: 'Resolve a place name to latitude, longitude, and timezone offset (hours from UTC). Useful before computing a chart for someone whose birth place you only know by name.',
    parameters: {
      type: 'object',
      properties: { place: { type: 'string', description: 'A place name, e.g. "Jaipur, India".' } },
      required: ['place'],
    },
    async execute({ place }, { signal } = {}) {
      const results = await searchPlaces(place, { signal })
      if (!results.length) throw new Error(`No location found for "${place}".`)
      const top = results[0]
      const lat = parseFloat(top.lat), lon = parseFloat(top.lon)
      const tz = await fetchTimezoneOffset(lat, lon, { signal })
      return { display_name: top.display_name, lat, lon, timezone_offset: tz }
    },
  },
  {
    name: 'compute_chart',
    description: 'Compute a fresh natal chart for ANY person (not necessarily a saved profile) from their birth details. The place is geocoded automatically. Returns a chart summary.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        dob: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:MM (24h)' },
        place: { type: 'string', description: 'Birth place name' },
      },
      required: ['name', 'dob', 'time', 'place'],
    },
    async execute({ name, dob, time, place }, { signal } = {}) {
      const results = await searchPlaces(place, { signal })
      if (!results.length) throw new Error(`No location found for "${place}".`)
      const lat = parseFloat(results[0].lat), lon = parseFloat(results[0].lon)
      const tz = await fetchTimezoneOffset(lat, lon, { signal })
      const chart = await computeChart(name, dob, time, lat, lon, tz, results[0].display_name)
      return { name, place: results[0].display_name, ...summarizeChart(chart) }
    },
  },
  {
    name: 'web_search',
    description: 'Look something up on the web (DuckDuckGo instant answers). Best for definitions and factual/encyclopedic queries; may return little for very specific or recent topics.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query.' } },
      required: ['query'],
    },
    async execute({ query }, { signal } = {}) {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      const resp = await fetch(url, { signal })
      if (!resp.ok) throw new Error('Web search failed.')
      const data = await resp.json()
      const related = (data.RelatedTopics ?? [])
        .map(t => t.Text)
        .filter(Boolean)
        .slice(0, 5)
      const abstract = data.AbstractText || data.Definition || ''
      if (!abstract && !related.length) return { result: 'No instant answer found for this query.' }
      return { summary: abstract, source: data.AbstractURL || data.DefinitionURL || undefined, related }
    },
  },
]

export const TOOLS_BY_NAME = Object.fromEntries(TOOLS.map(t => [t.name, t]))

// Schema-only view (no execute fn) for sending to the model.
export const TOOL_SCHEMAS = TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }))
