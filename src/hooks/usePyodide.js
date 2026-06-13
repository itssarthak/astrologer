import { useState, useEffect, useCallback } from 'react'
import {
  getPyodide, computeChart, computeTransit,
  computeYogasFallback, computeDoshasFallback,
  computeNumerology, computeSynastry,
} from '../lib/pyodide/index'

// The Pyodide fallback (yogas.py/doshas.py) and the optional PyJHora Lambda emit slightly
// different yoga shapes ({name,category,planets} vs {name,description}). Normalize both to one
// canonical contract so consumers (ChartTab, the get_chart tool) never branch on the source:
//   yogas_active: [{ name, category|null, description|null }]
//   doshas:       { <key>: { present: boolean, text: string } }
export function normalizeYogasDoshas({ yogas_active, doshas } = {}) {
  const yogas = (yogas_active ?? []).map(y =>
    typeof y === 'string'
      ? { name: y, category: null, description: null }
      : { name: y.name ?? '', category: y.category ?? null, description: y.description ?? null }
  )
  const normDoshas = {}
  for (const [key, v] of Object.entries(doshas ?? {})) {
    normDoshas[key] = { present: !!v?.present, text: v?.text ?? '' }
  }
  return { yogas_active: yogas, doshas: normDoshas }
}

export function usePyodide() {
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    setStatus('loading')
    getPyodide(msg => setMessage(msg))
      .then(() => { setStatus('ready'); setMessage('') })
      .catch(() => setStatus('error'))
  }, [])

  const getYogasAndDoshas = useCallback(async (chartJson, birthData) => {
    const apiUrl = import.meta.env.VITE_PYJHORA_API_URL
    if (apiUrl) {
      try {
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(birthData),
        })
        if (resp.ok) return normalizeYogasDoshas(await resp.json())
      } catch {
        // fall through to Pyodide fallback
      }
    }
    const [yogas, doshas] = await Promise.all([
      computeYogasFallback(chartJson),
      computeDoshasFallback(chartJson),
    ])
    return normalizeYogasDoshas({ yogas_active: yogas, doshas })
  }, [])

  return {
    status,
    message,
    isReady: status === 'ready',
    computeChart,
    computeTransit,
    computeNumerology,
    computeSynastry,
    getYogasAndDoshas,
  }
}
