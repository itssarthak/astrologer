// Agent tool registry. Each tool has a JSON-Schema `parameters` block (sent to the LLM) and
// an async `execute(args)` that runs in the browser — calling the in-browser Pyodide compute
// functions, reading saved profiles, geocoding, or web searching. Returns stay concise so
// they fit comfortably back into the model's context.
import { computeChart, computeTransit, computeSynastry, computeNumerology, computeNumberCompatibility, computeChartFacts, computeVarshaphal } from '../pyodide/index'
import { getProfiles, getActiveProfile } from '../storage/profiles'
import { searchPlaces, fetchTimezoneOffset } from '../geocode'
import { lookupReference, SHODASAVARGA } from './reference'

// Format the dignity/strength-annotated planet lines shared by get_chart and compute_chart.
function planetLines(facts) {
  return Object.entries(facts.planets).map(([name, f]) =>
    `${name}: ${f.sign} (H${f.house}), ${f.dignity}, ${f.strength}${f.retrograde ? ', retrograde' : ''}`)
}

const ZODIAC = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']

// Generic equal-division D-n varga sign index for an absolute sidereal longitude — the same
// cyclic method jyotishganit uses for arbitrary divisors. Used only for vargas OUTSIDE the
// standard Shodasavarga set (the 16 standard charts use their own authoritative special rules).
function genericVargaIdx(longitude, n) {
  const norm = ((longitude % 360) + 360) % 360
  return Math.floor((norm * n) / 30) % 12
}

// Compute an arbitrary D-n chart from the natal d1Chart (placements only, no special rules).
function computeGenericVarga(d1Chart, n) {
  const houses = d1Chart?.houses ?? []
  const h1 = houses.find(h => h.number === 1)
  if (!h1 || ZODIAC.indexOf(h1.sign) < 0) return null
  const ascIdx = genericVargaIdx(ZODIAC.indexOf(h1.sign) * 30 + (h1.signDegrees ?? 0), n)
  const placements = []
  for (const h of houses) {
    for (const occ of h.occupants ?? []) {
      const long = ZODIAC.indexOf(occ.sign) * 30 + (occ.signDegrees ?? 0)
      const vIdx = genericVargaIdx(long, n)
      const house = ((vIdx - ascIdx + 12) % 12) + 1
      placements.push(`${occ.celestialBody} in ${ZODIAC[vIdx]} (H${house})${occ.motion_type === 'retrograde' ? ' retro' : ''}`)
    }
  }
  return { ascendant: ZODIAC[ascIdx], placements }
}

// Sarvashtakavarga bindu strength band for a sign (per-sign SAV is roughly 25-40):
// >=30 strong, 25-29 average, <25 weak.
export function savBand(bindu) {
  if (bindu >= 30) return 'strong'
  if (bindu >= 25) return 'average'
  return 'weak'
}

