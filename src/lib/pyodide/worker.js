// Pyodide runs here, off the main thread, so chart/synastry computation never blocks the UI.
// The main thread (index.js) talks to this worker over postMessage: an 'init' request that
// streams 'progress' messages and resolves 'ready', and 'compute' requests dispatched to the
// preloaded Python entry points. Results are posted back keyed by request id.

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.29.4/full/pyodide.mjs'

// jyotishganit reads exactly one star from the 53 MB Hipparcos catalogue (hip_main.dat):
// Spica / HIP 65474, used to compute the Lahiri ayanamsa. Skyfield can't download it in the
// WASM sandbox, so we embed just that one fixed-width record — skyfield parses it into a
// 1-row frame and df.loc[65474] resolves, identical to the full catalogue for ~450 bytes.
const SPICA_HIP_RECORD =
  'H|       65474| |13 25 11.60|-11 09 40.5| 0.98|1|G|201.29835230|-11.16124491| |  12.44|  -42.50|  -31.73|  0.75|  0.54|  0.86|  0.79|  0.52|-0.39|-0.22| 0.09| 0.20|-0.02| 0.18|-0.04| 0.30|-0.04|-0.46|  0| 1.52| 65474| 0.877|0.012| 1.031|0.010| |-0.235|0.008|G|-.25|0.02|A| | 0.8891|0.0022|0.014| 38| | 0.87| 0.91|   4.01|P|1|A|13252-1109|I| 1| 1| | | |  |   |       |     |     |    |S| |P|116658|B-10 3672 |          |          |-.25|B1V         |X \n'

// Maps the JS compute function name to its Python compute_*_json entry point.
const PY_FN = {
  computeChart: 'compute_chart_json',
  computeTransit: 'compute_transit_json',
  computeYogasFallback: 'compute_yogas_json',
  computeDoshasFallback: 'compute_doshas_json',
  computeNumerology: 'compute_numerology_json',
  computeNumberCompatibility: 'compute_number_compatibility_json',
  computeNumerologyMatch: 'compute_numerology_match_json',
  computeSynastry: 'compute_synastry_json',
  computeChartFacts: 'chart_facts_json',
  computeVarshaphal: 'compute_varshaphal_json',
}

let pyodide = null
let initPromise = null

function post(msg) { self.postMessage(msg) }

async function init() {
  post({ type: 'progress', message: 'Downloading Python runtime (~5 MB)...' })

  const { loadPyodide } = await import(/* @vite-ignore */ PYODIDE_CDN)
  const py = await loadPyodide()

  post({ type: 'progress', message: 'Loading micropip...' })
  await py.loadPackage(['micropip'])

  post({ type: 'progress', message: 'Installing jyotishganit...' })
  await py.runPythonAsync(`
import micropip
await micropip.install('jyotishganit')
`)

  // de421.bsp: Python's urllib can't make HTTPS requests in Pyodide's WASM sandbox. Fetch in
  // JS, write to /home/pyodide/, then patch skyfield so it copies from there instead of the net.
  post({ type: 'progress', message: 'Loading ephemeris data (~16 MB, first load only)...' })
  const bspResp = await fetch('/de421.bsp')
  if (!bspResp.ok) throw new Error('Failed to fetch ephemeris data (de421.bsp)')
  py.FS.writeFile('/home/pyodide/de421.bsp', new Uint8Array(await bspResp.arrayBuffer()))
  py.FS.writeFile('/home/pyodide/hip_main.dat', SPICA_HIP_RECORD)

  // Patch skyfield + jyotishganit so every data file resolves from /home/pyodide and nothing
  // is fetched over the network (urllib/HTTPS is unavailable in WASM).
  await py.runPythonAsync(`
import os, shutil
import skyfield.iokit as _si
from skyfield.api import Loader
import jyotishganit.core.astronomical as _astro

def _pyodide_download(url, path, verbose=False, backup=None):
    fname = os.path.basename(url)
    cached = f'/home/pyodide/{fname}'
    if os.path.exists(cached):
        dest_dir = os.path.dirname(os.path.abspath(path))
        if dest_dir:
            os.makedirs(dest_dir, exist_ok=True)
        shutil.copy2(cached, path)
    else:
        raise OSError(
            f'Required data file {fname} not found in /home/pyodide/. '
            f'It must be vendored at build time — network downloads are unavailable in Pyodide.'
        )

_si.download = _pyodide_download
_astro.loader = Loader('/home/pyodide')
`)

  // Keep in sync with PY_SCRIPTS in vite.config.js (both must list every module served).
  const scripts = ['chart', 'transit', 'yogas', 'doshas', 'relationships', 'numerology', 'synastry', 'dignity', 'adapter', 'aspects', 'varshaphal']
  for (const name of scripts) {
    post({ type: 'progress', message: `Loading ${name}.py...` })
    const resp = await fetch(`/pyodide-scripts/${name}.py`)
    if (!resp.ok) throw new Error(`Failed to fetch ${name}.py (${resp.status})`)
    py.FS.writeFile(`/home/pyodide/${name}.py`, await resp.text())
  }

  // Preload every compute entry point into globals once, so dispatch is just a call.
  await py.runPythonAsync(`
import sys
sys.path.insert(0, '/home/pyodide')
from chart import compute_chart_json
from transit import compute_transit_json
from yogas import compute_yogas_json
from doshas import compute_doshas_json
from numerology import compute_numerology_json, compute_number_compatibility_json, compute_numerology_match_json
from synastry import compute_synastry_json
from adapter import chart_facts_json
from varshaphal import compute_varshaphal_json
`)

  post({ type: 'progress', message: 'Python engine ready' })
  pyodide = py
  return py
}

function ensureInit() {
  if (!initPromise) initPromise = init()
  return initPromise
}

self.onmessage = async (e) => {
  const { id, type, fn, args } = e.data
  try {
    if (type === 'init') {
      await ensureInit()
      post({ id, type: 'ready' })
      return
    }
    if (type === 'compute') {
      await ensureInit()
      const pyFn = PY_FN[fn]
      if (!pyFn) throw new Error(`Unknown compute function: ${fn}`)
      const resultStr = pyodide.globals.get(pyFn)(...args)
      post({ id, type: 'result', result: JSON.parse(resultStr) })
    }
  } catch (err) {
    post({ id, type: 'error', error: err?.message ?? String(err) })
  }
}
