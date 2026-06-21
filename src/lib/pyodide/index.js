// Main-thread proxy to the Pyodide Web Worker (worker.js). Pyodide runs off the main thread so
// chart/synastry computation never freezes the UI. The public API (getPyodide + compute*)
// is unchanged, so callers don't know there's a worker behind it.

let worker = null
let nextId = 0
const pending = new Map()
let progressCb = null
let readyPromise = null

// Marshal a value for a Python function that does json.loads on its argument: pass strings
// through untouched, stringify objects. Guards against the double-encode crash that happens
// if an already-serialized string is JSON.stringify'd again.
function asJson(value) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = e => {
      const { id, type, message, result, error } = e.data
      if (type === 'progress') { progressCb?.(message); return }
      const p = pending.get(id)
      if (!p) return
      pending.delete(id)
      if (type === 'error') p.reject(new Error(error))
      else p.resolve(type === 'ready' ? undefined : result)
    }
    worker.onerror = e => {
      // A worker-level failure rejects every in-flight request.
      const err = new Error(e.message || 'Pyodide worker error')
      for (const p of pending.values()) p.reject(err)
      pending.clear()
    }
  }
  return worker
}

function request(type, fn, args) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, type, fn, args })
  })
}

// Resolves once Pyodide has loaded in the worker. onMessage receives progress strings.
export function getPyodide(onMessage) {
  if (onMessage) progressCb = onMessage
  if (!readyPromise) readyPromise = request('init')
  return readyPromise
}

async function compute(fn, args) {
  await getPyodide()
  return request('compute', fn, args)
}

export async function computeChart(name, dob, time, lat, lon, tzOffset, locationName = '') {
  return compute('computeChart', [name, dob, time, lat, lon, tzOffset, locationName])
}

export async function computeTransit(natalLagnaSign, lat, lon, tzOffset, onDate = null) {
  return compute('computeTransit', [natalLagnaSign, lat, lon, tzOffset, onDate])
}

export async function computeYogasFallback(chartJson) {
  return compute('computeYogasFallback', [asJson(chartJson)])
}

export async function computeDoshasFallback(chartJson) {
  return compute('computeDoshasFallback', [asJson(chartJson)])
}

export async function computeNumerology(fullName, dob, gender = null, nameInUse = null) {
  return compute('computeNumerology', [fullName, dob, gender, nameInUse])
}

export async function computeNumberCompatibility(a, b) {
  return compute('computeNumberCompatibility', [a, b])
}

export async function computeNumerologyMatch(nameA, dobA, genderA, nameB, dobB, genderB) {
  return compute('computeNumerologyMatch', [nameA, dobA, genderA ?? '', nameB, dobB, genderB ?? ''])
}

export async function computeLoshuGrid(dob, gender) {
  return compute('computeLoshuGrid', [dob, gender ?? ''])
}

export async function computeSynastry(chartJsonA, chartJsonB, genderA = '', genderB = '') {
  return compute('computeSynastry', [asJson(chartJsonA), asJson(chartJsonB), genderA ?? '', genderB ?? ''])
}

export async function computeChartFacts(chartJson, refDate = null) {
  return compute('computeChartFacts', [asJson(chartJson), refDate])
}

export async function computeVarshaphal(natalChartJson, targetYear, lat, lon, tz, birthYear, birthMonth, birthDay, birthHour, birthMinute) {
  return compute('computeVarshaphal', [asJson(natalChartJson), targetYear, lat, lon, tz, birthYear, birthMonth, birthDay, birthHour, birthMinute])
}
