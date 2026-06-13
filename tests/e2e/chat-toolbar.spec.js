// E2E for the shared ChatToolbar: Refresh + Clear chat (with deletion confirmation).

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NATAL_CHART = JSON.parse(readFileSync(join(__dirname, 'fixtures/natal-chart.json'), 'utf8'))
const BASE = 'http://localhost:5173'

const PROFILE = {
  id: 'fixture-1', name: 'Fixture Person', dob: '1990-06-15', time: '14:30',
  place: 'Mumbai, India', lat: 19.076, lon: 72.877, timezone_offset: 5.5,
  chart: NATAL_CHART, yogas: [], doshas: {},
  numerology: { life_path: 4, destiny: { chaldean: 1, pythagorean: 7 }, soul_urge: { chaldean: 8, pythagorean: 7 }, personality: { chaldean: 11, pythagorean: 9 }, personal_year: 4 },
  createdAt: '2026-06-10T00:00:00.000Z',
}

const CHAT_KEY = 'astro:chat:fixture-1:chat'

async function seed(page, withHistory = true) {
  await page.addInitScript(([profile, key, chatKey, history]) => {
    localStorage.setItem('astro:profiles', profile)
    localStorage.setItem('astro:activeProfileId', 'fixture-1')
    localStorage.setItem('astro:apiKey', key)
    if (history) localStorage.setItem(chatKey, history)
  }, [
    JSON.stringify([PROFILE]),
    JSON.stringify({ provider: 'claude', key: 'sk-ant-test' }),
    CHAT_KEY,
    withHistory ? JSON.stringify([
      { role: 'user', content: 'Hello there' },
      { role: 'assistant', content: 'Greetings, seeker.' },
    ]) : null,
  ])
}

test.describe('ChatToolbar', () => {
  test('Refresh + Clear chat buttons render on chat-bearing tabs', async ({ page }) => {
    await seed(page)
    await page.goto(BASE)
    await expect(page).toHaveURL(/\/app/)

    for (const tab of ['Chat', 'Chart', 'Numbers', 'Match']) {
      await page.getByRole('button', { name: new RegExp(`^${tab}$`, 'i') }).first().click()
      await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /clear chat/i })).toBeVisible()
    }
  })

  test('Clear chat warns about permanent deletion and cancel keeps history', async ({ page }) => {
    await seed(page)
    await page.goto(BASE)
    await expect(page.getByText('Hello there')).toBeVisible()

    await page.getByRole('button', { name: /clear chat/i }).click()

    // Confirmation must clearly warn this is permanent
    await expect(page.getByText('Clear this conversation?')).toBeVisible()
    await expect(page.getByText(/permanently deletes/i)).toBeVisible()
    await expect(page.getByText(/can't be undone/i)).toBeVisible()

    // Cancel → nothing deleted
    await page.getByRole('button', { name: /^cancel$/i }).click()
    await expect(page.getByText('Clear this conversation?')).toHaveCount(0)
    await expect(page.getByText('Hello there')).toBeVisible()
    const stillThere = await page.evaluate(k => localStorage.getItem(k), CHAT_KEY)
    expect(JSON.parse(stillThere)).toHaveLength(2)
  })

  test('Clear chat → Delete forever wipes the conversation and storage', async ({ page }) => {
    await seed(page)
    await page.goto(BASE)
    await expect(page.getByText('Hello there')).toBeVisible()

    await page.getByRole('button', { name: /clear chat/i }).click()
    await page.getByRole('button', { name: /delete forever/i }).click()

    await expect(page.getByText('Clear this conversation?')).toHaveCount(0)
    await expect(page.getByText('Hello there')).toHaveCount(0)
    await expect(page.getByText('Greetings, seeker.')).toHaveCount(0)

    // Storage cleared
    const after = await page.evaluate(k => localStorage.getItem(k), CHAT_KEY)
    expect(after).toBeNull()
  })

  test('Clear chat is disabled when there are no messages', async ({ page }) => {
    await seed(page, false) // no history
    await page.goto(BASE)
    await expect(page).toHaveURL(/\/app/)
    await expect(page.getByRole('button', { name: /clear chat/i })).toBeDisabled()
  })

  test('blank chat shows the astrologer greeting, personalised with the profile name', async ({ page }) => {
    await seed(page, false) // no history → greeting should show
    await page.goto(BASE)
    await expect(page).toHaveURL(/\/app/)
    await expect(page.getByText(/Namaste, Fixture Person/)).toBeVisible()
  })

  test('greeting is hidden once the chat has messages', async ({ page }) => {
    await seed(page, true) // existing history → no greeting
    await page.goto(BASE)
    await expect(page).toHaveURL(/\/app/)
    await expect(page.getByText('Greetings, seeker.')).toBeVisible()
    await expect(page.getByText(/Namaste, Fixture Person/)).toHaveCount(0)
  })
})
