// Active Vimshottari period from the chart: { mdLord, adLord }.
export function activeMahadasha(chart) {
  const md = chart?.dashas?.current?.mahadashas
  const mdLord = md && Object.keys(md)[0]
  if (!mdLord) return null
  const ad = md[mdLord]?.antardashas
  const adLord = ad ? Object.keys(ad)[0] : null
  return { mdLord, adLord }
}

export function formatTransitContext(transitData, chartJson) {
  const planets = transitData.planets
    .map(p => `- ${p.planet} in your H${p.natal_house} (${p.sign})${p.retrograde ? ' retrograde' : ''}`)
    .join('\n')

  const md = activeMahadasha(chartJson)
  const dasha = md ? `Current Mahadasha: ${md.mdLord}${md.adLord ? `, Antardasha: ${md.adLord}` : ''}` : ''

  return `## Today's Computed Transit Data (${transitData.date} ${transitData.time} local time)

### Panchanga
${JSON.stringify(transitData.panchanga, null, 2)}

### Planetary Positions → Natal Houses
${planets}

${dasha}`
}

// Readable dignity labels for jyotishganit's raw dignity strings.
const DIGNITY_LABEL = {
  own_sign: 'own sign', deep_exaltation: 'deeply exalted', exalted: 'exalted',
  deep_debilitation: 'deeply debilitated', debilitated: 'debilitated',
  moolatrikona: 'moolatrikona', neutral: 'neutral',
}

// `chart` is the full chart OBJECT (not a JSON string). Builds the same picture the user sees on
// the Chart tab — placements, current dasha, yogas, active doshas — so the LLM has it in context.
export function formatChartContext(chart, yogas, doshas) {
  const houses = chart?.d1Chart?.houses ?? []
  const lagna = houses.find(h => h.number === 1)?.sign ?? houses[0]?.sign ?? 'unknown'

  const placements = houses.flatMap(h =>
    (h.occupants ?? []).map(o => {
      const dig = DIGNITY_LABEL[o.dignities?.dignity] ?? o.dignities?.dignity ?? 'neutral'
      const retro = o.motion_type === 'retrograde' ? ', retrograde' : ''
      return `- ${o.celestialBody} in ${o.sign} (house ${h.number}), ${dig}${retro}`
    })
  ).join('\n') || 'No placements available'

  const md = activeMahadasha(chart)
  const dasha = md ? `${md.mdLord}${md.adLord ? ` › ${md.adLord}` : ''}` : 'unavailable'

  const yogaList = (yogas ?? [])
    .map(y => (y?.description ? `- ${y.name}: ${y.description}` : `- ${y?.name ?? y}`))
    .join('\n')

  const activeDoshas = Object.entries(doshas ?? {})
    .filter(([, v]) => v?.present)
    .map(([k, v]) => `- ${v.text ?? k}`)
    .join('\n')

  return `## Computed Birth Chart (the same chart the user is viewing)

### Ascendant
${lagna}

### Planetary placements (D1 / Rasi)
${placements}

### Current dasha period
${dasha}

### Active yogas
${yogaList || 'None detected'}

### Active doshas
${activeDoshas || 'None'}`
}

export function formatNumerologyContext(numerology) {
  return `## Computed Numerology Profile (Chaldean primary)

Life Path: ${numerology.life_path}
Destiny: Chaldean ${numerology.destiny.chaldean} / Pythagorean ${numerology.destiny.pythagorean}
Soul Urge: Chaldean ${numerology.soul_urge.chaldean} / Pythagorean ${numerology.soul_urge.pythagorean}
Personality: Chaldean ${numerology.personality.chaldean} / Pythagorean ${numerology.personality.pythagorean}
Personal Year: ${numerology.personal_year}`
}

export function formatSynastryContext(synastryData, profileA, profileB) {
  const { guna_milan, a_planets_in_b_houses, b_planets_in_a_houses, overlay_summary } = synastryData
  const breakdown = Object.entries(guna_milan.breakdown)
    .map(([k, v]) => `  ${k}: ${v.score}/${v.max}`)
    .join('\n')
  const fmt = o => `- ${o.planet} → their H${o.falls_in_house} (${o.house_meaning ?? ''}) — ${(o.effect ?? 'neutral').toUpperCase()}: ${o.note ?? ''}`
  const tally = overlay_summary
    ? `${overlay_summary.supportive} supportive · ${overlay_summary.challenging} challenging · ${overlay_summary.neutral} neutral — overall ${overlay_summary.lean}`
    : ''

  const supportive = (synastryData.top_supportive ?? []).map(s => `- ${s}`).join('\n')
  const challenging = (synastryData.top_challenging ?? []).map(s => `- ${s}`).join('\n')
  const mf = synastryData.marriage_factors ?? {}
  const dasha = synastryData.dasha_overlap?.note ?? ''

  return `## Computed Synastry Data: ${profileA.name} ↔ ${profileB.name}

### Guna Milan (Ashtakoota)
Total: ${guna_milan.total}/36 — ${guna_milan.verdict}
Breakdown:
${breakdown}

### Planetary overlay balance
${tally}

### How ${profileA.name}'s planets land in ${profileB.name}'s life areas
${a_planets_in_b_houses.map(fmt).join('\n')}

### How ${profileB.name}'s planets land in ${profileA.name}'s life areas
${b_planets_in_a_houses.map(fmt).join('\n')}

### Strongest supportive factors
${supportive || '—'}

### Strongest strains
${challenging || '—'}

### Marriage significators
${profileA.name}: ${mf.a?.summary ?? '—'}
${profileB.name}: ${mf.b?.summary ?? '—'}

### Current period
${dasha}`
}
