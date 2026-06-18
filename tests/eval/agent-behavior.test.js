// Live-LLM behaviour evals — the scenarios that need a real model and so could only be checked by
// hand before. Gated on an OpenRouter key: skipped (not failed) when no key is present, so a normal
// `npx vitest run` / CI stays green. Run them with:
//
//   OPENROUTER_API_KEY=sk-or-...  npx vitest run tests/eval
//   (or drop the key in .env — it's auto-loaded and gitignored)
//
// They build the REAL system prompt via assembleSystemPrompt + the real formatters, sample several
// replies per scenario, discard tool-call artifacts, and assert on aggregates with margin (a single
// flaky reply must not fail the run). Thresholds are calibrated from observed behaviour: the OLD
// prompt averaged ~12–22 jargon mentions per reading, the fixed prompt ~0–6.
//
// They run ONLY when RUN_LLM_EVALS is set (so a plain `npx vitest run` never makes network calls
// just because a key sits in .env). Use the npm script: `npm run test:eval`.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { assembleSystemPrompt } from '../../src/lib/prompts/systemPrompt'
import { formatChartContext, formatTransitContext, formatNumerologyContext } from '../../src/lib/prompts/formatters'
import { getKey, MODEL, sampleValid, jargonCount } from './_llm'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CHART = JSON.parse(readFileSync(join(__dirname, '../e2e/fixtures/natal-chart.json'), 'utf8'))
const PROFILE = { name: 'Asha', dob: '1990-06-15', time: '14:30', place: 'Mumbai', gender: 'female', chart: CHART }

const KEY = getKey()
const ENABLED = !!KEY && !!process.env.RUN_LLM_EVALS
const N = Number(process.env.TONE_RUNS || 4)
const TIMEOUT = 240_000

const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

describe.skipIf(!ENABLED)(`agent behaviour evals (live: ${MODEL})`, () => {
  it('chart reading: stays in layman language (low jargon, substantive)', async () => {
    const system = assembleSystemPrompt(PROFILE, 'chart', { extraContext: formatChartContext(CHART, [], {}) })
    const replies = await sampleValid(system, 'Give me a reading of my chart — what should I focus on for my career, and when?', N)
    const counts = replies.map(jargonCount)
    console.log('[chart] jargon per reply:', counts, 'median', median(counts))
    expect(replies.length).toBe(N)
    expect(replies.every(r => r.length > 150)).toBe(true)   // real readings, not one-liners
    expect(median(counts)).toBeLessThanOrEqual(6)           // OLD ran 12–22; fixed prompt well under this
  }, TIMEOUT)

  it('daily transit read: short and layman', async () => {
    const transit = {
      date: '2026-06-18', time: '09:00',
      panchanga: { vara: 'Thursday', tithi: 'Shukla Saptami', nakshatra: 'Hasta', yoga: 'Siddhi', karana: 'Vanija' },
      planets: [
        { planet: 'Sun', natal_house: 10, sign: 'Gemini', retrograde: false },
        { planet: 'Moon', natal_house: 4, sign: 'Sagittarius', retrograde: false },
        { planet: 'Saturn', natal_house: 7, sign: 'Pisces', retrograde: true },
      ],
    }
    const system = assembleSystemPrompt(PROFILE, 'today', { extraContext: formatTransitContext(transit, CHART) })
    const replies = await sampleValid(system, "What's today looking like for me?", N)
    const counts = replies.map(jargonCount)
    console.log('[today] jargon per reply:', counts, 'lengths', replies.map(r => r.length))
    expect(replies.length).toBe(N)
    expect(median(counts)).toBeLessThanOrEqual(6)
    // Daily reads are meant to stay tight — a one-line feel, a couple of notes, a do + an avoid.
    expect(median(replies.map(r => r.length))).toBeLessThan(2000)
  }, TIMEOUT)

  it('timing: gives absolute dates, not relative ones', async () => {
    const system = assembleSystemPrompt(PROFILE, 'chart', { extraContext: formatChartContext(CHART, [], {}) })
    const replies = await sampleValid(system, 'When is the best phase for a career change for me?', N)
    const withYear = replies.filter(r => /\b20\d\d\b/.test(r)).length
    const relative = replies.filter(r => /\b(months?|weeks?|years?)\s+from\s+now\b/i.test(r))
    console.log('[timing] replies with a year:', withYear, '/', replies.length)
    expect(replies.length).toBe(N)
    expect(withYear).toBeGreaterThanOrEqual(Math.ceil(N / 2)) // most replies anchor timing to real years
    expect(relative.length).toBe(0)                            // never "six months from now"
  }, TIMEOUT)

  it('numerology: explains the numbers in plain terms (low astro jargon, substantive)', async () => {
    const numerology = {
      life_path: 4,
      destiny: { chaldean: 1, pythagorean: 7 },
      soul_urge: { chaldean: 8, pythagorean: 7 },
      personality: { chaldean: 11, pythagorean: 9 },
      personal_year: 4,
    }
    const system = assembleSystemPrompt(PROFILE, 'numbers', { extraContext: formatNumerologyContext(numerology) })
    const replies = await sampleValid(system, 'What do my numbers say about me?', N)
    const counts = replies.map(jargonCount)
    console.log('[numbers] jargon per reply:', counts)
    expect(replies.length).toBe(N)
    expect(replies.every(r => r.length > 150)).toBe(true)
    expect(median(counts)).toBeLessThanOrEqual(4)
  }, TIMEOUT)
})

// Visible heads-up when the evals are skipped, so a green run isn't mistaken for "these passed".
describe.runIf(!ENABLED)('agent behaviour evals', () => {
  it('skipped: run `npm run test:eval` (needs OPENROUTER_API_KEY in env or .env)', () => {
    expect(true).toBe(true)
  })
})
