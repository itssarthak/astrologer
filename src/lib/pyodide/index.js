// Dynamic CDN import so Pyodide resolves all its own assets (WASM, micropip wheel,
// stdlib) from the same CDN origin — avoids SRI failures caused by the npm package
// serving local files with different hashes than the CDN lock file.
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.29.4/full/pyodide.mjs'

// jyotishganit reads exactly one star from the 53 MB Hipparcos catalogue (hip_main.dat):
// Spica / HIP 65474, used to compute the Lahiri ayanamsa. Skyfield can't download it in
// the WASM sandbox, so we embed just that one fixed-width record. Skyfield's
// hipparcos.load_dataframe() parses this into a 1-row frame and df.loc[65474] resolves —
// identical to loading the full catalogue, for ~450 bytes instead of 53 MB.
const SPICA_HIP_RECORD =
  'H|       65474| |13 25 11.60|-11 09 40.5| 0.98|1|G|201.29835230|-11.16124491| |  12.44|  -42.50|  -31.73|  0.75|  0.54|  0.86|  0.79|  0.52|-0.39|-0.22| 0.09| 0.20|-0.02| 0.18|-0.04| 0.30|-0.04|-0.46|  0| 1.52| 65474| 0.877|0.012| 1.031|0.010| |-0.235|0.008|G|-.25|0.02|A| | 0.8891|0.0022|0.014| 38| | 0.87| 0.91|   4.01|P|1|A|13252-1109|I| 1| 1| | | |  |   |       |     |     |    |S| |P|116658|B-10 3672 |          |          |-.25|B1V         |X \n'

let _pyodide = null
let _initPromise = null

// Marshal a value for a Python function that does json.loads on its argument: pass strings
// through untouched, stringify objects. Guards against the double-encode crash that happens
// if an already-serialized string is JSON.stringify'd again.
function asJson(value) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

async function _init(onMessage) {
  onMessage?.('Downloading Python runtime (~5 MB)...')

  // loadPyodide has no progress events — show timed sub-steps so the user
  // knows things are moving during the long first-load WASM download
  const subSteps = [
    [4000,  'Unpacking WASM binary...'],
    [9000,  'Initializing Python interpreter...'],
    [14000, 'Loading standard library...'],
    [19000, 'Python ready, installing packages...'],
  ]
  let timers = subSteps.map(([ms, msg]) => setTimeout(() => onMessage?.(msg), ms))
  const clearTimers = () => { timers.forEach(clearTimeout); timers = [] }

  try {
    // eslint-disable-next-line import/no-unresolved
    const { loadPyodide } = await import(/* @vite-ignore */ PYODIDE_CDN)
    const pyodide = await loadPyodide()
    clearTimers()

    onMessage?.('Loading micropip...')
    await pyodide.loadPackage(['micropip'])

    onMessage?.('Installing jyotishganit...')
    await pyodide.runPythonAsync(`
import micropip
await micropip.install('jyotishganit')
`)

    // de421.bsp: Python's urllib can't make HTTPS requests in Pyodide's WASM sandbox.
    // Fetch in JS, write to /home/pyodide/, then patch skyfield so it never tries
    // to download over the network — it copies from /home/pyodide/ instead.
    onMessage?.('Loading ephemeris data (~16 MB, first load only)...')
    const bspResp = await fetch('/de421.bsp')
    if (!bspResp.ok) throw new Error('Failed to fetch ephemeris data (de421.bsp)')
    pyodide.FS.writeFile('/home/pyodide/de421.bsp', new Uint8Array(await bspResp.arrayBuffer()))

    // jyotishganit also reads Spica from the Hipparcos catalogue (hip_main.dat) for the
    // ayanamsa. Write the embedded single-record file so skyfield never tries to download it.
    pyodide.FS.writeFile('/home/pyodide/hip_main.dat', SPICA_HIP_RECORD)

    // Patch skyfield + jyotishganit so every data file resolves from /home/pyodide and
    // nothing is ever fetched over the network (urllib/HTTPS is unavailable in WASM).
    //   - de421.bsp goes through the custom loader (_astro.loader)
    //   - hip_main.dat goes through skyfield's global `load`, which falls back to
    //     skyfield.iokit.download when the file isn't already in its directory — so we
    //     patch download() to copy from /home/pyodide instead of hitting the network.
    await pyodide.runPythonAsync(`
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

    const scripts = ['chart', 'transit', 'yogas', 'doshas', 'numerology', 'synastry']
    for (const name of scripts) {
      onMessage?.(`Loading ${name}.py...`)
      const resp = await fetch(`/pyodide-scripts/${name}.py`)
      const code = await resp.text()
      pyodide.FS.writeFile(`/home/pyodide/${name}.py`, code)
    }

    onMessage?.('Python engine ready')
    return pyodide
  } finally {
    // Clear any still-pending sub-step timers so they don't fire stale messages
    // after a failed init (no-op if already cleared on the success path).
    clearTimers()
  }
}

export function getPyodide(onMessage) {
  if (_pyodide) return Promise.resolve(_pyodide)
  if (!_initPromise) {
    _initPromise = _init(onMessage).then(p => {
      _pyodide = p
      return p
    })
  }
  return _initPromise
}

export async function computeChart(name, dob, time, lat, lon, tzOffset, locationName = '') {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from chart import compute_chart_json
`)
  const result = py.globals.get('compute_chart_json')(name, dob, time, lat, lon, tzOffset, locationName)
  return JSON.parse(result)
}

export async function computeTransit(natalLagnaSign, lat, lon, tzOffset) {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from transit import compute_transit_json
`)
  const result = py.globals.get('compute_transit_json')(natalLagnaSign, lat, lon, tzOffset)
  return JSON.parse(result)
}

export async function computeYogasFallback(chartJson) {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from yogas import compute_yogas_json
`)
  const result = py.globals.get('compute_yogas_json')(asJson(chartJson))
  return JSON.parse(result)
}

export async function computeDoshasFallback(chartJson) {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from doshas import compute_doshas_json
`)
  const result = py.globals.get('compute_doshas_json')(asJson(chartJson))
  return JSON.parse(result)
}

export async function computeNumerology(fullName, dob) {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from numerology import compute_numerology_json
`)
  const result = py.globals.get('compute_numerology_json')(fullName, dob)
  return JSON.parse(result)
}

export async function computeSynastry(chartJsonA, chartJsonB, genderA = '', genderB = '') {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from synastry import compute_synastry_json
`)
  const result = py.globals.get('compute_synastry_json')(
    asJson(chartJsonA), asJson(chartJsonB), genderA ?? '', genderB ?? ''
  )
  return JSON.parse(result)
}
