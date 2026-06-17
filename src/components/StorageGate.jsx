import { useState, useEffect } from 'react'
import { hydrate } from '../lib/storage/db'
import LoadingSpinner from './shared/LoadingSpinner'

// Loads the persisted storage cache (profiles / api key / today) out of IndexedDB before rendering
// anything that reads it synchronously. Without this gate, route guards would read an empty cache
// during the async load and briefly bounce an existing user to onboarding (the "onboarding flash").
export default function StorageGate({ children }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    // hydrate() resolves even when IndexedDB is unavailable (into degraded localStorage mode),
    // so the gate never hangs.
    hydrate().finally(() => { if (mounted) setReady(true) })
    return () => { mounted = false }
  }, [])

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  return children
}
