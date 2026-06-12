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

  return `## Today's Computed Transit Data (${transitData.date} ${transitData.time} IST)

### Panchanga
${JSON.stringify(transitData.panchanga, null, 2)}

### Planetary Positions → Natal Houses
${planets}

${dasha}

Write today's transit read in this exact shape, plain English, no jargon/Sanskrit/house numbers:
1. A single one-line summary of the day's overall feel.
2. 2–3 short "•" bullets on what's most active and how it may feel.
3. "Do today:" one practical thing the energy supports.
4. "Avoid today:" one thing to be careful with.
Effects only — don't explain the astrological factors.`
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
  const { guna_milan, a_planets_in_b_houses, b_planets_in_a_houses, overlay_summary } = synastryData
  const breakdown = Object.entries(guna_milan.breakdown)
    .map(([k, v]) => `  ${k}: ${v.score}/${v.max}`)
    .join('\n')
  const fmt = o => `- ${o.planet} → their H${o.falls_in_house} (${o.house_meaning}) — ${o.effect.toUpperCase()}: ${o.note}`
  const tally = overlay_summary
    ? `${overlay_summary.supportive} supportive · ${overlay_summary.challenging} challenging · ${overlay_summary.neutral} neutral — overall ${overlay_summary.lean}`
    : ''

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

Interpret this compatibility in plain English:
1. Lead with the overall picture — the Guna Milan score AND whether the planetary overlays lean harmonious or challenging.
2. Explain how each person's key planets affect the other's life areas. Be explicit about where it is SUPPORTIVE (one person's planets help the other) versus CHALLENGING (they interfere or create friction), and what that feels like day to day.
3. Be honest about the hard spots and what to watch for, then close with the genuine strengths.
Talk about the people and the relationship, not the astrological mechanics. This is the Match tab, so a compatibility framing is expected here.`
}
