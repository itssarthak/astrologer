// Curated Vedic-astrology reference the agent can query to CONFIRM facts instead of guessing
// (e.g. which divisional charts exist, what each signifies, planet karakas, the dasha system).
// Keep entries factual and conservative — this is a fact source, not interpretation.

// Divisional charts. `standard` marks the 16 classical Shodasavarga (each with an authoritative
// special rule); the others are recognised but non-standard (no single agreed classical rule).
export const DIVISIONALS = {
  d1: { name: 'Rasi', signifies: 'the whole life — body, overall self and circumstances', standard: true },
  d2: { name: 'Hora', signifies: 'wealth and family resources', standard: true },
  d3: { name: 'Drekkana', signifies: 'siblings, courage and initiative', standard: true },
  d4: { name: 'Chaturthamsa', signifies: 'home, property, fixed assets and fortune', standard: true },
  d5: { name: 'Panchamsa', signifies: 'fame, authority and spiritual merit', standard: false },
  d6: { name: 'Shashthamsa', signifies: 'health and disease', standard: false },
  d7: { name: 'Saptamsa', signifies: 'children and progeny', standard: true },
  d8: { name: 'Ashtamsa', signifies: 'longevity and sudden events', standard: false },
  d9: { name: 'Navamsa', signifies: 'spouse, marriage, dharma and a planet’s deeper strength/fortune', standard: true },
  d10: { name: 'Dasamsa', signifies: 'career, profession, status and achievements', standard: true },
  d11: { name: 'Rudramsa (Ekadasamsa)', signifies: 'death and destruction (some traditions only)', standard: false },
  d12: { name: 'Dwadasamsa', signifies: 'parents and ancestry', standard: true },
  d16: { name: 'Shodasamsa', signifies: 'vehicles, luxuries, comforts and happiness', standard: true },
  d20: { name: 'Vimsamsa', signifies: 'spiritual practice, worship and devotion', standard: true },
  d24: { name: 'Chaturvimsamsa (Siddhamsa)', signifies: 'education, learning and knowledge', standard: true },
  d27: { name: 'Bhamsa (Nakshatramsa)', signifies: 'overall strengths, weaknesses and stamina', standard: true },
  d30: { name: 'Trimsamsa', signifies: 'misfortunes, diseases, character and morals', standard: true },
  d40: { name: 'Khavedamsa', signifies: 'auspicious/inauspicious effects; maternal legacy', standard: true },
  d45: { name: 'Akshavedamsa', signifies: 'character and conduct; paternal legacy', standard: true },
  d60: { name: 'Shashtiamsa', signifies: 'fine detail of all matters and past-life karma', standard: true },
}

export const SHODASAVARGA = ['d1', 'd2', 'd3', 'd4', 'd7', 'd9', 'd10', 'd12', 'd16', 'd20', 'd24', 'd27', 'd30', 'd40', 'd45', 'd60']

export const PLANETS = {
  Sun: { nature: 'malefic', karaka: 'soul, father, authority, vitality, ego' },
  Moon: { nature: 'benefic when waxing', karaka: 'mind, mother, emotions, comfort' },
  Mars: { nature: 'malefic', karaka: 'energy, courage, younger siblings, land, conflict' },
  Mercury: { nature: 'benefic (takes on its company)', karaka: 'intellect, speech, communication, trade' },
  Jupiter: { nature: 'benefic', karaka: 'wisdom, wealth, children, dharma; husband (for a woman)' },
  Venus: { nature: 'benefic', karaka: 'love, marriage, comfort, art; wife (for a man)' },
  Saturn: { nature: 'malefic', karaka: 'discipline, longevity, hardship, labour, delay' },
  Rahu: { nature: 'malefic (shadow / north node)', karaka: 'ambition, obsession, the foreign, illusion' },
  Ketu: { nature: 'malefic (shadow / south node)', karaka: 'detachment, spirituality, moksha, loss' },
}

export const VIMSHOTTARI = {
  description: 'The main 120-year dasha system. Periods run in this fixed order, sub-divided into antardasha then pratyantardasha.',
  order: ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'],
  years: { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 },
  total: 120,
}

