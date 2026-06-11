// Downloads the DE421 planetary ephemeris into public/ at build time.
// The 16 MB binary is gitignored (kept out of the repo), so a fresh checkout — including
// every Vercel build — won't have it. The app fetches /de421.bsp at runtime to compute
// charts, so this must exist in the build output. Runs before `vite build`.
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEST = resolve(__dirname, '../public/de421.bsp')
const URL = 'https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de421.bsp'
const EXPECTED_BYTES = 16788480
const MAX_ATTEMPTS = 3

// Skip if already present and the right size (fast local rebuilds).
if (existsSync(DEST) && statSync(DEST).size === EXPECTED_BYTES) {
  console.log('[ephemeris] de421.bsp already present — skipping download')
  process.exit(0)
}

mkdirSync(dirname(DEST), { recursive: true })

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  try {
    console.log(`[ephemeris] downloading de421.bsp (attempt ${attempt}/${MAX_ATTEMPTS})...`)
    const resp = await fetch(URL)
    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)
    await pipeline(Readable.fromWeb(resp.body), createWriteStream(DEST))

    const size = statSync(DEST).size
    if (size !== EXPECTED_BYTES) throw new Error(`size mismatch: got ${size}, expected ${EXPECTED_BYTES}`)
    console.log(`[ephemeris] saved ${size} bytes to public/de421.bsp`)
    process.exit(0)
  } catch (err) {
    console.error(`[ephemeris] attempt ${attempt} failed: ${err.message}`)
    if (attempt === MAX_ATTEMPTS) {
      console.error('[ephemeris] could not download de421.bsp — the deployed app will fail to compute charts.')
      process.exit(1)
    }
  }
}
