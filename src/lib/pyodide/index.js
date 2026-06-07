import { loadPyodide } from 'pyodide'

let _pyodide = null
let _initPromise = null

export const LOADING_MESSAGES = [
  "Loading Python engine...",
  "Unpacking the star catalogue...",
  "This takes ~15s on first load...",
  "Calibrating ephemeris data...",
  "Almost ready...",
]

async function _init(onMessage) {
  let msgIdx = 0
  const interval = setInterval(() => {
    onMessage?.(LOADING_MESSAGES[msgIdx % LOADING_MESSAGES.length])
    msgIdx++
  }, 2500)

  try {
    const pyodide = await loadPyodide()
    await pyodide.loadPackage(['micropip'])
    await pyodide.runPythonAsync(`
import micropip
await micropip.install('jyotishganit')
`)

    const scripts = ['chart', 'transit', 'yogas', 'doshas', 'numerology', 'synastry']
    for (const name of scripts) {
      const resp = await fetch(`/pyodide-scripts/${name}.py`)
      const code = await resp.text()
      pyodide.FS.writeFile(`/home/pyodide/${name}.py`, code)
    }

    clearInterval(interval)
    onMessage?.('Python engine ready')
    return pyodide
  } catch (err) {
    clearInterval(interval)
    throw err
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
  const result = py.globals.get('compute_yogas_json')(JSON.stringify(chartJson))
  return JSON.parse(result)
}

export async function computeDoshasFallback(chartJson) {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from doshas import compute_doshas_json
`)
  const result = py.globals.get('compute_doshas_json')(JSON.stringify(chartJson))
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

export async function computeSynastry(chartJsonA, chartJsonB) {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from synastry import compute_synastry_json
`)
  const result = py.globals.get('compute_synastry_json')(
    JSON.stringify(chartJsonA), JSON.stringify(chartJsonB)
  )
  return JSON.parse(result)
}
