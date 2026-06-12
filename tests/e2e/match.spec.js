// E2E for the Match (synastry) tab — exercises the REAL Pyodide compute_synastry path
// that the double-encoding bug broke. Two profiles, compute, expect a Guna Milan score.

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

test('Match computes a Guna Milan score between two profiles (no double-encode error)', async ({ page }) => {
  test.setTimeout(180_000) // first Pyodide load

  await page.addInitScript(([profiles, key]) => {
    localStorage.clear()
    localStorage.setItem('astro:profiles', profiles)
    localStorage.setItem('astro:activeProfileId', 'prof-a')
    localStorage.setItem('astro:apiKey', key)
  }, [JSON.stringify([PROFILE_A, PROFILE_B]), JSON.stringify({ provider: 'claude', key: 'sk-ant-test' })])

  await page.goto(BASE)
  await expect(page).toHaveURL(/\/app/)
  await page.getByRole('button', { name: /^match$/i }).first().click()

  // Select the partner and compute
  await page.locator('select').selectOption('prof-b')
  await page.getByRole('button', { name: 'Match →' }).click()

  // The Guna Milan score card must appear, and no compute error
  await expect(page.getByText('Guna Milan Score')).toBeVisible({ timeout: 150_000 })
  await expect(page.getByText('/36')).toBeVisible()

  // Sanity: a numeric score is rendered (not the "—" fallback)
  const scoreText = await page.getByText('/36').locator('..').innerText()
  expect(scoreText).toMatch(/\d+\s*\/\s*36/)

  // The old bug surfaced as a red error string — make sure it's gone
  const body = await page.locator('body').innerText()
  expect(body).not.toContain('string indices')
  expect(body).not.toContain('d1Chart')
})
