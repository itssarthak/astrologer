export function formatTransitContext(transitData, chartJson) {
  const planets = transitData.planets
    .map(p => `- ${p.planet} in your H${p.natal_house} (${p.sign})${p.retrograde ? ' retrograde' : ''}`)
    .join('\n')

  const dasha = chartJson?.dashas?.vimshottari
    ? `Current dasha: ${JSON.stringify(chartJson.dashas.vimshottari).slice(0, 200)}`
    : ''

  return `## Today's Computed Transit Data (${transitData.date} ${transitData.time} IST)

### Panchanga
${JSON.stringify(transitData.panchanga, null, 2)}

### Planetary Positions → Natal Houses
${planets}

${dasha}

Interpret this as a transit read. Effects only — no factor-explaining.
Plain English, no jargon, no Sanskrit, no house numbers in your reply.`
}

export function formatChartContext(chartJson, yogas, doshas) {
  const activeDoshas = Object.entries(doshas ?? {})
    .filter(([, v]) => v.present)
    .map(([k, v]) => `${k}: ${v.text}`)
    .join('\n')

  return `## Computed Birth Chart Data

### D1 Chart (Rasi)
Lagna: ${chartJson?.d1Chart?.houses?.[0]?.sign ?? 'unknown'}
Planets: ${JSON.stringify(chartJson?.d1Chart?.houses ?? [], null, 2).slice(0, 1500)}

### Active Yogas
${(yogas ?? []).map(y => `- ${y.name} (${y.category})`).join('\n') || 'None detected'}

### Doshas
${activeDoshas || 'None detected'}

### Current Dasha
${JSON.stringify(chartJson?.dashas?.vimshottari ?? {}).slice(0, 300)}

Interpret the chart. Plain English, effects only — no Sanskrit terms, no house numbers in your reply.`
}

export function formatNumerologyContext(numerology) {
  return `## Computed Numerology Profile (Chaldean primary)

Life Path: ${numerology.life_path}
Destiny: Chaldean ${numerology.destiny.chaldean} / Pythagorean ${numerology.destiny.pythagorean}
Soul Urge: Chaldean ${numerology.soul_urge.chaldean} / Pythagorean ${numerology.soul_urge.pythagorean}
Personality: Chaldean ${numerology.personality.chaldean} / Pythagorean ${numerology.personality.pythagorean}
Personal Year: ${numerology.personal_year}

Interpret this numerology profile. Use Chaldean as primary and Pythagorean as cross-check.
Plain English only — explain what each number means for this person's life.`
}

export function formatSynastryContext(synastryData, profileA, profileB) {
  const { guna_milan, a_planets_in_b_houses, b_planets_in_a_houses } = synastryData
  const breakdown = Object.entries(guna_milan.breakdown)
    .map(([k, v]) => `  ${k}: ${v.score}/${v.max}`)
    .join('\n')

  return `## Computed Synastry Data: ${profileA.name} ↔ ${profileB.name}

### Guna Milan (Ashtakoota)
Total: ${guna_milan.total}/36 — ${guna_milan.verdict}
Breakdown:
${breakdown}

### ${profileA.name}'s Planets in ${profileB.name}'s Chart
${b_planets_in_a_houses.map(o => `- ${o.planet} falls in H${o.falls_in_house} (${o.sign})`).join('\n')}

### ${profileB.name}'s Planets in ${profileA.name}'s Chart
${a_planets_in_b_houses.map(o => `- ${o.planet} falls in H${o.falls_in_house} (${o.sign})`).join('\n')}

Interpret this compatibility. Guna Milan total score first, then key house overlay findings.
Plain English — tell them what it means for the relationship, not the astrological mechanics.
Only discuss Kundali Match if the user explicitly asks — never volunteer matchmaking framing.`
}
