// GA4 via gtag. Only loads when VITE_GA_MEASUREMENT_ID is set.
// Birth data, chart data, and API keys are never sent.

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID
const DEVICE_ID_KEY = 'astro:deviceId'

// Stable, app-owned anonymous device id. GA4's default identity is a JS-written `_ga` cookie,
// which browsers clamp hard (Safari/iOS ITP caps document.cookie cookies to ~7 days, incognito
// and cookie-blocking start fresh every visit) — so returning devices get counted as brand-new
// users. We generate one random id, persist it in localStorage (survives ITP's cookie cap better
// than a JS cookie), and pass it to gtag as both client_id and user_id so repeat sessions on the
// same device collapse into one user. It's random and anonymous — no birth/personal data. Note:
// this is same-device only; without login it can't stitch one person across devices/browsers.
function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    // localStorage unavailable (private mode / blocked) — fall back to gtag's cookie behaviour.
    return null
  }
}

export function initAnalytics() {
  if (!GA_ID) return
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)
  window.dataLayer = window.dataLayer || []
  window.gtag = function () { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  const deviceId = getDeviceId()
  const config = { send_page_view: false }
  if (deviceId) {
    config.client_id = deviceId
    config.user_id = deviceId
  }
  window.gtag('config', GA_ID, config)
}

export function trackPageView(page) {
  if (!GA_ID || !window.gtag) return
  window.gtag('event', 'page_view', { page_title: page, page_path: `/${page}` })
}

export function trackEvent(name, params = {}) {
  if (!GA_ID || !window.gtag) return
  // Safety: strip any personal data fields before sending
  const safe = { ...params }
  for (const key of ['name', 'dob', 'time', 'lat', 'lon', 'key', 'chart', 'numerology']) {
    delete safe[key]
  }
  window.gtag('event', name, safe)
}
