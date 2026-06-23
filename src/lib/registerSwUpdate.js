// Service-worker auto-update orchestrator. Imported ONLY by main.jsx so the `virtual:pwa-register`
// module never enters the test/React graph (the pure policy lives in ./swUpdate).
//
// Why this exists: with registerType 'prompt' the browser only re-checks sw.js on navigation or
// its ~24h timer, so a long-open PWA/tab sits on stale code. We poll `registration.update()` on a
// timer and on tab focus to DETECT new deploys promptly, then APPLY (skipWaiting + reload) only at
// an idle moment — tab hidden and nothing in flight — so the reload is invisible (see shouldApplyUpdate).
import { registerSW } from 'virtual:pwa-register'
import { shouldApplyUpdate } from './swUpdate'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000 // hourly

export function initServiceWorkerAutoUpdate() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  let needRefresh = false
  let registration = null

  // updateSW(true) tells the waiting worker to skipWaiting, then reloads the page on controllerchange.
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh = true
      maybeApply() // in case the tab is already backgrounded when the update lands
    },
    onRegisteredSW(_swUrl, r) {
      registration = r
      if (!r) return
      setInterval(() => { r.update().catch(() => {}) }, UPDATE_CHECK_INTERVAL_MS)
    },
  })

  function maybeApply() {
    if (shouldApplyUpdate({ needRefresh, hidden: document.visibilityState === 'hidden' })) {
      updateSW(true)
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      registration?.update().catch(() => {}) // returning to the tab: check for a fresh deploy
    } else {
      maybeApply() // leaving the tab: a safe moment to apply a pending update
    }
  })
}
