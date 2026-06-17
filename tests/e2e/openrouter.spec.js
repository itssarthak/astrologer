// E2E for the OpenRouter provider: onboarding UI (suggested model + key deeplink) and that
// chat routes to OpenRouter's OpenAI-compatible endpoint.

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

test.describe('OpenRouter — onboarding UI', () => {
  test('suggests openai/gpt-oss-120b:free, shows key deeplink, and saves the config', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto(BASE)
    await page.getByRole('button', { name: /get started/i }).click()
    await page.getByRole('heading', { name: /connect your ai/i }).waitFor()

    await page.getByRole('button', { name: /^openrouter$/i }).click()

    // Model is pre-filled with the suggestion
    await expect(page.locator('input[type="text"]')).toHaveValue('openai/gpt-oss-120b:free')

    // Deeplink to generate a key points at OpenRouter's keys page
    const keyLink = page.getByRole('link', { name: /generate your openrouter api key/i })
    await expect(keyLink).toBeVisible()
    await expect(keyLink).toHaveAttribute('href', 'https://openrouter.ai/keys')

    // OpenRouter has no Base URL field (fixed endpoint)
    await expect(page.locator('input[type="url"]')).toHaveCount(0)

    const continueBtn = page.getByRole('button', { name: /continue/i })
    await expect(continueBtn).toBeDisabled() // model filled but key empty
    await page.fill('input[type="password"]', 'sk-or-test-key')
    await expect(continueBtn).toBeEnabled()

    await continueBtn.click()
    await expect(page.getByRole('heading', { name: /your birth details/i })).toBeVisible()

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('astro:apiKey')))
    expect(saved).toMatchObject({ provider: 'openrouter', key: 'sk-or-test-key', model: 'openai/gpt-oss-120b:free' })
  })
})

test.describe('OpenRouter — request routing', () => {
  test('chat hits the OpenRouter endpoint with the bearer key and model', async ({ page }) => {
    await page.addInitScript(([profile, key]) => {
      localStorage.clear()
      localStorage.setItem('astro:profiles', profile)
      localStorage.setItem('astro:activeProfileId', 'fixture-1')
      localStorage.setItem('astro:apiKey', key)
    }, [JSON.stringify([PROFILE]), JSON.stringify({ provider: 'openrouter', key: 'sk-or-test-key', model: 'openrouter/free' })])

    let captured = null
    await page.route('https://openrouter.ai/**', route => {
      const req = route.request()
      captured = { url: req.url(), auth: req.headers()['authorization'], body: req.postDataJSON() }
      // Chat is agentic + streaming now: respond with OpenAI-compatible SSE.
      route.fulfill({ status: 200, contentType: 'text/event-stream',
        body: `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hello from OpenRouter.' } }] })}\n\ndata: [DONE]\n\n` })
    })
    await page.route('https://api.openai.com/**', route => route.fulfill({ status: 500, body: 'should not be called' }))

    await page.goto(BASE)
    await expect(page).toHaveURL(/\/app/)
    await page.getByRole('button', { name: /^chat$/i }).first().click()

    await page.locator('textarea').fill('Hi')
    await page.locator('textarea').press('Enter')

    await expect(page.getByText('Hello from OpenRouter.')).toBeVisible({ timeout: 10_000 })

    expect(captured).not.toBeNull()
    expect(captured.url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(captured.auth).toBe('Bearer sk-or-test-key')
    expect(captured.body.model).toBe('openrouter/free')
  })
})
