import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const copyPyScripts = {
  name: 'copy-py-scripts',
  buildStart() {
    const src = resolve(__dirname, 'src/lib/pyodide/scripts')
    const dest = resolve(__dirname, 'public/pyodide-scripts')
    mkdirSync(dest, { recursive: true })
    for (const f of ['chart', 'transit', 'yogas', 'doshas', 'numerology', 'synastry']) {
      copyFileSync(`${src}/${f}.py`, `${dest}/${f}.py`)
    }
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        runtimeCaching: [
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
        description: 'Your private Vedic astrologer — 100% on-device',
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
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
  },
  optimizeDeps: {
    exclude: ['pyodide'],
  },
  worker: {
    format: 'es',
  },
})
