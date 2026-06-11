// E2E for the GitHub link + live star count shown at the top of the app.

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NATAL_CHART = JSON.parse(readFileSync(join(__dirname, 'fixtures/natal-chart.json'), 'utf8'))
const BASE = 'http://localhost:5173'
const REPO_URL = 'https://github.com/itssarthak/astrologer'

const PROFILE = {
  id: 'fixture-1', name: 'Fixture Person', dob: '1990-06-15', time: '14:30',
  place: 'Mumbai, India', lat: 19.076, lon: 72.877, timezone_offset: 5.5,
  chart: NATAL_CHART, yogas: [], doshas: {}, numerology: {}, createdAt: '2026-06-10T00:00:00.000Z',
}

async function seedApp(page) {
  await page.addInitScript(([profile, key]) => {
    localStorage.clear()
    localStorage.setItem('astro:profiles', profile)
    localStorage.setItem('astro:activeProfileId', 'fixture-1')
    localStorage.setItem('astro:apiKey', key)
  }, [JSON.stringify([PROFILE]), JSON.stringify({ provider: 'claude', key: 'sk-ant-test' })])
}

test('app header shows the GitHub link with the repo URL and star count', async ({ page }) => {
  await page.route('https://api.github.com/repos/itssarthak/astrologer', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ stargazers_count: 1234 }) }))

  await seedApp(page)
  await page.goto(BASE)
  await expect(page).toHaveURL(/\/app/)

  const link = page.getByRole('link', { name: /star/i }).first()
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', REPO_URL)
  // 1234 → formatted as 1.2k
  await expect(page.getByText('1.2k').first()).toBeVisible()
})

test('onboarding shows the GitHub link too', async ({ page }) => {
  await page.route('https://api.github.com/repos/itssarthak/astrologer', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ stargazers_count: 7 }) }))

  await page.addInitScript(() => localStorage.clear())
  await page.goto(`${BASE}/onboarding`)

  const link = page.getByRole('link', { name: /star/i }).first()
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', REPO_URL)
  await expect(page.getByText('7', { exact: true }).first()).toBeVisible()
})

test('link still renders if the GitHub API is unreachable (graceful fallback)', async ({ page }) => {
  await page.route('https://api.github.com/repos/itssarthak/astrologer', route =>
    route.fulfill({ status: 500, body: 'rate limited' }))

  await seedApp(page)
  await page.goto(BASE)

  const link = page.getByRole('link', { name: /star/i }).first()
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', REPO_URL)
})
