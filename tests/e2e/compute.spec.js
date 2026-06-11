// E2E: the REAL chart computation path (Pyodide + jyotishganit + skyfield).
// This is the path the UI-only onboarding tests do NOT cover. It actually runs Python
// in the browser: downloads Pyodide + wheels from CDN, loads the vendored de421.bsp and
// the embedded Spica record, and computes a full birth chart.
//
// Slow by nature (first load pulls ~50 MB of wheels + 16 MB ephemeris), so it has its own
// long timeout and is kept in a separate file from the fast UI tests.
//
// Run just this:  npx playwright test tests/e2e/compute.spec.js

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

// Real Mumbai coordinates so jyotishganit gets a valid location; geocoding is mocked
// because we're testing the compute path, not the network lookups.
const NOMINATIM_MOCK = [
  { display_name: 'Mumbai, Maharashtra, India', lat: '19.0760', lon: '72.8777', place_id: 1 },
]
const TIMEAPI_MOCK = { currentUtcOffset: { seconds: 19800 } } // UTC+5:30 IST

test.describe('Real chart computation', () => {
  test('onboarding computes a real chart and lands on /app', async ({ page }) => {
    // Pyodide cold start + wheel downloads + ephemeris can take a while
    test.setTimeout(240_000)

    await page.addInitScript(() => localStorage.clear())

    await page.route('**/api/nominatim/**', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(NOMINATIM_MOCK),
    }))
    await page.route('**/api/timeapi/**', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(TIMEAPI_MOCK),
    }))

    // Surface any Python traceback that bubbles to the console so failures are debuggable
    const consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto(BASE)
    const t0 = Date.now()

    // Welcome → API key (a placeholder key is fine; compute never calls the LLM)
    await page.getByRole('button', { name: /get started/i }).click()
    await page.getByRole('heading', { name: /connect your ai/i }).waitFor()
    await page.fill('input[type="password"]', 'sk-ant-placeholder-for-compute-test')
    await page.getByRole('button', { name: /continue/i }).click()

    // Birth details
    await page.getByRole('heading', { name: /your birth details/i }).waitFor()
    await page.fill('#bf-name', 'Test Person')
    await page.fill('#bf-dob', '1990-06-15')
    await page.fill('#bf-time', '14:30')
    await page.fill('#bf-place', 'Mum')
    await page.locator('#bf-place').dispatchEvent('input')
    await page.locator('ul li').first().waitFor({ timeout: 5000 })
    await page.locator('ul li').first().click()
    await page.locator('button[type="submit"]').click()

    // Computing screen appears
    await expect(page.getByRole('heading', { name: /computing your chart/i })).toBeVisible({ timeout: 10_000 })

    // Race: either we reach /app (success) or the error screen appears (fail fast).
    const errorScreen = page.getByText(/something went wrong/i)
    const reachedApp = page.waitForURL(/\/app/, { timeout: 230_000 })

    await Promise.race([
      reachedApp,
      errorScreen.waitFor({ timeout: 230_000 }).then(async () => {
        const detail = await page.locator('p.text-muted, p.text-xs').allTextContents()
        throw new Error(`Computation failed: ${detail.join(' | ')}\nConsole: ${consoleErrors.slice(-5).join('\n')}`)
      }),
    ])

    const computeSeconds = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`[compute] reached /app in ${computeSeconds}s`)

    // Confirm we're actually in the app with the computed profile
    await expect(page).toHaveURL(/\/app/)
    await expect(page.getByText('Test Person').first()).toBeVisible()

    // Exactly one profile (StrictMode double-invoke must not create duplicates)
    const profiles = await page.evaluate(() => JSON.parse(localStorage.getItem('astro:profiles') || '[]'))
    expect(profiles.length).toBe(1)

    // The chart must contain REAL jyotishganit output. The ascendant + planet longitudes
    // are derived from the Lahiri ayanamsa, which requires Spica from hip_main.dat — so a
    // populated chart with planetary sidereal positions proves the Spica path executed.
    const chart = profiles[0].chart
    expect(chart).toBeTruthy()
    const chartStr = JSON.stringify(chart)
    console.log(`[compute] chart top-level keys: ${Object.keys(chart).join(', ')}`)
    console.log(`[compute] chart payload size: ${chartStr.length} bytes`)

    // jyotishganit output includes a D1 chart with the nine grahas. Assert the chart is
    // substantial and mentions core planets — not an empty/stub object.
    expect(chartStr.length).toBeGreaterThan(500)
    expect(chartStr).toMatch(/Sun|Surya|Moon|Chandra/i)
    expect(chartStr).toMatch(/Ascendant|Lagna|d1/i)
  })
})
