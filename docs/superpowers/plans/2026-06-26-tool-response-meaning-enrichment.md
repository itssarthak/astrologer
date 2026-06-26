# Tool-Response Meaning Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach atomic sourced interpretive primitives (house significations, planet karakas, sign natures, dignity effects, numerology number traits) to the agent's tool and context outputs, so the LLM never invents an astrological fact — while the synthesis (merging primitives into a reading) stays the model's job.

**Architecture:** Approach A — extend the JS reference module `src/lib/llm/reference.js` with new atomic, sourced lookup tables and single-argument accessor helpers, then annotate at the tool-return layer (`src/lib/llm/tools.js`) and the context-formatter layer (`src/lib/prompts/formatters.js`). No Python compute changes; no new tools; no `worker.js`/`vite.config.js` registration.

**Tech Stack:** Vanilla ES modules, Vitest for unit tests. Existing tests live under `tests/lib/llm/` and `tests/lib/prompts/`.

## Global Constraints

- **Atomic facts only — never pre-baked synthesis.** Every accessor takes exactly ONE primitive key (one house, one planet, one sign, one number, one dignity) and returns ONE fact. No function may accept a `(planet, house, sign)` tuple and return a combined meaning. Inline lists of separately-labeled facts are allowed (concatenation ≠ synthesis); a lookup keyed by a combination is forbidden.
- **Sourced, conservative, one-line entries.** Match the existing `reference.js` bar ("a fact source, not interpretation"). Content from BPHS-tradition house karakatvas, standard sign natures, Chaldean/Cheiro numbers.
- **Tone unchanged.** These feed the model's private reasoning only. The existing tone gates (`TOOL_GUIDANCE`, `LAYMAN_REMINDER`, soul.md) still forbid surfacing the primitives in replies. Do not touch the tone prompts.
- **Two dignity vocabularies.** `planetLines` (from `computeChartFacts`) uses the canonical set `exalted, moolatrikona, own, friend, neutral, enemy, debilitated` (see `src/lib/pyodide/scripts/dignity.py`). `divisionalPlacementLine` uses raw jyotishganit strings (`own_sign, deep_exaltation, deep_debilitation, …`). The `dignityEffect()` accessor MUST normalise both.
- **Number→ruler map is fixed:** `1 Sun, 2 Moon, 3 Jupiter, 4 Rahu, 5 Mercury, 6 Venus, 7 Ketu, 8 Saturn, 9 Mars` (must match `PLANET_RULER` in `src/lib/pyodide/scripts/numerology.py`).
- **Test bar before merge:** `npx vitest run`, `npm run lint` (0 errors), `npm run build`. Python suite unaffected but run `.venv-test/bin/python -m pytest tests/python` to confirm no regression.

---

## File Structure

- `src/lib/llm/reference.js` — **modified.** Add `HOUSES`, `SIGNS`, `NUMEROLOGY_NUMBERS`, `DIGNITY_EFFECT` tables; add accessors `houseMeaning`, `signMeaning`, `numberMeaning`, `dignityEffect`, `planetKaraka`; extend `lookupReference`.
- `src/lib/llm/tools.js` — **modified.** `planetLines`, `divisionalPlacementLine`, `transitLine` append labelled meaning clauses; `get_chart`/`compute_chart`, `get_divisional`, `get_dasha`, `get_today_transit`, `get_varshaphal`, `compute_numerology` return-shapes gain meaning fields; `astro_reference` description text updated.
- `src/lib/prompts/formatters.js` — **modified.** `formatChartContext` placements and `formatNumerologyContext` numbers gain the same primitives, for context-path parity.
- `CLAUDE.md` — **modified.** One-line convention note.
- Tests: `tests/lib/llm/reference.test.js`, `tests/lib/llm/toolHelpers.test.js`, `tests/lib/prompts/formatters.test.js` — extended.

---

## Task 1: Reference tables and accessors

**Files:**
- Modify: `src/lib/llm/reference.js`
- Test: `tests/lib/llm/reference.test.js`

