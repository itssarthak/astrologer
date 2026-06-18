// Shared helpers for the live-LLM behaviour evals. These tests need a real model, so they are
// gated on an OpenRouter key and skipped when it's absent (see each test's describe.skipIf).
//
// Key resolution: process.env.OPENROUTER_API_KEY first, else parse a project-root .env file (so it
// "just works" whether you `export` the key or drop it in .env — which is gitignored).
import { readFileSync } from 'fs'
import { join } from 'path'

export function getKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim()
  try {
    const env = readFileSync(join(process.cwd(), '.env'), 'utf8')
    const line = env.split('\n').find(l => l.startsWith('OPENROUTER_API_KEY='))
    if (line) return line.slice('OPENROUTER_API_KEY='.length).trim().replace(/^["']|["']$/g, '')
  } catch { /* no .env */ }
  return null
}

export const MODEL = process.env.TONE_MODEL || 'openai/gpt-oss-120b:free'

// Appended to eval user messages. The evals pass no tools to the API, so without this the model
// sometimes emits a tool-call JSON blob instead of prose. Identical for every arm/scenario.
export const ANSWER_DIRECTLY =
  ' (Everything you need is already in the computed data above — answer me directly in prose; do not call any tools or output JSON.)'

// Jargon a layman reply should avoid. Word-boundary, case-insensitive.
export const JARGON = [
  'dasha', 'bhukti', 'antardasha', 'mahadasha', 'nakshatra', 'lagna', 'rasi', 'rashi', 'karaka',
  'navamsa', 'dasamsa', 'varga', 'shadbala', 'moolatrikona', 'gochar', 'ascendant', 'retrograde',
  'exalted', 'debilitat', 'conjunct', 'ashtakavarga', 'shodasavarga', 'panchanga',
  'Mercury', 'Venus', 'Saturn', 'Jupiter', 'Mars', 'Rahu', 'Ketu',
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius',
  'Capricorn', 'Aquarius', 'Pisces',
]

export function jargonHits(text) {
  const t = text.toLowerCase()
  const hits = {}
  for (const w of JARGON) {
    const m = t.match(new RegExp(`\\b${w.toLowerCase()}`, 'g'))
    if (m) hits[w] = m.length
  }
  return hits
}

export function jargonCount(text) {
  return Object.values(jargonHits(text)).reduce((a, b) => a + b, 0)
}

// True when the model returned a tool-call/JSON blob or empty content instead of a real reply.
export function isDegenerate(text) {
  const t = (text ?? '').trim()
  if (!t) return true
  if (t.startsWith('{') || t.startsWith('[')) return true
  if (/"(action|method|tool|tool_name|parameters|arguments|profile_id|name)"\s*:/.test(t)) return true
  if (/\b(get_dasha|get_chart|get_yogas|get_doshas|get_divisional|get_today_transit|get_varshaphal|get_ashtakavarga|list_profiles|astro_reference)\b/.test(t) && t.length < 400) return true
  return false
}

export async function chat(system, user, { temperature = 0.4 } = {}) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      stream: false, temperature,
    }),
  })
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return (data.choices?.[0]?.message?.content ?? '').trim()
}

// Collect `n` valid (non-degenerate) prose replies, retrying past tool-call artifacts.
export async function sampleValid(system, user, n = 4) {
  const replies = []
  let attempts = 0
  while (replies.length < n && attempts < n * 4) {
    attempts++
    const text = await chat(system, user + ANSWER_DIRECTLY)
    if (!isDegenerate(text)) replies.push(text)
  }
  return replies
}
