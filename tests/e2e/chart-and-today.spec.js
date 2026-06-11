// E2E for the Chart (D1) renderer and the Today transit fix.
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

test.describe('Chart tab (D1 renderer)', () => {
  test('renders the North Indian chart with real signs and planets', async ({ page }) => {
    await seedProfile(page)
    await page.goto(BASE)
    await expect(page).toHaveURL(/\/app/)

    await page.getByRole('button', { name: /^chart$/i }).first().click()

    const svg = page.locator('svg').first()
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
    await page.getByRole('button', { name: /^chart$/i }).first().click()
    await page.getByRole('button', { name: /^D9$/ }).click()
    // D9 has its own ascendant + houses; the SVG should still render (no "not available")
    await expect(page.locator('svg').first()).toBeVisible()
    await expect(page.getByText('D9 chart not available')).toHaveCount(0)
  })
})

test.describe('Today tab (transit fix)', () => {
  test('computes transit and shows a read — no raw JSON error', async ({ page }) => {
    test.setTimeout(180_000) // first Pyodide load

    await seedProfile(page)
    await page.route('https://api.anthropic.com/**', route => route.fulfill({
      status: 200, contentType: 'text/event-stream', body: CLAUDE_SSE,
    }))

    await page.goto(BASE)
    await expect(page).toHaveURL(/\/app/)
    await page.getByRole('button', { name: /^today$/i }).first().click()

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