// Core terms the agent should never get wrong.
export const GLOSSARY = {
  lagna: 'The ascendant — the sign rising on the eastern horizon at birth; defines the 1st house.',
  ascendant: 'Same as lagna — the rising sign and 1st house cusp.',
  rasi: 'A zodiac sign; also the name of the main D1 chart (the sign a planet occupies).',
  varga: 'A divisional chart (Dn): a sign divided into n parts to examine one area of life.',
  navamsa: 'The D9 divisional chart — marriage, dharma and a planet’s deeper strength.',
  dasha: 'A planetary ruling period (Vimshottari) that times events; the major period is the mahadasha.',
  antardasha: 'The sub-period within a mahadasha (also called bhukti).',
  pratyantardasha: 'The sub-sub-period within an antardasha.',
  nakshatra: 'One of the 27 lunar mansions (each 13°20′); the Moon’s nakshatra sets the Vimshottari starting dasha.',
  yoga: 'A specific planetary combination that produces a defined result.',
  dosha: 'An affliction or flaw in the chart (e.g. Mangal/Manglik, Kala Sarpa).',
  retrograde: 'Apparent backward motion of a planet; strengthens/intensifies its results.',
  combust: 'A planet too close to the Sun, weakening its expression.',
  exalted: 'A planet in its sign of greatest strength (e.g. Sun in Aries).',
  debilitated: 'A planet in its sign of greatest weakness (opposite the exaltation sign).',
  moolatrikona: 'A planet’s most comfortable, near-own portion of a sign — very strong.',
  kendra: 'The angular houses 1, 4, 7, 10 — pillars of the chart.',
  trikona: 'The trinal houses 1, 5, 9 — the most auspicious (dharma/fortune).',
  dusthana: 'The difficult houses 6, 8, 12 — struggle, loss and obstacles.',
  upachaya: 'The growth houses 3, 6, 10, 11 — improve with time and effort.',
  karaka: 'A natural significator — the planet that represents a topic (e.g. Venus is the karaka of marriage).',
  ashtakavarga: 'A points (bindu) system scoring each sign’s strength, used especially for transits.',
  shodasavarga: 'The 16 standard divisional charts used in Parashari astrology.',
  guna_milan: 'The 36-point Ashtakoota marriage-compatibility score from the two Moons’ nakshatras.',
}

const norm = s => (s || '').trim().toLowerCase()

// House significations (BPHS-tradition karakatvas) + Parashari classifications. Atomic facts:
// what each bhava governs and which functional group it belongs to. The model merges these with
// placements — this table never encodes "planet X in house Y means Z".
export const HOUSES = {
  1:  { signifies: 'the self, body, vitality, personality and overall direction of life', classifications: ['kendra', 'trikona'] },
  2:  { signifies: 'wealth, family, speech, food and accumulated resources', classifications: [] },
  3:  { signifies: 'courage, younger siblings, effort, communication and short journeys', classifications: ['upachaya'] },
  4:  { signifies: 'home, mother, property, vehicles, schooling and inner peace', classifications: ['kendra'] },
  5:  { signifies: 'children, intelligence, creativity, romance and past-life merit', classifications: ['trikona'] },
  6:  { signifies: 'enemies, debts, disease, obstacles, daily work and service', classifications: ['dusthana', 'upachaya'] },
  7:  { signifies: 'marriage, spouse, partnerships and business relations', classifications: ['kendra'] },
  8:  { signifies: 'longevity, sudden events, inheritance, the hidden and transformation', classifications: ['dusthana'] },
  9:  { signifies: 'fortune, dharma, father, higher learning, long journeys and the guru', classifications: ['trikona'] },
  10: { signifies: 'career, status, profession, public standing and authority', classifications: ['kendra', 'upachaya'] },
  11: { signifies: 'gains, income, friends, elder siblings and fulfilment of desires', classifications: ['upachaya'] },
  12: { signifies: 'loss, expenditure, foreign lands, isolation, sleep and liberation', classifications: ['dusthana'] },
}

// Sign natures — element, quality (modality), ruling planet, one-line temperament.
export const SIGNS = {
  Aries:       { element: 'fire',  quality: 'cardinal', ruler: 'Mars',    nature: 'assertive, pioneering, impulsive' },
  Taurus:      { element: 'earth', quality: 'fixed',    ruler: 'Venus',   nature: 'steady, sensual, possessive' },
  Gemini:      { element: 'air',   quality: 'mutable',  ruler: 'Mercury', nature: 'curious, communicative, restless' },
  Cancer:      { element: 'water', quality: 'cardinal', ruler: 'Moon',    nature: 'nurturing, emotional, protective' },
  Leo:         { element: 'fire',  quality: 'fixed',    ruler: 'Sun',     nature: 'proud, generous, authoritative' },
  Virgo:       { element: 'earth', quality: 'mutable',  ruler: 'Mercury', nature: 'analytical, precise, critical' },
  Libra:       { element: 'air',   quality: 'cardinal', ruler: 'Venus',   nature: 'harmonious, relational, indecisive' },
  Scorpio:     { element: 'water', quality: 'fixed',    ruler: 'Mars',    nature: 'intense, secretive, transformative' },
  Sagittarius: { element: 'fire',  quality: 'mutable',  ruler: 'Jupiter', nature: 'optimistic, philosophical, blunt' },
  Capricorn:   { element: 'earth', quality: 'cardinal', ruler: 'Saturn',  nature: 'disciplined, ambitious, reserved' },
  Aquarius:    { element: 'air',   quality: 'fixed',    ruler: 'Saturn',  nature: 'unconventional, humanitarian, detached' },
  Pisces:      { element: 'water', quality: 'mutable',  ruler: 'Jupiter', nature: 'compassionate, imaginative, escapist' },
}

