// E2E for the agentic chat: the LLM asks to call a tool, we execute it in the browser,
// feed the result back, and it answers. Provider is a mocked OpenAI-compatible endpoint.

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NATAL_CHART = JSON.parse(readFileSync(join(__dirname, 'fixtures/natal-chart.json'), 'utf8'))
const BASE = 'http://localhost:5173'
const LLM = 'https://agent-llm.example.com'

const base = { dob: '1990-06-15', time: '14:30', place: 'Mumbai', lat: 19.076, lon: 72.877, timezone_offset: 5.5, chart: NATAL_CHART, yogas: [], doshas: {}, numerology: {}, createdAt: '2026-06-10T00:00:00.000Z' }
const ALICE = { ...base, id: 'prof-a', name: 'Alice' }
const BOB = { ...base, id: 'prof-b', name: 'Bob' }

// The agent streams now: mock the OpenAI-compatible endpoint as text/event-stream SSE.
const sse = (...events) => events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n'
const toolCallResponse = (name, args) =>
  sse({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] })
const finalResponse = text => sse({ choices: [{ delta: { content: text } }] })
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function seed(page) {
  await page.addInitScript(([profiles, key]) => {
    localStorage.clear()
    localStorage.setItem('astro:profiles', profiles)
    localStorage.setItem('astro:activeProfileId', 'prof-a')
    localStorage.setItem('astro:apiKey', key)
  }, [JSON.stringify([ALICE, BOB]), JSON.stringify({ provider: 'custom', key: 'sk-test', baseUrl: `${LLM}/v1`, model: 'test-model' })])
}

// Drives the two-round loop: first call -> the given tool call, second call -> final text.
function mockTwoRound(page, toolName, toolArgs, finalText, capture) {
  return page.route(`${LLM}/**`, route => {
    capture.bodies.push(route.request().postDataJSON())
    const body = capture.bodies.length === 1 ? toolCallResponse(toolName, toolArgs) : finalResponse(finalText)
    route.fulfill({ status: 200, contentType: 'text/event-stream', body })
  })
}

test('agent calls a read tool (list_profiles) and answers', async ({ page }) => {
  const capture = { bodies: [] }
  await seed(page)
  await mockTwoRound(page, 'list_profiles', {}, 'You have two profiles saved: Alice and Bob.', capture)

  await page.goto(BASE)
  await expect(page).toHaveURL(/\/app/)
  await page.locator('textarea').fill('Who do I have saved?')
  await page.locator('textarea').press('Enter')

  await expect(page.getByText('You have two profiles saved: Alice and Bob.')).toBeVisible({ timeout: 15_000 })

  // Two rounds happened, and the tool result was fed back into the 2nd request
  expect(capture.bodies.length).toBe(2)
  const round1 = JSON.stringify(capture.bodies[0])
  expect(round1).toContain('list_profiles') // tools were offered
  // System prompt is genericized to the active profile at runtime — not hardcoded to Sarthak
  expect(round1).toContain('Alice')
  expect(round1).not.toContain('Sarthak')
  expect(round1).not.toContain('{{NAME}}')
  const round2 = JSON.stringify(capture.bodies[1])
  expect(round2).toContain('"role":"tool"')
  expect(round2).toContain('Alice')
  expect(round2).toContain('Bob')
})

test('agent calls get_chart and the real chart summary flows back', async ({ page }) => {
  test.setTimeout(180_000) // get_chart runs computeChartFacts in Pyodide; first load can be slow under parallel workers
  const capture = { bodies: [] }
  await seed(page)
  await mockTwoRound(page, 'get_chart', { profile_name: 'Alice' }, 'Alice has a Virgo ascendant.', capture)

  await page.goto(BASE)
  await page.locator('textarea').fill("What's Alice's ascendant?")
  await page.locator('textarea').press('Enter')

  await expect(page.getByText('Alice has a Virgo ascendant.')).toBeVisible({ timeout: 150_000 })
  // The tool call is shown in the chat thread as a chip
  await expect(page.getByText('Fetched the birth chart')).toBeVisible()
  // The executed tool returned the REAL ascendant from the fixture (Virgo) into round 2
  expect(JSON.stringify(capture.bodies[1])).toContain('Virgo')
})

test('tool chip appears while the tool runs, before the completion arrives', async ({ page }) => {
  await seed(page)
  // Round 1 -> tool call; round 2 (the completion) is delayed so the tool-running phase is observable.
  let calls = 0
  await page.route(`${LLM}/**`, async route => {
    calls += 1
    if (calls === 1) {
      route.fulfill({ status: 200, contentType: 'text/event-stream', body: toolCallResponse('get_chart', { profile_name: 'Alice' }) })
    } else {
      await sleep(3000)
      route.fulfill({ status: 200, contentType: 'text/event-stream', body: finalResponse('Alice has a Virgo ascendant.') })
    }
  })

  await page.goto(BASE)
  await page.locator('textarea').fill("What's Alice's ascendant?")
  await page.locator('textarea').press('Enter')

  // The chip is visible WHILE the tool runs — i.e. before the completion text shows.
  await expect(page.getByText('Fetched the birth chart')).toBeVisible({ timeout: 2500 })
  await expect(page.getByText('Alice has a Virgo ascendant.')).not.toBeVisible()
  // …and it remains once the answer lands.
  await expect(page.getByText('Alice has a Virgo ascendant.')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Fetched the birth chart')).toBeVisible()
})

test('agent calls a Pyodide compute tool (match_profiles)', async ({ page }) => {
  test.setTimeout(180_000) // first Pyodide load
  const capture = { bodies: [] }
  await seed(page)
  await mockTwoRound(page, 'match_profiles', { partner_name: 'Bob' }, 'You two are broadly compatible.', capture)

  await page.goto(BASE)
  await page.locator('textarea').fill('Am I compatible with Bob?')
  await page.locator('textarea').press('Enter')

  await expect(page.getByText('You two are broadly compatible.')).toBeVisible({ timeout: 150_000 })
  // The tool call is shown in the chat thread
  await expect(page.getByText('Checked compatibility')).toBeVisible()
  // The real synastry result (guna_milan) was computed in-browser and fed back
  expect(JSON.stringify(capture.bodies[1])).toContain('guna_milan')
})
