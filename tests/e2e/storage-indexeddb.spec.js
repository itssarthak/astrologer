// E2E: chat history persists across reloads via IndexedDB (not localStorage).
// Proves the storage migration end-to-end: a sent message survives a reload and is stored as
// per-message records in the `askmyastro` IndexedDB database, with no localStorage chat blob.

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NATAL_CHART = JSON.parse(readFileSync(join(__dirname, 'fixtures/natal-chart.json'), 'utf8'))
const BASE = 'http://localhost:5173'
const LLM = 'https://store-llm.example.com'

const PROFILE = {
  id: 'prof-a', name: 'Alice', dob: '1990-06-15', time: '14:30', place: 'Mumbai',
  lat: 19.076, lon: 72.877, timezone_offset: 5.5, chart: NATAL_CHART,
  yogas: [], doshas: {}, numerology: {}, createdAt: '2026-06-10T00:00:00.000Z',
}

const sse = (...events) => events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n'
const finalResponse = text => sse({ choices: [{ delta: { content: text } }] })

async function seed(page) {
  await page.addInitScript(([profiles, key]) => {
    localStorage.setItem('astro:profiles', profiles)
    localStorage.setItem('astro:activeProfileId', 'prof-a')
    localStorage.setItem('astro:apiKey', key)
  }, [JSON.stringify([PROFILE]), JSON.stringify({ provider: 'custom', key: 'sk-test', baseUrl: `${LLM}/v1`, model: 'test-model' })])
}

// Read all records from the messages store of the app's IndexedDB database, in the page context.
function readIdbMessages(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('askmyastro')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction('messages', 'readonly')
      const req = tx.objectStore('messages').getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }
  }))
}

test('chat history persists across reload via IndexedDB, not localStorage', async ({ page }) => {
  await seed(page)
  await page.route(`${LLM}/**`, route =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: finalResponse('Greetings, Alice.') }))

  await page.goto(BASE)
  await expect(page).toHaveURL(/\/app/)

  // Send a message and get the assistant reply.
  await page.locator('textarea').fill('Hello astrologer')
  await page.locator('textarea').press('Enter')
  await expect(page.getByText('Greetings, Alice.')).toBeVisible({ timeout: 15_000 })

  // The conversation is stored as per-message records in IndexedDB...
  const records = await readIdbMessages(page)
  const chatRecords = records.filter(r => r.tab === 'chat' && r.profileId === 'prof-a')
  expect(chatRecords.map(r => r.content)).toContain('Hello astrologer')
  expect(chatRecords.map(r => r.content)).toContain('Greetings, Alice.')

  // ...and NOT mirrored to a localStorage chat blob (that's the whole point of the migration).
  const lsChat = await page.evaluate(() => localStorage.getItem('astro:chat:prof-a:chat'))
  expect(lsChat).toBeNull()

  // Reload: history comes back from IndexedDB (the localStorage clear above proves the source).
  await page.reload()
  await expect(page).toHaveURL(/\/app/)
  await expect(page.getByText('Hello astrologer')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Greetings, Alice.')).toBeVisible()
})