// Render one transit planet line, annotated with the natal SAV bindu of the sign it's
// transiting (and a quick strength read). `sav` is the natal sign→bindu map; the suffix
// is omitted when it's missing (older charts) or has no entry for the sign.
export function transitLine(x, sav) {
  const base = `${x.planet} in ${x.sign} → natal H${x.natal_house}${x.retrograde ? ' (retro)' : ''}`
  const bindu = sav?.[x.sign]
  return bindu == null ? base : `${base} · SAV ${bindu} (${savBand(bindu)})`
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
    description: "Get a saved profile's natal chart overview: ascendant, planetary placements with dignity and strength, the current dasha period chain, top yogas, and the names of active doshas. This is the starting point for any reading. For DETAIL, call the focused tools: get_dasha (full period timeline + dates for timing questions), get_doshas (why a dosha is present, severity, cancellations), get_yogas (the complete yoga list), get_ashtakavarga (sign-strength scores), get_divisional (varga charts). Defaults to the active profile if no name is given.",
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
      const planets = planetLines(facts)
      const d = facts.dasha
      return {
        name: profile.name,
        ascendant: facts.lagna,
        planets,
        // Full running period, not just the mahadasha label.
        dasha: [d.maha, d.antar, d.pratyantar].filter(Boolean).join(' → '),
        yogas: (profile.yogas ?? []).slice(0, 12).map(y =>
          y?.description ? `${y.name} — ${y.description}` : (y?.name ?? y)),
        doshas: Object.entries(profile.doshas ?? {}).filter(([, v]) => v?.present).map(([k]) => k),
      }
    },
  },
  {
    name: 'get_divisional',
    description: "Fetch the placements of ANY divisional/varga chart — you DO have access, so call this rather than saying you can't. The 16 standard Shodasavarga charts use authoritative classical rules: d1 (Rasi/main), d2 (wealth), d3 (siblings), d4 (property), d7 (children), d9 (Navamsa — marriage & dharma), d10 (career), d12 (parents), d16, d20, d24 (education), d27, d30 (Trimsamsa — health & adversity), d40, d45, d60. You can ALSO request any other division (e.g. d5, d6, d8, d11, d108): it's computed on the fly by the generic equal-division method and returned with a `note` saying so — surface that caveat to the user. Defaults to the active profile and d9.",
    parameters: {
      type: 'object',
      properties: {
        varga: { type: 'string', description: "Chart id: d1 (Rasi/main) or any divisional d2,d3,d4,d7,d9,d10,d12,d16,d20,d24,d27,d30,d40,d45,d60. Default d9." },
        profile_name: { type: 'string', description: 'Name of a saved profile. Omit for the active profile.' },
      },
      required: [],
    },
    async execute({ varga, profile_name }) {
      const profile = findProfileByName(profile_name)
      if (!profile?.chart) throw new Error(`No saved chart found for "${profile_name ?? 'active profile'}".`)
      const key = (varga || 'd9').toLowerCase().replace(/^rasi$|^lagna$|^birth$/, 'd1')
      // D1 (Rasi) is the main chart, not under divisionalCharts.
      const dv = key === 'd1' ? profile.chart?.d1Chart : profile.chart?.divisionalCharts?.[key]
      if (dv?.houses) {
        const placements = []
        for (const h of dv.houses) {
          for (const occ of h.occupants ?? []) {
            placements.push(`${occ.celestialBody} in ${occ.sign} (H${h.number})${occ.motion_type === 'retrograde' ? ' retro' : ''}`)
          }
        }
        const ascendant = dv.ascendant ?? dv.houses.find(h => h.number === 1)?.sign
        return { name: profile.name, varga: key, ascendant, placements }
      }
      // Not one of the precomputed standard charts — compute the division on the fly.
      const m = key.match(/^d(\d+)$/)
      const n = m ? Number(m[1]) : null
      if (n && n >= 2 && n <= 300) {
        const g = computeGenericVarga(profile.chart?.d1Chart, n)
        if (g) {
          return {
            name: profile.name, varga: key, ascendant: g.ascendant, placements: g.placements,
            note: `D${n} is outside the standard 16-chart Shodasavarga, so it has no single classical rule — this was computed by the generic equal-division method. Tell the user that.`,
          }
        }
      }
      throw new Error(`Couldn't build "${varga}". Use d1-d60 (a Dn id), e.g. d9, d10, d30.`)
    },
  },
  {
    name: 'get_dasha',
    description: "Get a saved profile's Vimshottari dasha timeline — the planetary periods that time life events. Returns the currently running mahadasha → antardasha → pratyantardasha (each with absolute start/end dates), the full sequence of all 9 mahadashas (lord + dates), and the next upcoming sub-period. USE THIS for ANY timing question — 'when will X happen', 'what period am I in', 'is this a good time for marriage / a job change / buying a house', 'what's coming next'. Dates are YYYY-MM-DD. Defaults to the active profile.",
    parameters: {
      type: 'object',
      properties: { profile_name: { type: 'string', description: 'Name of a saved profile. Omit for the active profile.' } },
      required: [],
    },
    async execute({ profile_name }) {
      const profile = findProfileByName(profile_name)
      if (!profile?.chart) throw new Error(`No saved chart found for "${profile_name ?? 'active profile'}".`)
      const dashas = profile.chart?.dashas ?? {}
      const firstEntry = obj => Object.entries(obj ?? {})[0]
      let current = null
      const cm = firstEntry(dashas.current?.mahadashas)
      if (cm) {
        const [mLord, m] = cm
        const ca = firstEntry(m.antardashas)
        const cp = ca ? firstEntry(ca[1].pratyantardashas) : null
        current = {
          mahadasha: { lord: mLord, start: m.start, end: m.end },
          antardasha: ca ? { lord: ca[0], start: ca[1].start, end: ca[1].end } : null,
          pratyantardasha: cp ? { lord: cp[0], start: cp[1].start, end: cp[1].end } : null,
        }
      }
      const mahadasha_timeline = Object.entries(dashas.all?.mahadashas ?? {})
        .map(([lord, m]) => ({ lord, start: m.start, end: m.end }))
      let upcoming = null
      const um = firstEntry(dashas.upcoming?.mahadashas)
      if (um) {
        const ua = firstEntry(um[1].antardashas)
        if (ua) upcoming = { next_antardasha: { lord: ua[0], start: ua[1].start, end: ua[1].end } }
      }
      return { name: profile.name, current, mahadasha_timeline, upcoming }
    },
  },
  {
    name: 'get_doshas',
    description: "Get a saved profile's full dosha analysis — the afflictions checked in the chart (Manglik/Mangal, Kala Sarpa, Guru Chandala, Pitru, Ganda Moola, Kalathra, Shrapit, Shakata). For each: whether it is present, its severity (full/partial) and whether it's cancelled (with the reasons), any afflicting planets, and a plain explanation. USE THIS when the user asks about doshas, marriage obstacles, or remedies — or when get_chart shows a dosha and you need the WHY/whether it's neutralised. Defaults to the active profile.",
    parameters: {
      type: 'object',
      properties: { profile_name: { type: 'string', description: 'Name of a saved profile. Omit for the active profile.' } },
      required: [],
    },
    async execute({ profile_name }) {
      const profile = findProfileByName(profile_name)
      if (!profile?.doshas) throw new Error(`No dosha data for "${profile_name ?? 'active profile'}". Recompute the chart if it predates the latest version.`)
      return {
        name: profile.name,
        doshas: Object.entries(profile.doshas).map(([dosha, v]) => ({
          dosha,
          present: !!v?.present,
          text: v?.text ?? '',
          ...(v?.severity ? { severity: v.severity } : {}),
          ...(v?.cancelled != null ? { cancelled: v.cancelled } : {}),
          ...(v?.cancellation_reasons?.length ? { cancellation_reasons: v.cancellation_reasons } : {}),
          ...(v?.afflictors?.length ? { afflictors: v.afflictors } : {}),
        })),
      }
    },
  },
  {
    name: 'get_yogas',
    description: "Get a saved profile's COMPLETE list of detected yogas (planetary combinations) — each with its name, category, and a plain-English description of what it means for the person. get_chart returns only the top few; USE THIS when the user wants the full picture of their yogas or asks about a specific one. Defaults to the active profile.",
    parameters: {
      type: 'object',
      properties: { profile_name: { type: 'string', description: 'Name of a saved profile. Omit for the active profile.' } },
      required: [],
    },
    async execute({ profile_name }) {
      const profile = findProfileByName(profile_name)
      if (!profile) throw new Error(`No saved profile found for "${profile_name ?? 'active profile'}".`)
      const yogas = profile.yogas ?? []
      return {
        name: profile.name,
        count: yogas.length,
        yogas: yogas.map(y => (y?.description ? `${y.name} (${y.category ?? 'yoga'}) — ${y.description}` : (y?.name ?? String(y)))),
      }
    },
  },
  {
    name: 'get_ashtakavarga',
    description: "Get a saved profile's Ashtakavarga strength scores — benefic points (bindus) per sign. Higher = stronger, more favourable results for that area and for transits through that sign. Returns the Sarvashtakavarga (SAV — the combined total per sign, roughly 25-40) with the strongest and weakest signs, and, if a planet is named, that planet's own per-sign bindus. USE THIS to judge which life areas are strong and to weigh transit timing (a planet moving through a high-bindu sign tends to deliver better). Defaults to the active profile; SAV only unless a planet is given.",
    parameters: {
      type: 'object',
      properties: {
        planet: { type: 'string', description: "Optional: Sun/Moon/Mars/Mercury/Jupiter/Venus/Saturn — also return that planet's per-sign bindu contribution." },
        profile_name: { type: 'string', description: 'Name of a saved profile. Omit for the active profile.' },
      },
      required: [],
    },
    async execute({ planet, profile_name }) {
      const profile = findProfileByName(profile_name)
      if (!profile?.chart?.ashtakavarga) throw new Error(`No Ashtakavarga data for "${profile_name ?? 'active profile'}". Recompute the chart if it predates the latest version.`)
      const av = profile.chart.ashtakavarga
      const sav = av.sav ?? {}
      const sorted = Object.entries(sav).sort((a, b) => b[1] - a[1])
      const result = {
        name: profile.name,
        sav,
        strongest: sorted.slice(0, 3).map(([s, v]) => `${s} (${v})`),
        weakest: sorted.slice(-3).map(([s, v]) => `${s} (${v})`),
      }
      if (planet) {
        const bhav = av[`${planet.toLowerCase()}Bhav`]
        if (bhav) result.planet_bindus = { planet, per_sign: bhav }
      }
      return result
    },
  },
  {
    name: 'get_today_transit',
    description: "Compute planetary transits against the active profile's natal chart (which planets are hitting which natal houses, plus the panchanga). Each transiting planet is annotated with the natal Sarvashtakavarga (SAV) bindu of the sign it's in and a strength read (strong/average/weak) so you can weigh how favourable the transit is. Defaults to today, but accepts an optional `date` (YYYY-MM-DD) to cast the transit for any future or past day — use it for \"what about <future/past date>\" questions.",
    parameters: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Optional date (YYYY-MM-DD) to compute the transit for. Omit for today.' } },
      required: [],
    },
    async execute({ date } = {}) {
      const p = getActiveProfile()
      if (!p?.chart) throw new Error('No active profile chart to compute transits against.')
      const lagna = p.chart?.d1Chart?.houses?.find(h => h.number === 1)?.sign
      const t = await computeTransit(lagna, p.lat, p.lon, p.timezone_offset, date ?? null)
      if (t.error) throw new Error(t.error)
      // Annotate each transiting planet with the natal SAV bindu for the sign it's in,
      // so the model can weigh transit strength (high bindu → better results).
      const sav = p.chart?.ashtakavarga?.sav
      return {
        date: t.date,
        panchanga: t.panchanga,
        planets: (t.planets ?? []).map(x => transitLine(x, sav)),
      }
    },
  },
  {
    name: 'match_profiles',
    description: 'Run Kundali Match (deep synastry) between the active profile and another saved profile: Guna Milan score, the planetary house-overlay analysis (which placements are supportive vs challenging), planet-to-planet cross-aspects between the two charts, dignity-weighted strengths and strains, each person\'s 7th-lord and Venus/Jupiter karaka read, and current-dasha-period compatibility.',
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
      const mf = s.marriage_factors ?? {}
      return {
        between: [a.name, b.name],
        guna_milan: { total: s.guna_milan.total, max: 36, verdict: s.guna_milan.verdict, breakdown: s.guna_milan.breakdown },
        overlay_summary: s.overlay_summary,
        top_supportive: (s.top_supportive ?? []).slice(0, 5),
        top_challenging: (s.top_challenging ?? []).slice(0, 5),
        marriage_factors: {
          [a.name]: mf.a?.summary,
          [b.name]: mf.b?.summary,
        },
        dasha: s.dasha_overlap?.note,
        // When the match leans challenging, the date the current period-driven friction eases
        // (null = no time-bound clash, i.e. a steady feature rather than a passing phase).
        challenging_until: s.challenging_until ?? null,
      }
    },
  },
  {
    name: 'get_varshaphal',
    description: "Compute the Varshaphal (annual solar-return chart) for a saved profile and a year — the chart cast for the moment the Sun returns to its birth position that year. Returns the Varsha (annual) ascendant and its lord, the Muntha (the year's progressed point) sign/house/lord, the Mudda (annual) dasha periods with dates, and the year's planetary placements. USE THIS for year-ahead questions — 'how will <year> be', 'what does this year hold', annual forecast. Defaults to the active profile and the current year.",
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: 'The year to forecast, e.g. 2026. Defaults to the current year.' },
        profile_name: { type: 'string', description: 'Name of a saved profile. Omit for the active profile.' },
      },
      required: [],
    },
    async execute({ year, profile_name }) {
      const profile = findProfileByName(profile_name)
      if (!profile?.chart) throw new Error(`No saved chart found for "${profile_name ?? 'active profile'}".`)
      if (!profile.dob || !profile.time || profile.lat == null) throw new Error(`Profile "${profile.name}" is missing birth details needed for Varshaphal.`)
      const y = year ?? new Date().getFullYear()
      const [by, bm, bd] = profile.dob.split('-').map(Number)
      const [bh, bmin] = profile.time.split(':').map(Number)
      const v = await computeVarshaphal(profile.chart, y, profile.lat, profile.lon, profile.timezone_offset, by, bm, bd, bh, bmin)
      if (v.error) throw new Error(v.error)
      return {
        name: profile.name,
        year: v.year,
        age: v.age,
        solar_return: `${v.solar_return.date} ${v.solar_return.time}`,
        varsha_lagna: `${v.varsha_lagna} (lord ${v.varsha_lagna_lord})`,
        muntha: `${v.muntha.sign} in house ${v.muntha.house} (lord ${v.muntha.lord})`,
        mudda_dasha: (v.mudda_dasha ?? []).map(d => `${d.lord}: ${d.start} → ${d.end}`),
        placements: (v.placements ?? []).map(p => `${p.planet} in ${p.sign} (H${p.house})${p.retrograde ? ' retro' : ''}`),
      }
    },
  },
  {
    name: 'compute_numerology',
    description: 'Compute a numerology profile (Chaldean primary + Pythagorean) from a full birth name and date of birth. Returns the driver (mulank) and destiny (bhagyank) numbers with their ruling planets, the compound name number with its Cheiro meaning, and supports an optional everyday name.',
    parameters: {
      type: 'object',
      properties: {
        full_name: { type: 'string', description: 'Full birth name.' },
        dob: { type: 'string', description: 'Date of birth, YYYY-MM-DD.' },
        name_in_use: { type: 'string', description: 'The name the person actually goes by, if different from the birth name. Optional.' },
      },
      required: ['full_name', 'dob'],
    },
    async execute({ full_name, dob, name_in_use }) {
      return computeNumerology(full_name, dob, name_in_use ?? null)
    },
  },
  {
    name: 'numerology_compatibility',
    description: "Compare two numerology numbers (1-9, e.g. two people's driver/mulank numbers) and return whether their ruling planets are friends, neutral, or enemies.",
    parameters: {
      type: 'object',
      properties: {
        number_a: { type: 'number', description: 'First number, 1-9.' },
        number_b: { type: 'number', description: 'Second number, 1-9.' },
      },
      required: ['number_a', 'number_b'],
    },
    async execute({ number_a, number_b }) {
      return computeNumberCompatibility(number_a, number_b)
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
    description: 'Compute a fresh natal chart for ANY person (not necessarily a saved profile) from their birth details. The place is geocoded automatically. Returns the same format as get_chart — ascendant, placements with dignity and strength, and the current dasha period chain.',
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
      const facts = await computeChartFacts(chart)
      const d = facts.dasha
      return {
        name,
        place: results[0].display_name,
        ascendant: facts.lagna,
        planets: planetLines(facts),
        dasha: [d.maha, d.antar, d.pratyantar].filter(Boolean).join(' → '),
      }
    },
  },
  {
    name: 'astro_reference',
    description: "Look up an authoritative Vedic-astrology FACT to confirm it before answering — do NOT rely on memory for which charts/terms exist or what they mean. Covers: divisional charts (e.g. 'd5' → Panchamsa, non-standard; 'trimsamsa' → D30; 'navamsa' → D9) including which are standard, planet natures & karakas, the Vimshottari dasha order/years, and core terms (lagna, kendra, dusthana, karaka, ashtakavarga, …). Returns the matching facts, or an empty list if there's no entry (in which case say you're not certain rather than inventing one). USE THIS whenever the user names a chart/term/number you're not 100% sure of.",
    parameters: {
      type: 'object',
      properties: { term: { type: 'string', description: "The chart id, name, planet, number, or term to confirm — e.g. 'd5', 'trimsamsa', 'Saturn', 'kendra', 'vimshottari'." } },
      required: ['term'],
    },
    async execute({ term }) {
      const results = lookupReference(term)
      if (!results.length) {
        return { term, results: [], note: `No reference entry for "${term}". Don't invent one — say you're not certain. (The 16 standard divisional charts are: ${SHODASAVARGA.join(', ')}.)` }
      }
      return { term, results }
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
