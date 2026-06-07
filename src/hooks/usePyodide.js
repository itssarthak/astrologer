import { useState, useEffect, useCallback } from 'react'
import {
  getPyodide, computeChart, computeTransit,
  computeYogasFallback, computeDoshasFallback,
  computeNumerology, computeSynastry,
} from '../lib/pyodide/index'

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
        if (resp.ok) return await resp.json()
      } catch {
        // fall through to Pyodide fallback
      }
    }
    const [yogas, doshas] = await Promise.all([
      computeYogasFallback(chartJson),
      computeDoshasFallback(chartJson),
    ])
    return { yogas_active: yogas, doshas }
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
