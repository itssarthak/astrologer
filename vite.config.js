import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
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
  plugins: [react(), tailwindcss(), copyPyScripts],
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
