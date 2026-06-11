// Reports a GA4 page_view on every route change. No-op unless VITE_GA_MEASUREMENT_ID is
// set (the analytics helpers guard on it), and it never sends any birth/chart/key data.
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '../lib/analytics'

export default function RouteTracker() {
  const { pathname } = useLocation()

  useEffect(() => {
    trackPageView(pathname.replace(/^\//, '') || 'home')
  }, [pathname])

  return null
}
