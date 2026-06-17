import { useState } from 'react'
import { useStorageEstimate } from '../hooks/useStorageEstimate'

const WARN_AT = 90      // show the flag at/above this percentage of the storage quota
const RESURFACE_STEP = 5 // after dismissal, re-show once usage climbs this many more points

// Small "storage almost full" flag for the Sidebar footer. Informs only — the tooltip points the
// user at clearing old chats. Dismissible for the session, but re-surfaces if usage keeps climbing.
export default function StorageFlag() {
  const { estimate } = useStorageEstimate()
  const [dismissedAt, setDismissedAt] = useState(null)

  if (!estimate || estimate.percent < WARN_AT) return null
  // Stay hidden after a dismissal until usage worsens past the next step.
  if (dismissedAt != null && estimate.percent < dismissedAt + RESURFACE_STEP) return null

  return (
    <div
      role="status"
      aria-live="polite"
      title="Your saved chats and profiles are filling up this device's storage. Clear old chats to free space."
      className="flex items-center gap-2 px-3 py-1.5 text-xs text-amber-200 bg-amber-500/10 rounded-xl"
    >
      <span aria-hidden="true">⚠</span>
      <span className="flex-1">Storage almost full · {estimate.percent}%</span>
      <button
        type="button"
        onClick={() => setDismissedAt(estimate.percent)}
        aria-label="Dismiss storage warning"
        className="text-amber-200/70 hover:text-amber-100 leading-none"
      >
        ×
      </button>
    </div>
  )
}
