// E2E for the Match (synastry) tab — exercises the REAL Pyodide compute_synastry path,
// the enriched overlay card, and the auto-generated compatibility read.

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NATAL_CHART = JSON.parse(readFileSync(join(__dirname, 'fixtures/natal-chart.json'), 'utf8'))
const BASE = 'http://localhost:5173'

const base = { dob: '1990-06-15', time: '14:30', place: 'Mumbai', lat: 19.076, lon: 72.877, timezone_offset: 5.5, chart: NATAL_CHART, yogas: [], doshas: {}, numerology: {}, createdAt: '2026-06-10T00:00:00.000Z' }
const PROFILE_A = { ...base, id: 'prof-a', name: 'Alice' }
const PROFILE_B = { ...base, id: 'prof-b', name: 'Bob' }

const CLAUDE_SSE =
  'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"You two balance each other well."}}\n\n' +
  'data: [DONE]\n\n'

test('Match shows Guna breakdown, classified overlays, and an auto compatibility read', async ({ page }) => {
  test.setTimeout(180_000) // first Pyodide load

  await page.addInitScript(([profiles, key]) => {
    localStorage.clear()
    localStorage.setItem('astro:profiles', profiles)
    localStorage.setItem('astro:activeProfileId', 'prof-a')
    localStorage.setItem('astro:apiKey', key)
  }, [JSON.stringify([PROFILE_A, PROFILE_B]), JSON.stringify({ provider: 'claude', key: 'sk-ant-test' })])

  // Mock the LLM so the auto-generated read completes deterministically
  await page.route('https://api.anthropic.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: CLAUDE_SSE }))

  await page.goto(BASE)
  await expect(page).toHaveURL(/\/app/)
  await page.getByRole('button', { name: /^match$/i }).first().click()

  await page.locator('select').selectOption('prof-b')
  await page.getByRole('button', { name: 'Match →' }).click()

  // Guna Milan card with real breakdown (the old UI rendered an empty 'kuttas' grid)
  await expect(page.getByText('Guna Milan')).toBeVisible({ timeout: 150_000 })
  await expect(page.getByText('/36')).toBeVisible()
  await expect(page.getByText(/nadi/i)).toBeVisible() // a koota from the breakdown

  // Enriched planetary overlay section
  await expect(page.getByText('Planetary compatibility')).toBeVisible()
  await expect(page.getByText(/supportive/i).first()).toBeVisible()
  await expect(page.getByText(/challenging/i).first()).toBeVisible()

  // Auto-generated compatibility read (from the mocked LLM)
  await expect(page.getByText('Compatibility Read')).toBeVisible()
  await expect(page.getByText('You two balance each other well.')).toBeVisible()

  // Indicative numerology panel, separate from Guna Milan (real compute_numerology_match)
  await expect(page.getByText('Numerology Compatibility')).toBeVisible()
  await expect(page.getByText(/indicative, non-classical/i)).toBeVisible()

  // The old double-encode bug is gone
  const body = await page.locator('body').innerText()
  expect(body).not.toContain('string indices')
  expect(body).not.toContain('d1Chart')
})
