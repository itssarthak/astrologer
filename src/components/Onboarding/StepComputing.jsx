import { useEffect, useState, useContext, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { PyodideContext } from '../../contexts/PyodideContext'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import LoadingSpinner from '../shared/LoadingSpinner'
import { trackEvent } from '../../lib/analytics'

const STEPS = [
  { key: 'pyodide', label: 'Loading Python engine', doneLabel: 'Python engine ready ✓' },
  { key: 'chart', label: 'Reading the stars', doneLabel: 'Birth chart computed ✓' },
  { key: 'yogas', label: 'Checking yogas & doshas', doneLabel: 'Yogas & doshas ✓' },
  { key: 'numerology', label: 'Crunching your numbers', doneLabel: 'Numerology profile ✓' },
]

export default function StepComputing({ birthData }) {
  const navigate = useNavigate()
  const { isReady, status, message, computeChart, computeNumerology, getYogasAndDoshas } = useContext(PyodideContext)
  const { addProfile } = useContext(ProfilesContext)
  const [completed, setCompleted] = useState([])
  const [error, setError] = useState(null)
  const isReadyRef = useRef(isReady)
  const statusRef = useRef(status)
  const startedRef = useRef(false)
  isReadyRef.current = isReady
  statusRef.current = status

  useEffect(() => {
    if (!birthData) return
    // Guard against StrictMode's double-invoked effect (and any remount) so we compute
    // and persist the profile exactly once — otherwise duplicate profiles get created.
    if (startedRef.current) return
    startedRef.current = true
    run()
  }, [])

  const run = async () => {
    try {
      await waitForPyodide()
      setCompleted(c => [...c, 'pyodide'])

      const chartJson = await computeChart(birthData.name, birthData.dob, birthData.time, birthData.lat, birthData.lon, birthData.timezone_offset, birthData.place)
      setCompleted(c => [...c, 'chart'])

      const yogasDoshas = await getYogasAndDoshas(chartJson, birthData)
      setCompleted(c => [...c, 'yogas'])

      const numerology = await computeNumerology(birthData.name, birthData.dob)
      setCompleted(c => [...c, 'numerology'])

      const profile = {
        id: uuidv4(),
        ...birthData,
        chart: chartJson,
        yogas: yogasDoshas.yogas_active ?? [],
        doshas: yogasDoshas.doshas ?? {},
        numerology,
        createdAt: new Date().toISOString(),
      }
      addProfile(profile)
      trackEvent('chart_computed') // no birth data — just that a chart was created
      navigate('/app')
    } catch (err) {
      setError(err.message)
      trackEvent('compute_error')
    }
  }

  const waitForPyodide = () => new Promise((resolve, reject) => {
    if (isReadyRef.current) { resolve(); return }
    if (statusRef.current === 'error') { reject(new Error('Python engine failed to load. Check your internet connection and reload.')); return }
    const interval = setInterval(() => {
      if (isReadyRef.current) { clearInterval(interval); resolve() }
      else if (statusRef.current === 'error') { clearInterval(interval); reject(new Error('Python engine failed to load. Check your internet connection and reload.')) }
    }, 200)
  })

  if (error) {
    return (
      <div className="text-center flex flex-col gap-4">
        <div className="text-4xl">⚠️</div>
        <p className="text-sm text-text font-semibold">Something went wrong</p>
        <p className="text-xs text-muted">{error}</p>
        <button onClick={() => window.location.reload()}
          className="mx-auto px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors">
          Reload and try again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 items-center">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text">Computing your chart</h2>
        <p className="text-xs text-muted mt-1">First load downloads the star catalogue (17MB). Cached after — subsequent loads are instant.</p>
      </div>

      <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${(completed.length / STEPS.length) * 100}%` }} />
      </div>

      <div className="w-full flex flex-col gap-2">
        {STEPS.map(step => {
          const done = completed.includes(step.key)
          const active = !done && completed.length === STEPS.indexOf(step)
          return (
            <div key={step.key} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-opacity ${done ? 'border-border bg-white' : active ? 'border-primary/30 bg-surface' : 'border-border bg-surface opacity-40'}`}>
              <div className="mt-0.5 flex-shrink-0">
                {done ? <span className="text-primary text-sm">✓</span> : active ? <LoadingSpinner size="sm" /> : <span className="text-muted text-sm">○</span>}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm text-text">{done ? step.doneLabel : step.label}</span>
                {active && message && (
                  <span className="text-xs text-muted truncate">{message}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
