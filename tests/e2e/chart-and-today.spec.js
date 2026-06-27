// E2E for the ChartPanel (D1 renderer) embedded in the Chat view, and the Today transit
// template prompt. Today and Chart are merged into the Chat tab — there are no separate tabs.
// Uses a real captured natal chart as a fixture so these run fast and deterministically,
// and mocks the Anthropic streaming endpoint so the Today read completes without a key.

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NATAL_CHART = JSON.parse(readFileSync(join(__dirname, 'fixtures/natal-chart.json'), 'utf8'))
const BASE = 'http://localhost:5173'

const PROFILE = {
  id: 'fixture-1',
  name: 'Fixture Person',
  dob: '1990-06-15',
  time: '14:30',
  place: 'Mumbai, India',
  lat: 19.076,
  lon: 72.877,
  timezone_offset: 5.5,
  chart: NATAL_CHART,
  yogas: [],
  doshas: {},
  numerology: {},
  createdAt: '2026-06-10T00:00:00.000Z',
}

// A minimal valid Anthropic SSE stream that yields one text delta then completes.
const CLAUDE_SSE =
  'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Today the Moon favors steady focus."}}\n\n' +
  'data: [DONE]\n\n'

async function seedProfile(page) {
  await page.addInitScript(([profile, key]) => {
    localStorage.setItem('astro:profiles', profile)
    localStorage.setItem('astro:activeProfileId', 'fixture-1')
    localStorage.setItem('astro:apiKey', key)
  }, [JSON.stringify([PROFILE]), JSON.stringify({ provider: 'claude', key: 'sk-ant-test' })])
}

test.describe('ChartPanel (D1 renderer embedded in Chat view)', () => {
  // Explicit desktop viewport: ChartPanel is open by default only on md+ breakpoints (≥768px).
  // Without this the test depends on the Playwright default width which is not guaranteed.
  test.use({ viewport: { width: 1280, height: 800 } })

  test('renders the North Indian chart with real signs and planets', async ({ page }) => {
    await seedProfile(page)
    await page.goto(BASE)
    await expect(page).toHaveURL(/\/app/)

    // Chart panel is visible by default in the Chat view on desktop (1280px wide).
    // Target the Kundli chart specifically (viewBox 0 0 360 360) — other SVGs exist on the
    // page (e.g. the GitHub icon), so `svg.first()` is no longer the chart.
    const svg = page.locator('svg[viewBox="0 0 360 360"]')
    await expect(svg).toBeVisible()

    // Planets from the fixture must appear in the SVG (Sun+Jupiter in H10, Moon in H6,
    // Saturn+Rahu in H5, etc.). SVG <text> lives in textContent, not innerText.
    const svgText = await svg.evaluate(el => el.textContent)
    for (const planet of ['Su', 'Ju', 'Mo', 'Ma', 'Me', 'Ve', 'Sa', 'Ra', 'Ke']) {
      expect(svgText, `expected planet ${planet} in chart`).toContain(planet)
    }
    // Rashi numbers 1–12 are drawn; lagna (house 1) is Virgo (6). Confirm numbers rendered.
    expect(svgText).toMatch(/\d/)
    expect(svgText.length).toBeGreaterThan(20)
  })

  test('D9 sub-tab renders without errors', async ({ page }) => {
    await seedProfile(page)
    await page.goto(BASE)
    // Chart panel is open by default; click the D9 sub-tab inside it.
    await page.getByRole('button', { name: /^D9$/ }).click()
    // D9 has its own ascendant + houses; the SVG should still render (no "not available")
    await expect(page.locator('svg[viewBox="0 0 360 360"]')).toBeVisible()
    await expect(page.getByText('D9 chart not available')).toHaveCount(0)
  })
})

test.describe('Today transit template prompt', () => {
  test('template chip fills the input and the chat response contains the transit read', async ({ page }) => {
    test.setTimeout(180_000) // first Pyodide load

    await seedProfile(page)
    await page.route('https://api.anthropic.com/**', route => route.fulfill({
      status: 200, contentType: 'text/event-stream', body: CLAUDE_SSE,
    }))

    await page.goto(BASE)
    await expect(page).toHaveURL(/\/app/)

    // Click the "Today's transit read" template chip (visible in the empty-state greeting).
    await page.getByRole('button', { name: /today's transit read/i }).click()

    // The input should be pre-filled; submit it.
    await page.locator('textarea').press('Enter')

    // The transit read (from the mocked LLM) should appear, proving computeTransit
    // returned valid data and generateRead ran.
    await expect(page.getByText('Today the Moon favors steady focus.')).toBeVisible({ timeout: 150_000 })

    // The old bug rendered the entire chart JSON as a red error. Assert that's gone.
    const body = await page.locator('body').innerText()
    expect(body).not.toContain('is not in list')
    expect(body).not.toContain('d1Chart')
    expect(body).not.toContain('@type')
  })
})
