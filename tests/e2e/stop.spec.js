// E2E: the Stop button cancels an in-flight completions request.

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NATAL_CHART = JSON.parse(readFileSync(join(__dirname, 'fixtures/natal-chart.json'), 'utf8'))
const BASE = 'http://localhost:5173'
const LLM = 'https://hang-llm.example.com'

const PROFILE = {
  id: 'prof-a', name: 'Alice', dob: '1990-06-15', time: '14:30', place: 'Mumbai',
  lat: 19.076, lon: 72.877, timezone_offset: 5.5, chart: NATAL_CHART,
  yogas: [], doshas: {}, numerology: {}, createdAt: '2026-06-10T00:00:00.000Z',
}

test('Stop cancels an in-flight chat request', async ({ page }) => {
  await page.addInitScript(([profile, key]) => {
    localStorage.clear()
    localStorage.setItem('astro:profiles', profile)
    localStorage.setItem('astro:activeProfileId', 'prof-a')
    localStorage.setItem('astro:apiKey', key)
  }, [JSON.stringify([PROFILE]), JSON.stringify({ provider: 'custom', key: 'sk-test', baseUrl: `${LLM}/v1`, model: 'm' })])

  // Endpoint that never responds — the request stays in-flight until aborted.
  await page.route(`${LLM}/**`, () => { /* intentionally never fulfilled */ })

  await page.goto(BASE)
  await expect(page).toHaveURL(/\/app/)

  await page.locator('textarea').fill('Hi')
  await page.locator('textarea').press('Enter')

  // While the request hangs, the action button becomes Stop
  const stopBtn = page.getByRole('button', { name: /stop/i })
  await expect(stopBtn).toBeVisible({ timeout: 10_000 })

  await stopBtn.click()

  // After aborting: back to Send, no Stop, no error surfaced
  await expect(page.getByRole('button', { name: /^send$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /stop/i })).toHaveCount(0)
  await expect(page.locator('text=/error/i')).toHaveCount(0)
})
