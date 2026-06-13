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