// Single-digit (1-9) numerology meanings. Ruler matches PLANET_RULER in numerology.py (Chaldean).
export const NUMEROLOGY_NUMBERS = {
  1: { ruler: 'Sun',     traits: 'leadership, individuality, drive, a strong ego' },
  2: { ruler: 'Moon',    traits: 'sensitivity, cooperation, emotion, diplomacy' },
  3: { ruler: 'Jupiter', traits: 'optimism, expression, wisdom, expansion' },
  4: { ruler: 'Rahu',    traits: 'structure built unconventionally, system-building, restlessness' },
  5: { ruler: 'Mercury', traits: 'communication, versatility, quick intellect, restlessness' },
  6: { ruler: 'Venus',   traits: 'love, beauty, harmony, responsibility, comfort' },
  7: { ruler: 'Ketu',    traits: 'introspection, spirituality, detachment, analysis' },
  8: { ruler: 'Saturn',  traits: 'discipline, ambition, hard-won success, delay' },
  9: { ruler: 'Mars',    traits: 'energy, courage, drive, a capacity for conflict' },
}

// Effect of a planet's dignity on its results. Keyed by the canonical set (dignity.py); raw
// jyotishganit variants are normalised by dignityEffect() before lookup.
export const DIGNITY_EFFECT = {
  exalted:      'at greatest strength — delivers its best results',
  moolatrikona: 'very strong, in its most comfortable portion',
  own:          'strong and at ease in its own sign',
  friend:       'comfortable in a friendly sign — supportive results',
  neutral:      'neither helped nor hindered by the sign',
  enemy:        'strained in an unfriendly sign — results come harder',
  debilitated:  'at greatest weakness — struggles to deliver its results',
}

// Raw jyotishganit dignity strings → canonical DIGNITY_EFFECT keys.
const DIGNITY_ALIAS = {
  deep_exaltation: 'exalted', deep_debilitation: 'debilitated', own_sign: 'own',
}

export function houseMeaning(n) {
  return HOUSES[Number(n)]?.signifies
}
export function signMeaning(sign) {
  if (!sign) return undefined
  const key = Object.keys(SIGNS).find(s => s.toLowerCase() === String(sign).trim().toLowerCase())
  return key ? SIGNS[key] : undefined
}
export function numberMeaning(n) {
  return NUMEROLOGY_NUMBERS[Number(n)]
}
export function dignityEffect(s) {
  if (!s) return undefined
  const key = String(s).trim().toLowerCase()
  return DIGNITY_EFFECT[DIGNITY_ALIAS[key] ?? key]
}
export function planetKaraka(name) {
  if (!name) return undefined
  const key = Object.keys(PLANETS).find(p => p.toLowerCase() === String(name).trim().toLowerCase())
  return key ? PLANETS[key].karaka : undefined
}

// Look up a term across the reference. Returns an array of {topic, key, ...fact} matches.
export function lookupReference(term) {
  const q = norm(term)
  if (!q) return []
  const out = []
  const id = q.replace(/[^a-z0-9]/g, '')

  // Divisional by id (d5, "5", "d-5") or by name (navamsa, trimsamsa, hora…)
  const dMatch = id.match(/^d?(\d+)$/)
  if (dMatch) {
    const key = `d${dMatch[1]}`
    if (DIVISIONALS[key]) out.push({ topic: 'divisional', id: key, ...DIVISIONALS[key] })
  }
  for (const [key, v] of Object.entries(DIVISIONALS)) {
    if (norm(v.name).includes(q) || q.includes(norm(v.name).split(' ')[0])) {
      if (!out.some(o => o.id === key)) out.push({ topic: 'divisional', id: key, ...v })
    }
  }
  // Planets
  for (const [key, v] of Object.entries(PLANETS)) {
    if (norm(key) === q || norm(key).includes(q) && q.length > 2) out.push({ topic: 'planet', planet: key, ...v })
  }
  // Glossary
  for (const [key, def] of Object.entries(GLOSSARY)) {
    if (key === q || key.includes(q) || q.includes(key)) out.push({ topic: 'term', term: key, definition: def })
  }
  // Houses (e.g. "7th house", "house 10", "10th")
  const hMatch = id.match(/^(?:house)?(\d{1,2})(?:st|nd|rd|th)?(?:house)?$/)
  if (hMatch) {
    const hn = Number(hMatch[1])
    if (HOUSES[hn]) out.push({ topic: 'house', house: hn, ...HOUSES[hn] })
  }
  // Signs
  for (const [sign, v] of Object.entries(SIGNS)) {
    if (norm(sign) === q || (q.length > 3 && norm(sign).includes(q))) out.push({ topic: 'sign', sign, ...v })
  }
  // Numerology numbers (e.g. "number 8", "8")
  const nMatch = id.match(/^(?:number)?(\d)$/)
  if (nMatch) {
    const nn = Number(nMatch[1])
    if (NUMEROLOGY_NUMBERS[nn]) out.push({ topic: 'number', number: nn, ...NUMEROLOGY_NUMBERS[nn] })
  }
  // Special topics
  if (/vimshottari|dasha|period/.test(q)) out.push({ topic: 'dasha-system', ...VIMSHOTTARI })
  if (/shodasavarga|divisional charts|varga charts|all vargas|list of charts/.test(q)) {
    out.push({ topic: 'divisional-list', standard: SHODASAVARGA, note: 'The 16 standard Shodasavarga. Others (d5, d6, d8, d11…) are non-standard.' })
  }
  return out
}
