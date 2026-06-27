// E2E for the spec-parity gap fixes: Chart active-dasha key fact + sidebar engine status.

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
  chart: NATAL_CHART, yogas: [], doshas: {}, numerology: {}, createdAt: '2026-06-10T00:00:00.000Z',
}

async function seed(page) {
  await page.addInitScript(([profile, key]) => {
    localStorage.clear()
    localStorage.setItem('astro:profiles', profile)
    localStorage.setItem('astro:activeProfileId', 'fixture-1')
    localStorage.setItem('astro:apiKey', key)
  }, [JSON.stringify([PROFILE]), JSON.stringify({ provider: 'claude', key: 'sk-ant-test' })])
}

test('Chart panel shows the active Vimshottari dasha', async ({ page }) => {
  await seed(page)
  await page.goto(BASE)
  await expect(page).toHaveURL(/\/app/)
  // Chart is embedded in the Chat view (no separate Chart tab); the panel is open by default.

  await expect(page.getByText('Dasha:')).toBeVisible()
  // Fixture's active mahadasha lord is Mercury (only appears in the dasha pill, not the SVG)
  await expect(page.getByText(/Mercury/).first()).toBeVisible()
})

test('Sidebar shows the Python engine status indicator', async ({ page }) => {
  await seed(page)
  await page.goto(BASE)
  await expect(page).toHaveURL(/\/app/)
  // Desktop sidebar (viewport is 1280 wide) shows the engine status; it starts loading and
  // becomes ready. Either way the indicator text mentions the Python engine.
  await expect(page.getByText(/python engine/i)).toBeVisible()
})
