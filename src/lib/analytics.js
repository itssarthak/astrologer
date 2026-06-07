// GA4 via gtag. Only loads when VITE_GA_MEASUREMENT_ID is set.
// Birth data, chart data, and API keys are never sent.

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID

export function initAnalytics() {
  if (!GA_ID) return
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)
  window.dataLayer = window.dataLayer || []
  window.gtag = function () { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, { send_page_view: false })
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