**Interfaces:**
- Produces:
  - `HOUSES` — object keyed `'1'`…`'12'`, each `{ signifies: string, classifications: string[] }`.
  - `SIGNS` — object keyed `'Aries'`…`'Pisces'`, each `{ element, quality, ruler, nature }` (all strings).
  - `NUMEROLOGY_NUMBERS` — object keyed `'1'`…`'9'`, each `{ ruler: string, traits: string }`.
  - `DIGNITY_EFFECT` — object keyed by canonical dignity string, each value a one-line string.
  - `houseMeaning(n)` → `string | undefined` (accepts number or numeric string).
  - `signMeaning(sign)` → `{ element, quality, ruler, nature } | undefined` (case-insensitive).
  - `numberMeaning(n)` → `{ ruler, traits } | undefined` (accepts number or string; reduces nothing — caller passes a 1–9).
  - `dignityEffect(s)` → `string | undefined` (normalises raw jyotishganit aliases to canonical first).
  - `planetKaraka(name)` → `string | undefined` (the `karaka` field of existing `PLANETS`, case-insensitive).

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/llm/reference.test.js`:

```js
import {
  HOUSES, SIGNS, NUMEROLOGY_NUMBERS, DIGNITY_EFFECT,
  houseMeaning, signMeaning, numberMeaning, dignityEffect, planetKaraka,
} from '../../../src/lib/llm/reference'

it('has a signification for every house 1-12 with classifications', () => {
  for (let n = 1; n <= 12; n++) {
    expect(HOUSES[n]).toBeDefined()
    expect(typeof HOUSES[n].signifies).toBe('string')
    expect(Array.isArray(HOUSES[n].classifications)).toBe(true)
  }
  expect(HOUSES[1].classifications).toEqual(expect.arrayContaining(['kendra', 'trikona']))
  expect(HOUSES[6].classifications).toEqual(expect.arrayContaining(['dusthana', 'upachaya']))
})

it('houseMeaning accepts number or string, undefined for out of range', () => {
  expect(houseMeaning(7)).toMatch(/marriage/i)
  expect(houseMeaning('7')).toMatch(/marriage/i)
  expect(houseMeaning(13)).toBeUndefined()
})

it('has all 12 signs with element/quality/ruler/nature and looks up case-insensitively', () => {
  expect(Object.keys(SIGNS)).toHaveLength(12)
  expect(signMeaning('scorpio')).toMatchObject({ ruler: 'Mars', element: 'water' })
  expect(signMeaning('Unknownia')).toBeUndefined()
})

it('has numerology numbers 1-9 with the canonical Chaldean rulers', () => {
  const rulers = { 1: 'Sun', 2: 'Moon', 3: 'Jupiter', 4: 'Rahu', 5: 'Mercury', 6: 'Venus', 7: 'Ketu', 8: 'Saturn', 9: 'Mars' }
  for (let n = 1; n <= 9; n++) {
    expect(NUMEROLOGY_NUMBERS[n].ruler).toBe(rulers[n])
    expect(typeof NUMEROLOGY_NUMBERS[n].traits).toBe('string')
  }
  expect(numberMeaning(3)).toMatchObject({ ruler: 'Jupiter' })
  expect(numberMeaning('3')).toMatchObject({ ruler: 'Jupiter' })
  expect(numberMeaning(0)).toBeUndefined()
})

it('dignityEffect normalises both canonical and raw jyotishganit dignity strings', () => {
  expect(dignityEffect('exalted')).toMatch(/strong|strength/i)
  expect(dignityEffect('deep_exaltation')).toBe(dignityEffect('exalted'))
  expect(dignityEffect('own_sign')).toBe(dignityEffect('own'))
  expect(dignityEffect('deep_debilitation')).toBe(dignityEffect('debilitated'))
  expect(dignityEffect('nonsense')).toBeUndefined()
})

it('planetKaraka returns the karaka of a known planet, case-insensitive', () => {
  expect(planetKaraka('venus')).toMatch(/marriage|love/i)
  expect(planetKaraka('Pluto')).toBeUndefined()
})

