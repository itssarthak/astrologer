// E2E: while a response is streaming, switching profiles must be blocked so the stream
// can't land in another profile's chat.

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NATAL_CHART = JSON.parse(readFileSync(join(__dirname, 'fixtures/natal-chart.json'), 'utf8'))
const BASE = 'http://localhost:5173'
const LLM = 'https://hang-llm.example.com'

const base = { dob: '1990-06-15', time: '14:30', place: 'Mumbai', lat: 19.076, lon: 72.877, timezone_offset: 5.5, chart: NATAL_CHART, yogas: [], doshas: {}, numerology: {}, createdAt: '2026-06-10T00:00:00.000Z' }
const ALICE = { ...base, id: 'prof-a', name: 'Alice' }
const BOB = { ...base, id: 'prof-b', name: 'Bob' }

test('profile switch is blocked while a response is streaming', async ({ page }) => {
  await page.addInitScript(([profiles, key]) => {
    localStorage.clear()
    localStorage.setItem('astro:profiles', profiles)
    localStorage.setItem('astro:activeProfileId', 'prof-a')
    localStorage.setItem('astro:apiKey', key)
    localStorage.setItem('astro:chat:prof-a:chat', JSON.stringify([{ role: 'user', content: 'Alice question' }]))
    localStorage.setItem('astro:chat:prof-b:chat', JSON.stringify([{ role: 'user', content: 'Bob question' }]))
  }, [JSON.stringify([ALICE, BOB]), JSON.stringify({ provider: 'custom', key: 'sk', baseUrl: `${LLM}/v1`, model: 'm' })])

  // Hanging endpoint keeps the request (and the busy state) in flight.
  await page.route(`${LLM}/**`, () => { /* never responds */ })

  await page.goto(BASE)
  await expect(page).toHaveURL(/\/app/)
  await expect(page.getByText('Alice question')).toBeVisible()

  // Kick off a streaming request
  await page.locator('textarea').fill('Hi')
  await page.locator('textarea').press('Enter')
  await expect(page.getByRole('button', { name: /stop/i })).toBeVisible({ timeout: 10_000 }) // now busy

  // Try to switch to Bob while busy — should be blocked
  await page.locator('aside').getByText('Bob').click()
  await page.waitForTimeout(500)

  // Still Alice: her chat is shown, Bob's is not, and the active id is unchanged
  await expect(page.getByText('Alice question')).toBeVisible()
  await expect(page.getByText('Bob question')).toHaveCount(0)
  const activeId = await page.evaluate(() => localStorage.getItem('astro:activeProfileId'))
  expect(activeId).toBe('prof-a')

  // After stopping, switching works again
  await page.getByRole('button', { name: /stop/i }).click()
  await page.locator('aside').getByText('Bob').click()
  await expect(page.getByText('Bob question')).toBeVisible()
})
