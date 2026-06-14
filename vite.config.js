import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

// The Python compute scripts live in src/ as the single source of truth and are copied
// into public/ (which is gitignored — generated, not committed) so the app can fetch them
// at runtime. Copied at build time AND watched in dev, so edits never serve stale.
const PY_SCRIPT_SRC = resolve(__dirname, 'src/lib/pyodide/scripts')
const PY_SCRIPT_DEST = resolve(__dirname, 'public/pyodide-scripts')
// Keep in sync with the scripts array in src/lib/pyodide/worker.js.
const PY_SCRIPTS = ['chart', 'transit', 'yogas', 'doshas', 'relationships', 'numerology', 'synastry', 'dignity', 'adapter', 'aspects', 'varshaphal']

function copyPyScriptsToPublic() {
  mkdirSync(PY_SCRIPT_DEST, { recursive: true })
  for (const f of PY_SCRIPTS) {
    copyFileSync(`${PY_SCRIPT_SRC}/${f}.py`, `${PY_SCRIPT_DEST}/${f}.py`)
  }
}

const copyPyScripts = {
  name: 'copy-py-scripts',
  buildStart() {
    copyPyScriptsToPublic()
  },
  configureServer(server) {
    server.watcher.add(PY_SCRIPT_SRC)
    // Re-copy on edit AND on new files (a newly added module — e.g. from a branch switch —
    // fires 'add', not 'change'; without this it would 404 in a running dev session).
    const onPy = file => {
      if (file.startsWith(PY_SCRIPT_SRC) && file.endsWith('.py')) copyPyScriptsToPublic()
    }
    server.watcher.on('change', onPy)
    server.watcher.on('add', onPy)
  },
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    copyPyScripts,
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // de421.bsp (16 MB) is intentionally NOT in the precache glob — Workbox caps
        // precached files at 2 MiB, and forcing it into the SW install would bloat first
        // load. It's cached at runtime on first chart compute instead (rule below).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,py}'],
        runtimeCaching: [
          {
            // Ephemeris binary — same-origin, immutable. CacheFirst so it's stored on first
            // fetch and available offline afterward.
            urlPattern: ({ url }) => url.pathname.endsWith('/de421.bsp'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ephemeris-cache',
              expiration: {
                maxEntries: 2,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /cdn\.jsdelivr\.net\/pyodide\/.+\.(wasm|js|data)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pyodide-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /nominatim\.openstreetmap\.org/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'geocode-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Ask My Astro',
        short_name: 'AskMyAstro',
        description: 'Your private Vedic astrologer — your birth data stays on your device',
        theme_color: '#c45c1a',
        background_color: '#fdf6ee',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/nominatim/, ''),
      },
      '/api/timeapi': {
        target: 'https://timeapi.io',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/timeapi/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
    // tests/e2e/*.spec.js are Playwright tests — run via `npx playwright test`, not vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
  },
  optimizeDeps: {
    exclude: ['pyodide'],
  },
  worker: {
    format: 'es',
  },
})