it('astro_reference lookup covers houses, signs and numbers', () => {
  expect(lookupReference('7th house')).toEqual(
    expect.arrayContaining([expect.objectContaining({ topic: 'house', house: 7 })]))
  expect(lookupReference('Scorpio')).toEqual(
    expect.arrayContaining([expect.objectContaining({ topic: 'sign', sign: 'Scorpio' })]))
  expect(lookupReference('number 8')).toEqual(
    expect.arrayContaining([expect.objectContaining({ topic: 'number', number: 8 })]))
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/llm/reference.test.js`
Expected: FAIL — `HOUSES is not defined` / imports undefined.

- [ ] **Step 3: Add the tables and accessors**

In `src/lib/llm/reference.js`, after the existing `GLOSSARY` block and before `const norm = …`, add:

```js
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
```

- [ ] **Step 4: Extend `lookupReference` to cover the new tables**

In `src/lib/llm/reference.js`, inside `lookupReference`, after the existing Glossary loop and before the "Special topics" block, add:

```js
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
```

Note: `id` is the already-computed `q.replace(/[^a-z0-9]/g, '')` (spaces stripped), so `"7th house"` → `7thhouse` → matched by the regex; `"house 10"` → `house10`. The leading `d?(\d+)` divisional matcher runs earlier and only fires on a `d`-prefixed or bare-number that also hits `DIVISIONALS`, so a bare `"8"` still reaches the number matcher.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/llm/reference.test.js`
Expected: PASS (all, including the pre-existing reference tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/llm/reference.js tests/lib/llm/reference.test.js
git commit -m "feat(reference): add house/sign/number/dignity atomic meaning tables + accessors

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Annotate chart, divisional, transit and varshaphal tool outputs

**Files:**
- Modify: `src/lib/llm/tools.js` (`planetLines`, `divisionalPlacementLine`, `transitLine` helpers; `get_chart`, `get_divisional`, `get_dasha`, `get_today_transit`, `get_varshaphal` executes; `astro_reference` description)
- Test: `tests/lib/llm/toolHelpers.test.js`

**Interfaces:**
- Consumes: `houseMeaning`, `signMeaning`, `numberMeaning`, `dignityEffect`, `planetKaraka`, `HOUSES` from Task 1; existing `DIVISIONALS`.
- Produces: `planetLines` and `divisionalPlacementLine` strings now carry a trailing ` — karaka: …; house: …; dignity: …` clause built ONLY from single-key lookups. `get_divisional` return gains `signifies`. `get_dasha` `current`/`mahadasha_timeline` lord entries gain `karaka`.

- [ ] **Step 1: Update the helper tests to expect the meaning clauses**

In `tests/lib/llm/toolHelpers.test.js`, replace the two existing `planetLines` and `divisionalPlacementLine` assertions with meaning-aware ones:

```js
describe('planetLines (with shadbala + meanings)', () => {
  it('appends karaka, house and dignity meaning clauses', () => {
    const lines = planetLines(FACTS)
    expect(lines[0]).toContain('Saturn: Capricorn (H5), moolatrikona, strong')
    expect(lines[0]).toContain('7.8/7 rupas')
    expect(lines[0]).toMatch(/karaka:.*discipline/i)        // planet karaka (Saturn)
    expect(lines[0]).toMatch(/house:.*children/i)           // H5 signification
    expect(lines[0]).toMatch(/dignity:.*comfortable|strong/i) // moolatrikona effect
    expect(lines[1]).not.toContain('rupas')                 // Sun has no shadbala
    expect(lines[1]).toMatch(/karaka:.*soul|father/i)
  })
})

describe('divisionalPlacementLine (with meanings)', () => {
  it('appends the planet karaka', () => {
    const occ = { celestialBody: 'Mars', sign: 'Aries', motion_type: 'direct',
      dignities: { dignity: 'exalted' }, nakshatra: 'Ashwini', pada: 1 }
    const line = divisionalPlacementLine(occ, 3)
    expect(line).toContain('Mars in Aries (H3) — exalted, Ashwini pada 1')
    expect(line).toMatch(/karaka:.*energy|courage/i)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/llm/toolHelpers.test.js`
Expected: FAIL — lines lack the `karaka:`/`house:`/`dignity:` clauses.

- [ ] **Step 3: Add the meaning clauses to the helpers**

In `src/lib/llm/tools.js`, update the import on line 8:

```js
import { lookupReference, SHODASAVARGA, DIVISIONALS, houseMeaning, dignityEffect, planetKaraka } from './reference'
```

Replace `planetLines` (lines 13–18) with:

```js
export function planetLines(facts) {
  return Object.entries(facts.planets).map(([name, f]) => {
    const rupas = f.rupas != null && f.min_required != null ? ` · ${f.rupas}/${f.min_required} rupas` : ''
    const base = `${name}: ${f.sign} (H${f.house}), ${f.dignity}, ${f.strength}${f.retrograde ? ', retrograde' : ''}${rupas}`
    const meaning = [
      planetKaraka(name) && `karaka: ${planetKaraka(name)}`,
      houseMeaning(f.house) && `house: ${houseMeaning(f.house)}`,
      dignityEffect(f.dignity) && `dignity: ${dignityEffect(f.dignity)}`,
    ].filter(Boolean).join('; ')
    return meaning ? `${base} — ${meaning}` : base
  })
}
```

Replace `divisionalPlacementLine` (lines 41–46) with:

```js
export function divisionalPlacementLine(occ, houseNumber) {
  const nak = occ.nakshatra ? `${occ.nakshatra}${occ.pada ? ` pada ${occ.pada}` : ''}` : null
  const extras = [occ.dignities?.dignity, nak].filter(Boolean)
  const base = `${occ.celestialBody} in ${occ.sign} (H${houseNumber})${occ.motion_type === 'retrograde' ? ' retro' : ''}` +
    (extras.length ? ` — ${extras.join(', ')}` : '')
  const karaka = planetKaraka(occ.celestialBody)
  return karaka ? `${base} — karaka: ${karaka}` : base
}
```

- [ ] **Step 4: Add `signifies` to `get_divisional` and `karaka` to `get_dasha`**

In `get_divisional` execute, the success return (currently line 147) becomes:

```js
        const ascendant = dv.ascendant ?? dv.houses.find(h => h.number === 1)?.sign
        return { name: profile.name, varga: key, ascendant, signifies: DIVISIONALS[key]?.signifies, placements }
```

In `get_dasha` execute, annotate the lord entries. Change the `current` assembly (lines 180–184) and the timeline map (lines 186–187):

```js
        current = {
          mahadasha: { lord: mLord, karaka: planetKaraka(mLord), start: m.start, end: m.end },
          antardasha: ca ? { lord: ca[0], karaka: planetKaraka(ca[0]), start: ca[1].start, end: ca[1].end } : null,
          pratyantardasha: cp ? { lord: cp[0], karaka: planetKaraka(cp[0]), start: cp[1].start, end: cp[1].end } : null,
        }
```

```js
      const mahadasha_timeline = Object.entries(dashas.all?.mahadashas ?? {})
        .map(([lord, m]) => ({ lord, karaka: planetKaraka(lord), start: m.start, end: m.end }))
```

- [ ] **Step 5: Run the helper tests to verify they pass**

Run: `npx vitest run tests/lib/llm/toolHelpers.test.js`
Expected: PASS.

- [ ] **Step 6: Run the whole unit suite to catch downstream string assertions**

Run: `npx vitest run`
Expected: PASS. If any agent-eval or formatter test asserted an exact old planet-line string, update it to use `toContain` on the stable prefix (do not weaken meaning coverage).

- [ ] **Step 7: Commit**

```bash
git add src/lib/llm/tools.js tests/lib/llm/toolHelpers.test.js
git commit -m "feat(tools): attach atomic karaka/house/dignity meanings to chart, divisional & dasha outputs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Annotate numerology tool output with number traits

**Files:**
- Modify: `src/lib/llm/tools.js` (`compute_numerology` execute)
- Test: `tests/lib/llm/toolHelpers.test.js` (new `describe` for a pure helper)

**Interfaces:**
- Consumes: `numberMeaning` from Task 1.
- Produces: a pure helper `attachNumberMeanings(result)` exported from `tools.js` that returns the numerology result with a `meanings` block: `{ mulank, bhagyank, life_path }` each `{ number, ruler, traits }` (omitting any number that isn't 1–9). `compute_numerology` execute returns `attachNumberMeanings(await computeNumerology(...))`.

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/llm/toolHelpers.test.js`:

```js
import { attachNumberMeanings } from '../../../src/lib/llm/tools'

describe('attachNumberMeanings', () => {
  it('adds ruler+traits for mulank, bhagyank and life_path; skips out-of-range', () => {
    const out = attachNumberMeanings({ mulank: 3, bhagyank: 8, life_path: 11, destiny: { chaldean: 5 } })
    expect(out.meanings.mulank).toMatchObject({ number: 3, ruler: 'Jupiter' })
    expect(out.meanings.bhagyank).toMatchObject({ number: 8, ruler: 'Saturn' })
    expect(out.meanings.life_path).toBeUndefined()   // 11 is a master number, not 1-9
    expect(out.destiny).toEqual({ chaldean: 5 })     // original fields preserved
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/llm/toolHelpers.test.js -t attachNumberMeanings`
Expected: FAIL — `attachNumberMeanings` is not exported.

- [ ] **Step 3: Implement the helper and wire it in**

In `src/lib/llm/tools.js`, extend the reference import to include `numberMeaning`:

```js
import { lookupReference, SHODASAVARGA, DIVISIONALS, houseMeaning, dignityEffect, planetKaraka, numberMeaning } from './reference'
```

Add the helper near the other exported helpers (after `transitLine`):

```js
// Attach atomic 1-9 number meanings (ruler + traits) for the driver, conductor and life-path
// numbers. Master numbers (11/22/33) have no single-digit entry and are simply omitted — the
// model still has the raw number. Never merges two numbers into a combined reading.
export function attachNumberMeanings(result) {
  const pick = n => {
    const m = numberMeaning(n)
    return m ? { number: n, ...m } : undefined
  }
  const meanings = {}
  for (const key of ['mulank', 'bhagyank', 'life_path']) {
    const m = pick(result?.[key])
    if (m) meanings[key] = m
  }
  return { ...result, meanings }
}
```

Change `compute_numerology` execute (line 380–382) to:

```js
    async execute({ full_name, dob, gender, name_in_use }) {
      return attachNumberMeanings(await computeNumerology(full_name, dob, gender ?? null, name_in_use ?? null))
    },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/llm/toolHelpers.test.js -t attachNumberMeanings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/tools.js tests/lib/llm/toolHelpers.test.js
git commit -m "feat(tools): attach 1-9 number traits to compute_numerology output

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Context-path parity (formatters)

**Files:**
- Modify: `src/lib/prompts/formatters.js` (`formatChartContext`, `formatNumerologyContext`)
- Test: `tests/lib/prompts/formatters.test.js`

**Interfaces:**
- Consumes: `houseMeaning`, `planetKaraka`, `dignityEffect`, `numberMeaning` from Task 1.
- Produces: `formatChartContext` placement lines gain a ` — karaka: …; house: …; dignity: …` clause; `formatNumerologyContext` gains a `Driver/Destiny/Life Path` meaning line. Keep clauses terse — these inject into every chart/numbers turn's system prompt.

- [ ] **Step 1: Write the failing tests**

In `tests/lib/prompts/formatters.test.js`, add to the existing `formatNumerologyContext` describe and add a new `formatChartContext` describe. First extend the `NUM` fixture with driver/destiny numbers:

```js
// add to the NUM object:
//   mulank: 4, bhagyank: 5,
```

```js
it('includes driver/destiny number meanings', () => {
  const out = formatNumerologyContext({ ...NUM, mulank: 4, bhagyank: 5 })
  expect(out).toMatch(/Driver.*4.*Rahu/i)
  expect(out).toMatch(/Destiny.*5.*Mercury/i)
})

describe('formatChartContext', () => {
  const CHART = {
    d1Chart: { houses: [
      { number: 1, sign: 'Aries', occupants: [] },
      { number: 7, sign: 'Libra', occupants: [
        { celestialBody: 'Saturn', sign: 'Libra', motion_type: 'direct', dignities: { dignity: 'exalted' } },
      ] },
    ] },
    dashas: { current: { mahadashas: { Venus: { antardashas: { Saturn: {} } } } } },
  }
  it('annotates placements with karaka, house and dignity meaning', () => {
    const out = formatChartContext(CHART, [], {})
    expect(out).toMatch(/Saturn in Libra \(house 7\)/)
    expect(out).toMatch(/karaka:.*discipline/i)
    expect(out).toMatch(/house:.*marriage/i)
    expect(out).toMatch(/dignity:.*best results|strength/i)
  })
})
```

Add the import at the top of the test file if not present: `formatChartContext`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/prompts/formatters.test.js`
Expected: FAIL — no meaning clauses; `formatChartContext` import may be missing.

- [ ] **Step 3: Annotate the formatters**

In `src/lib/prompts/formatters.js`, add to the imports at the top (create the import line if the file has none yet):

```js
import { houseMeaning, planetKaraka, dignityEffect, numberMeaning } from '../llm/reference'
```

In `formatChartContext`, replace the `placements` mapping (the `houses.flatMap(...)` block) so each line appends the meaning clause:

```js
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
```

In `formatNumerologyContext`, after the existing `base` template literal, build a driver/destiny meaning line and append it. Add before the `loshu` handling:

```js
  const numLine = (label, n) => {
    const m = numberMeaning(n)
    return m ? `${label}: ${n} (${m.ruler}) — ${m.traits}` : null
  }
  const numMeanings = [numLine('Driver', numerology.mulank), numLine('Destiny', numerology.bhagyank)]
    .filter(Boolean).join('\n')
```

Then include `numMeanings` in the returned string (append after the `base` block, before/with the Lo Shu section — keep one blank line between sections).

- [ ] **Step 4: Run the formatter tests to verify they pass**

Run: `npx vitest run tests/lib/prompts/formatters.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full unit suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/prompts/formatters.js tests/lib/prompts/formatters.test.js
git commit -m "feat(formatters): mirror atomic meaning annotations in chart & numerology context

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Documentation and final verification

**Files:**
- Modify: `CLAUDE.md` (Conventions section)
- Modify: `src/lib/llm/tools.js` (`astro_reference` description text)

**Interfaces:** none (docs + a description string).

- [ ] **Step 1: Update `astro_reference` description**

In `src/lib/llm/tools.js`, the `astro_reference` tool `description` (line 502): add house/sign/number coverage to the "Covers:" clause. Change the sentence listing coverage to include: `house significations (e.g. '7th house' → marriage), sign natures (e.g. 'Scorpio'), and numerology numbers (e.g. 'number 8'),` alongside the existing divisional/planet/dasha/terms list.

- [ ] **Step 2: Add the convention note to `CLAUDE.md`**

In `CLAUDE.md`, under `## Conventions`, add a bullet:

```markdown
- **Tool/context outputs attach atomic sourced meanings, never pre-merged synthesis.** When a tool
  or formatter returns a placement, period, varga, or number, it appends the relevant *single-key*
  meaning from `src/lib/llm/reference.js` (house signification, planet karaka, sign nature, dignity
  effect, number traits) as separate labelled facts — so the model never invents a primitive. It
  must NOT pre-compute the meaning of a *combination* (e.g. a `(planet, house)` lookup); merging
  primitives into a reading is the model's job.
```

- [ ] **Step 3: Run the full verification bar**

Run each and confirm:

```bash
npx vitest run          # all unit tests PASS
npm run lint            # 0 errors
npm run build           # succeeds
.venv-test/bin/python -m pytest tests/python   # unaffected, still PASS
```

Expected: all green. (Skip `npx playwright test` unless a chat/chart/numbers e2e flow asserts exact wording — none currently do; run it if Task 2 Step 6 surfaced any e2e string dependency.)

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md src/lib/llm/tools.js
git commit -m "docs: record atomic-meaning enrichment convention; extend astro_reference coverage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- House significations → Tasks 1, 2 (`get_chart`/divisional/dasha via `houseMeaning`), 4 (formatters). ✔
- Planet karakas → Tasks 2, 4 (`planetKaraka`). ✔
- Divisional read-guide → Task 2 (`signifies` on `get_divisional`). ✔ (per-occupant karaka also added.)
- Sign natures → Task 1 table + `astro_reference` (Task 5); attached to ashtakavarga is **not** wired — see note below.
- Numerology number meanings → Tasks 3 (tool), 4 (formatter). ✔
- Dignity-effect text → Tasks 1, 2, 4 (`dignityEffect`). ✔
- Atomic-only guarantee → enforced structurally (single-arg accessors) + asserted (master-number omission test, no combination lookup exists). ✔
- Tone untouched → no tone-prompt edits in any task. ✔

**Deliberate scope trim (YAGNI):** `get_ashtakavarga` sign-nature annotation and `get_today_transit`/`get_varshaphal` per-planet karaka from the spec's "where meaning is missing" list are **not** in these tasks — `transitLine`/varshaphal already carry SAV/dignity strength, and adding sign nature to bindu lists risks bloating every transit turn for little gain. If wanted, they are one-line follow-ups using the same accessors. Flagging here rather than silently dropping.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✔

**Type consistency:** `houseMeaning`/`dignityEffect`/`planetKaraka`/`numberMeaning`/`signMeaning` signatures identical across Tasks 1–4. `attachNumberMeanings` shape matches its test. `signifies` key matches `DIVISIONALS` field name. ✔
