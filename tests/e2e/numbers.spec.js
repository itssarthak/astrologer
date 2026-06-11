// E2E for the Numbers (numerology) tab — guards the data-shape mapping.

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

// Real output shape from numerology.py: single numbers for life_path/personal_year,
// { chaldean, pythagorean } for the rest.
const NUMEROLOGY = {
  life_path: 4,
  destiny: { chaldean: 1, pythagorean: 7 },
  soul_urge: { chaldean: 8, pythagorean: 7 },
  personality: { chaldean: 11, pythagorean: 9 },
  personal_year: 4,
}

const PROFILE = {
  id: 'fixture-1', name: 'Fixture Person', dob: '1990-06-15', time: '14:30',
  place: 'Mumbai, India', lat: 19.076, lon: 72.877, timezone_offset: 5.5,
  chart: { d1Chart: { houses: [{ number: 1, sign: 'Virgo', occupants: [] }] } },
  yogas: [], doshas: {}, numerology: NUMEROLOGY, createdAt: '2026-06-10T00:00:00.000Z',
}

test('Numbers tab renders the numerology grid with real values', async ({ page }) => {
  await page.addInitScript(([profile, key]) => {
    localStorage.setItem('astro:profiles', profile)
    localStorage.setItem('astro:activeProfileId', 'fixture-1')
    localStorage.setItem('astro:apiKey', key)
  }, [JSON.stringify([PROFILE]), JSON.stringify({ provider: 'claude', key: 'sk-ant-test' })])

  await page.goto(BASE)
  await expect(page).toHaveURL(/\/app/)
  await page.getByRole('button', { name: /^numbers$/i }).first().click()

  await expect(page.getByText('Numerology Profile')).toBeVisible()

  // Labels present
  for (const label of ['Life Path', 'Destiny', 'Soul Urge', 'Personality', 'Personal Year']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible()
  }

  // Primary (Chaldean) values + Pythagorean cross-checks
  await expect(page.getByText('11', { exact: true })).toBeVisible()      // personality chaldean (master kept)
  await expect(page.getByText('Pyth: 7').first()).toBeVisible()          // destiny / soul_urge pyth
  await expect(page.getByText('Pyth: 9')).toBeVisible()                  // personality pyth

  // The grid must NOT be all em-dashes (the symptom of the old inverted-shape bug)
  const gridText = await page.locator('.grid').first().textContent()
  expect(gridText).not.toContain('—')
})
