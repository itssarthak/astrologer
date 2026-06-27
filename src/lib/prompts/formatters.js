import { houseMeaning, planetKaraka, dignityEffect, numberMeaning } from '../llm/reference'

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
      const meaning = [
        planetKaraka(o.celestialBody) && `karaka: ${planetKaraka(o.celestialBody)}`,
        houseMeaning(h.number) && `house: ${houseMeaning(h.number)}`,
        dignityEffect(o.dignities?.dignity) && `dignity: ${dignityEffect(o.dignities?.dignity)}`,
      ].filter(Boolean).join('; ')
      return `- ${o.celestialBody} in ${o.sign} (house ${h.number}), ${dig}${retro}` + (meaning ? ` — ${meaning}` : '')
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
  const base = `## Computed Numerology Profile (Chaldean primary)

Life Path: ${numerology.life_path}
Destiny: Chaldean ${numerology.destiny.chaldean} / Pythagorean ${numerology.destiny.pythagorean}
Soul Urge: Chaldean ${numerology.soul_urge.chaldean} / Pythagorean ${numerology.soul_urge.pythagorean}
Personality: Chaldean ${numerology.personality.chaldean} / Pythagorean ${numerology.personality.pythagorean}
Personal Year: ${numerology.personal_year}`

  const numLine = (label, n) => {
    const num = (n != null && typeof n === 'object') ? n.number : n
    const m = numberMeaning(num)
    return m ? `${label}: ${num} (${m.ruler}) — ${m.traits}` : null
  }
  const numMeanings = [numLine('Driver', numerology.mulank), numLine('Destiny', numerology.bhagyank)]
    .filter(Boolean).join('\n')

  const g = numerology.loshu
  if (!g) return numMeanings ? `${base}\n\n${numMeanings}` : base
  const kua = g.kua != null ? `Kua: ${g.kua}` : (g.kua_note ?? 'Kua: —')
  return `${base}${numMeanings ? '\n\n' + numMeanings : ''}

### Lo Shu Grid
Missing: ${g.missing.join(', ') || 'none'}
Repeated (strong): ${g.repeated.join(', ') || 'none'}
${kua}
Arrows of strength: ${g.arrows_strength.join('; ') || 'none'}
Arrows of weakness: ${g.arrows_weakness.join('; ') || 'none'}`
}

export function formatNumerologyMatchContext(m) {
  const fill = arr => (arr && arr.length ? arr.join(', ') : 'none')
  // Each person's full Lo Shu grid, mirroring the two grids the Match tab now renders.
  const gridLines = (name, g) => g ? `${name}'s Lo Shu — Missing: ${g.missing.join(', ') || 'none'}; Repeated (strong): ${g.repeated.join(', ') || 'none'}; Arrows of strength: ${g.arrows_strength.join('; ') || 'none'}; Arrows of weakness: ${g.arrows_weakness.join('; ') || 'none'}` : null
  const grids = [gridLines(m.between[0], m.grid.a_grid), gridLines(m.between[1], m.grid.b_grid)].filter(Boolean).join('\n')
  // Lines newly completed by the union of both grids, with who supplies each cell.
  const src = s => (s === 'a' ? m.between[0] : s === 'b' ? m.between[1] : 'both')
  const done = m.combined?.completed_lines ?? []
  const completed = done.length
    ? 'Lines completed jointly (full via the union, not held by either alone):\n' +
      done.map(l => `  - ${l.name}${l.raj_yog ? ' [Raj Yog]' : ''} — ${l.meaning} (${l.from.map(f => `${f.number} from ${src(f.source)}`).join('; ')})`).join('\n')
    : 'No Lo Shu lines are newly completed by the pairing.'
  // "Raj Yog" here is the popular-numerology term — keep it distinct from a classical Raja Yoga.
  const rajNote = m.combined?.has_raj_yog
    ? '\nNote: "Raj Yog" above is the popular-numerology label for a jointly completed Lo Shu diagonal within this indicative layer, NOT a classical Vedic Raja Yoga.'
    : ''
  return `## Numerology Compatibility (${m.indicative_label})
Between ${m.between[0]} and ${m.between[1]}
Indicative score: ${m.indicative_score}/10 — ${m.summary_rating}
Core numbers: ${m.core.rating} (${m.core.score}/10)
Driver-Conductor (cross): ${m.driver_conductor.rating} (${m.driver_conductor.score}/10)
Grid complementarity: ${m.grid.rating} (${m.grid.score}/10) — ${m.between[1]} supplies ${fill(m.grid.a_missing_filled_by_b)}; ${m.between[0]} supplies ${fill(m.grid.b_missing_filled_by_a)}; shared strengths ${fill(m.grid.shared_strengths)}${grids ? '\n' + grids : ''}
${completed}${rajNote}
This is indicative only and does not replace the classical 36-point Guna Milan.`
}

export function formatSynastryContext(synastryData, profileA, profileB) {
  const { guna_milan, a_planets_in_b_houses, b_planets_in_a_houses, overlay_summary } = synastryData
  const breakdown = Object.entries(guna_milan.breakdown)
    .map(([k, v]) => `  ${k}: ${v.score}/${v.max}`)
    .join('\n')
  // Each person's underlying koota attributes so the model can say "A's varna is X, B's yoni is Y".
  const gunaLine = (name, p) => p
    ? `  ${name}: Varna ${p.varna}, Vashya ${p.vashya}, Yoni ${p.yoni}, Sign lord ${p.sign_lord}, Gana ${p.gana}, Nadi ${p.nadi} (Moon ${p.moon_sign}, Nakshatra ${p.nakshatra})`
    : ''
  const gunaProfiles = guna_milan.profiles
    ? `\nPer-person gunas:\n${gunaLine(profileA.name, guna_milan.profiles.a)}\n${gunaLine(profileB.name, guna_milan.profiles.b)}`
    : ''
  const fmt = o => `- ${o.planet} → their H${o.falls_in_house} (${o.house_meaning ?? ''}) — ${(o.effect ?? 'neutral').toUpperCase()}: ${o.note ?? ''}`
  const tally = overlay_summary
    ? `${overlay_summary.supportive} supportive · ${overlay_summary.challenging} challenging · ${overlay_summary.neutral} neutral — overall ${overlay_summary.lean}`
    : ''

  const supportive = (synastryData.top_supportive ?? []).map(s => `- ${s}`).join('\n')
  const challenging = (synastryData.top_challenging ?? []).map(s => `- ${s}`).join('\n')
  const mf = synastryData.marriage_factors ?? {}
  const dasha = synastryData.dasha_overlap?.note ?? ''
  // When the match leans challenging, state how long the current period-driven rough phase lasts.
  const timing = overlay_summary?.lean === 'challenging'
    ? (synastryData.challenging_until
        ? `This rough phase is heightened by the current planetary periods and eases after ${synastryData.challenging_until}. Say this timeframe explicitly in the read.`
        : 'The friction is a steady feature of the match rather than a passing phase — frame it as something to manage, not wait out.')
    : ''

  return `## Computed Synastry Data: ${profileA.name} ↔ ${profileB.name}

### Guna Milan (Ashtakoota)
Total: ${guna_milan.total}/36 — ${guna_milan.verdict}
Breakdown:
${breakdown}${gunaProfiles}

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
${dasha}
${timing ? `\n### Timing of the strain\n${timing}` : ''}`
}
