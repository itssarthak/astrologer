// E2E: onboarding flow → MainApp visible
// Run: npx playwright test tests/e2e/onboarding.spec.js
// Note: chart compute step (Pyodide) is not tested here — it takes 2+ min on first load.

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

// Mock responses so place-selection works without a live Nominatim proxy
const NOMINATIM_MOCK = [
  { display_name: 'Mumbai, Maharashtra, India', lat: '19.0760', lon: '72.8777', place_id: 1 },
]
const TIMEAPI_MOCK = { currentUtcOffset: { seconds: 19800 } } // UTC+5:30 IST

const SAVED_PROFILE = {
  id: 'test-id-123',
  name: 'Test Person',
  dob: '1990-06-15',
  time: '14:30',
  place: 'Mumbai, India',
  lat: 19.076,
  lon: 72.877,
  timezone_offset: 5.5,
  chart: { ascendant: { sign: 'Leo' }, houses: [] },
  yogas: [],
  doshas: {},
  numerology: {},
  createdAt: new Date().toISOString(),
}

// ── Tests that start with empty storage ───────────────────────────────────────

test.describe('Onboarding flow (fresh start)', () => {
  test.beforeEach(async ({ page }) => {
    // addInitScript fires before every navigation in this test, keeping storage clear
    await page.addInitScript(() => localStorage.clear())
    await page.goto(BASE)
  })

  test('redirects to /onboarding when no saved profile', async ({ page }) => {
    await expect(page).toHaveURL(/\/onboarding/)
  })

  test('Step 1: Welcome screen heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /your personal astrologer/i })).toBeVisible()
  })

  test('Step 1: Get Started advances to API key step', async ({ page }) => {
    await page.getByRole('button', { name: /get started/i }).click()
    await expect(page.getByRole('heading', { name: /connect your ai/i })).toBeVisible()
  })

  test('Step 1: Get Started skips API key when key already saved', async ({ page }) => {
    // Seed the API key before load so the storage cache hydrates with it (the app reads the key
    // from the hydrated cache, not synchronously from localStorage). addInitScript runs after the
    // beforeEach clear on the reload below, so the key survives.
    await page.addInitScript(() => {
      localStorage.setItem('astro:apiKey', JSON.stringify({ provider: 'claude', key: 'sk-ant-test' }))
    })
    await page.reload()
    await page.getByRole('button', { name: /get started/i }).click()
    await expect(page.getByRole('heading', { name: /your birth details/i })).toBeVisible()
  })

  test('Step 2: Continue button is disabled when API key is empty', async ({ page }) => {
    await page.getByRole('button', { name: /get started/i }).click()
    await page.getByRole('heading', { name: /connect your ai/i }).waitFor()
    await expect(page.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Step 2: Entering an API key enables Continue and advances', async ({ page }) => {
    await page.getByRole('button', { name: /get started/i }).click()
    await page.getByRole('heading', { name: /connect your ai/i }).waitFor()
    await page.fill('input[type="password"]', 'sk-ant-api03-test')
    await page.getByRole('button', { name: /continue/i }).click()
    await expect(page.getByRole('heading', { name: /your birth details/i })).toBeVisible()
  })

  test('Step 3: Birth details form renders all required fields', async ({ page }) => {
    // Seed the API key before load so the storage cache hydrates with it (the app reads the key
    // from the hydrated cache, not synchronously from localStorage). addInitScript runs after the
    // beforeEach clear on the reload below, so the key survives.
    await page.addInitScript(() => {
      localStorage.setItem('astro:apiKey', JSON.stringify({ provider: 'claude', key: 'sk-ant-test' }))
    })
    await page.reload()
    await page.getByRole('button', { name: /get started/i }).click()
    await page.getByRole('heading', { name: /your birth details/i }).waitFor()
    await expect(page.locator('#bf-name')).toBeVisible()
    await expect(page.locator('#bf-dob')).toBeVisible()
    await expect(page.locator('#bf-time')).toBeVisible()
    await expect(page.locator('#bf-place')).toBeVisible()
  })

  test('Step 3: Submit disabled until place selected from autocomplete', async ({ page }) => {
    await page.route('**/api/nominatim/**', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(NOMINATIM_MOCK),
    }))
    // Seed the API key before load so the storage cache hydrates with it (the app reads the key
    // from the hydrated cache, not synchronously from localStorage). addInitScript runs after the
    // beforeEach clear on the reload below, so the key survives.
    await page.addInitScript(() => {
      localStorage.setItem('astro:apiKey', JSON.stringify({ provider: 'claude', key: 'sk-ant-test' }))
    })
    await page.reload()
    await page.getByRole('button', { name: /get started/i }).click()
    await page.getByRole('heading', { name: /your birth details/i }).waitFor()

    await page.fill('#bf-name', 'Test Person')
    await page.fill('#bf-dob', '1990-06-15')
    await page.fill('#bf-time', '14:30')

    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeDisabled()

    // Trigger place autocomplete and select the first result
    await page.fill('#bf-place', 'Mum')
    await page.locator('#bf-place').dispatchEvent('input')
    await page.locator('ul li').first().waitFor({ timeout: 3000 })
    await page.locator('ul li').first().click()

    await expect(submitBtn).toBeEnabled()
  })

  test('Step 3: Submitting with a valid place advances to computing step', async ({ page }) => {
    await page.route('**/api/nominatim/**', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(NOMINATIM_MOCK),
    }))
    await page.route('**/api/timeapi/**', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(TIMEAPI_MOCK),
    }))
    // Seed the API key before load so the storage cache hydrates with it (the app reads the key
    // from the hydrated cache, not synchronously from localStorage). addInitScript runs after the
    // beforeEach clear on the reload below, so the key survives.
    await page.addInitScript(() => {
      localStorage.setItem('astro:apiKey', JSON.stringify({ provider: 'claude', key: 'sk-ant-test' }))
    })
    await page.reload()
    await page.getByRole('button', { name: /get started/i }).click()
    await page.getByRole('heading', { name: /your birth details/i }).waitFor()

    await page.fill('#bf-name', 'Test Person')
    await page.fill('#bf-dob', '1990-06-15')
    await page.fill('#bf-time', '14:30')
    await page.fill('#bf-place', 'Mum')
    await page.locator('#bf-place').dispatchEvent('input')
    await page.locator('ul li').first().waitFor({ timeout: 3000 })
    await page.locator('ul li').first().click()
    await page.locator('button[type="submit"]').click()

    await expect(page.getByRole('heading', { name: /computing your chart/i })).toBeVisible({ timeout: 5000 })
  })
})

