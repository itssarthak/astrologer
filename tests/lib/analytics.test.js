import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// trackEvent reads GA_ID from import.meta.env at module load, so each test stubs the env and
// re-imports the module fresh.
describe('analytics trackEvent', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllEnvs())

  it('strips personal data fields before sending to gtag', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST')
    const calls = []
    window.gtag = (...args) => calls.push(args)
    const { trackEvent } = await import('../../src/lib/analytics')

    trackEvent('chart_view', {
      tab: 'chart', provider: 'claude',
      name: 'Jane', dob: '1990-01-01', time: '12:00', lat: 1, lon: 2,
      key: 'sk-secret', chart: { big: true }, numerology: { life_path: 7 },
    })

    expect(calls).toHaveLength(1)
    const [, eventName, params] = calls[0]
    expect(eventName).toBe('chart_view')
    // Only the safe coarse fields survive.
    expect(params).toEqual({ tab: 'chart', provider: 'claude' })
    for (const leaked of ['name', 'dob', 'time', 'lat', 'lon', 'key', 'chart', 'numerology']) {
      expect(params).not.toHaveProperty(leaked)
    }
  })

  it('no-ops when no measurement id is configured', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', '')
    window.gtag = vi.fn()
    const { trackEvent } = await import('../../src/lib/analytics')
    trackEvent('chart_view', { tab: 'chart' })
    expect(window.gtag).not.toHaveBeenCalled()
  })
})

describe('analytics device identity', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('configures gtag with a persistent device id as client_id and user_id', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST')
    // gtag pushes its arguments into window.dataLayer — inspect that.
    window.dataLayer = []
    const { initAnalytics } = await import('../../src/lib/analytics')
    initAnalytics()

    const configCall = window.dataLayer.find((args) => args[0] === 'config')
    expect(configCall).toBeTruthy()
    const [, id, cfg] = configCall
    expect(id).toBe('G-TEST')
    expect(cfg.send_page_view).toBe(false)
    expect(typeof cfg.client_id).toBe('string')
    expect(cfg.client_id.length).toBeGreaterThan(0)
    expect(cfg.user_id).toBe(cfg.client_id)
    // The id is persisted and reused across loads.
    expect(localStorage.getItem('astro:deviceId')).toBe(cfg.client_id)
  })

  it('reuses the same device id across separate loads', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST')
    const { initAnalytics } = await import('../../src/lib/analytics')
    initAnalytics()
    const first = localStorage.getItem('astro:deviceId')

    vi.resetModules()
    const { initAnalytics: initAgain } = await import('../../src/lib/analytics')
    initAgain()
    const second = localStorage.getItem('astro:deviceId')
    expect(first).toBe(second)
  })
})
