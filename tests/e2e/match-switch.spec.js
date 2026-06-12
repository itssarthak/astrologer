// E2E: switching the active profile while in the Match tab must reset the match (it's
// computed relative to the active profile) and load the new profile's own match chat.

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NATAL_CHART = JSON.parse(readFileSync(join(__dirname, 'fixtures/natal-chart.json'), 'utf8'))
const BASE = 'http://localhost:5173'

const base = { dob: '1990-06-15', time: '14:30', place: 'Mumbai', lat: 19.076, lon: 72.877, timezone_offset: 5.5, chart: NATAL_CHART, yogas: [], doshas: {}, numerology: {}, createdAt: '2026-06-10T00:00:00.000Z' }
const ALICE = { ...base, id: 'prof-a', name: 'Alice' }
const BOB = { ...base, id: 'prof-b', name: 'Bob' }
const CAROL = { ...base, id: 'prof-c', name: 'Carol' }

const CLAUDE_SSE = 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"A solid match."}}\n\ndata: [DONE]\n\n'

test('switching active profile resets the Match and swaps its chat', async ({ page }) => {
  test.setTimeout(180_000) // first Pyodide load

  await page.addInitScript(([profiles, key]) => {
    localStorage.clear()
    localStorage.setItem('astro:profiles', profiles)
    localStorage.setItem('astro:activeProfileId', 'prof-a')
    localStorage.setItem('astro:apiKey', key)
    localStorage.setItem('astro:chat:prof-a:match', JSON.stringify([{ role: 'user', content: "Alice's match question" }]))
    localStorage.setItem('astro:chat:prof-c:match', JSON.stringify([{ role: 'user', content: "Carol's match question" }]))
  }, [JSON.stringify([ALICE, BOB, CAROL]), JSON.stringify({ provider: 'claude', key: 'sk-ant-test' })])

  await page.route('https://api.anthropic.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: CLAUDE_SSE }))

  await page.goto(BASE)
  await expect(page).toHaveURL(/\/app/)
  await page.getByRole('button', { name: /^match$/i }).first().click()

  // Active is Alice — her match chat shows
  await expect(page.getByText("Alice's match question")).toBeVisible()

  // Compute a match Alice ↔ Bob
  await page.locator('select').selectOption('prof-b')
  await page.getByRole('button', { name: 'Match →' }).click()
  await expect(page.getByText('Guna Milan')).toBeVisible({ timeout: 150_000 })

  // Switch active profile to Carol via the sidebar
  await page.locator('aside').getByText('Carol').click()

  // The Alice↔Bob match must be gone (reset), and Carol's own match chat loads
  await expect(page.getByText('Guna Milan')).toHaveCount(0)
  await expect(page.getByText("Alice's match question")).toHaveCount(0)
  await expect(page.getByText("Carol's match question")).toBeVisible()
  // Partner selector reset
  await expect(page.locator('select')).toHaveValue('')
})