// ── Tests that start with a pre-seeded profile ────────────────────────────────

test.describe('MainApp with existing profile', () => {
  test.beforeEach(async ({ page }) => {
    // Seed storage BEFORE the page navigates so RequireSetup sees the profile
    const profileJson = JSON.stringify([SAVED_PROFILE])
    const keyJson = JSON.stringify({ provider: 'claude', key: 'sk-ant-test' })
    await page.addInitScript(([profiles, activeId, apiKey]) => {
      localStorage.setItem('astro:profiles', profiles)
      localStorage.setItem('astro:activeProfileId', activeId)
      localStorage.setItem('astro:apiKey', apiKey)
    }, [profileJson, SAVED_PROFILE.id, keyJson])
    await page.goto(BASE)
  })

  test('RequireSetup guard sends to /app', async ({ page }) => {
    await expect(page).toHaveURL(/\/app/, { timeout: 5000 })
  })

  test('profile name is visible in the app shell', async ({ page }) => {
    await expect(page).toHaveURL(/\/app/, { timeout: 5000 })
    await expect(page.getByText('Test Person').first()).toBeVisible()
  })

  test('all five tab buttons are visible', async ({ page }) => {
    await expect(page).toHaveURL(/\/app/, { timeout: 5000 })
    for (const tab of ['Chat', 'Today', 'Chart', 'Numbers', 'Match']) {
      await expect(page.getByRole('button', { name: new RegExp(tab, 'i') }).first()).toBeVisible()
    }
  })
})
