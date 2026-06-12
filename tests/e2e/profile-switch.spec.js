// E2E: switching the active profile must swap the chat to that profile's own history.
// Chats are stored per profile (astro:chat:<id>:<tab>); the bug was that the in-memory
// messages didn't reload on switch, so it stayed stuck on the first profile.

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

test('switching profile loads that profile’s own chat history', async ({ page }) => {
  await page.addInitScript(([profiles, key]) => {
    localStorage.clear()
    localStorage.setItem('astro:profiles', profiles)
    localStorage.setItem('astro:activeProfileId', 'prof-a')
    localStorage.setItem('astro:apiKey', key)
    // Distinct per-profile chat histories
    localStorage.setItem('astro:chat:prof-a:chat', JSON.stringify([{ role: 'user', content: 'Alice asks about her career' }]))
    localStorage.setItem('astro:chat:prof-b:chat', JSON.stringify([{ role: 'user', content: 'Bob asks about his health' }]))
  }, [JSON.stringify([ALICE, BOB]), JSON.stringify({ provider: 'claude', key: 'sk-ant-test' })])

  await page.goto(BASE)
  await expect(page).toHaveURL(/\/app/)

  // Default tab is Chat, active profile is Alice → Alice's chat shows
  await expect(page.getByText('Alice asks about her career')).toBeVisible()
  await expect(page.getByText('Bob asks about his health')).toHaveCount(0)

  // Switch to Bob in the sidebar
  await page.locator('aside').getByText('Bob').click()

  // Now Bob's chat shows and Alice's is gone — they're independent
  await expect(page.getByText('Bob asks about his health')).toBeVisible()
  await expect(page.getByText('Alice asks about her career')).toHaveCount(0)

  // Switch back to Alice → her chat returns
  await page.locator('aside').getByText('Alice').click()
  await expect(page.getByText('Alice asks about her career')).toBeVisible()
  await expect(page.getByText('Bob asks about his health')).toHaveCount(0)
})
