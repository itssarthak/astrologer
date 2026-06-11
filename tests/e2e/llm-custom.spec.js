// E2E for the custom (OpenAI-compatible) LLM provider and the Today single-compute fix.

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

const OPENAI_SSE =
  'data: {"choices":[{"delta":{"content":"Hello from your custom endpoint."}}]}\n\n' +
  'data: [DONE]\n\n'

async function seedProfile(page, apiKey) {
  await page.addInitScript(([profile, key]) => {
    localStorage.setItem('astro:profiles', profile)
    localStorage.setItem('astro:activeProfileId', 'fixture-1')
    localStorage.setItem('astro:apiKey', key)
  }, [JSON.stringify([PROFILE]), JSON.stringify(apiKey)])
}

test.describe('Custom LLM provider — onboarding UI', () => {
  test('selecting Custom reveals Base URL + Model and gates Continue', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto(BASE)
    await page.getByRole('button', { name: /get started/i }).click()
    await page.getByRole('heading', { name: /connect your ai/i }).waitFor()

    // No custom fields until Custom is chosen
    await expect(page.getByText('Base URL')).toHaveCount(0)
    await page.getByRole('button', { name: /^custom$/i }).click()
    await expect(page.getByText('Base URL')).toBeVisible()
    await expect(page.getByText(/^Model$/)).toBeVisible()

    const continueBtn = page.getByRole('button', { name: /continue/i })

    // Custom needs URL + model + key before Continue enables
    await page.fill('input[type="url"]', 'https://my-llm.example.com/v1')
    await expect(continueBtn).toBeDisabled()
    await page.fill('input[placeholder="e.g. llama-3.1-70b"]', 'my-model')
    await expect(continueBtn).toBeDisabled()
    await page.fill('input[type="password"]', 'my-secret-key')
    await expect(continueBtn).toBeEnabled()

    await continueBtn.click()
    await expect(page.getByRole('heading', { name: /your birth details/i })).toBeVisible()

    // It persisted the full custom config
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('astro:apiKey')))
    expect(saved).toMatchObject({ provider: 'custom', key: 'my-secret-key', baseUrl: 'https://my-llm.example.com/v1', model: 'my-model' })
  })
})

test.describe('Custom LLM provider — request routing', () => {
  test('chat hits the custom Base URL with the configured model and key', async ({ page }) => {
    await seedProfile(page, { provider: 'custom', key: 'my-secret-key', baseUrl: 'https://my-llm.example.com/v1', model: 'my-model' })

    let captured = null
    await page.route('https://my-llm.example.com/**', route => {
      const req = route.request()
      captured = { url: req.url(), auth: req.headers()['authorization'], body: req.postDataJSON() }
      route.fulfill({ status: 200, contentType: 'text/event-stream', body: OPENAI_SSE })
    })
    // If the code wrongly hit OpenAI's real host, fail loudly instead of going to network
    await page.route('https://api.openai.com/**', route => route.fulfill({ status: 500, body: 'should not be called' }))

    await page.goto(BASE)
    await expect(page).toHaveURL(/\/app/)
    await page.getByRole('button', { name: /^chat$/i }).first().click()

    await page.locator('textarea').fill('Hello')
    await page.locator('textarea').press('Enter')

    await expect(page.getByText('Hello from your custom endpoint.')).toBeVisible({ timeout: 10_000 })

    expect(captured).not.toBeNull()
    expect(captured.url).toBe('https://my-llm.example.com/v1/chat/completions')
    expect(captured.auth).toBe('Bearer my-secret-key')
    expect(captured.body.model).toBe('my-model')
  })
})

test.describe('Today tab computes exactly once', () => {
  test('transit read is generated with a single LLM call (no duplicate)', async ({ page }) => {
    test.setTimeout(180_000)
    await seedProfile(page, { provider: 'claude', key: 'sk-ant-test' })

    let calls = 0
    await page.route('https://api.anthropic.com/**', route => {
      calls += 1
      route.fulfill({
        status: 200, contentType: 'text/event-stream',
        body: 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Single read."}}\n\ndata: [DONE]\n\n',
      })
    })

    await page.goto(BASE)
    await expect(page).toHaveURL(/\/app/)
    await page.getByRole('button', { name: /^today$/i }).first().click()

    await expect(page.getByText('Single read.')).toBeVisible({ timeout: 150_000 })
    // Give any erroneous second run a chance to fire, then assert it didn't.
    await page.waitForTimeout(1500)
    expect(calls).toBe(1)

    // Leaving and returning to the Today tab must NOT recompute — today's read is cached.
    await page.getByRole('button', { name: /^chat$/i }).first().click()
    await page.getByRole('button', { name: /^today$/i }).first().click()
    await expect(page.getByText('Single read.')).toBeVisible()
    await page.waitForTimeout(1000)
    expect(calls).toBe(1)
  })
})
