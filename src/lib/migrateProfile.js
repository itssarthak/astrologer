import { CHART_ENGINE_VERSION } from './version'

export function isProfileStale(profile) {
  return !!profile && profile.engineVersion !== CHART_ENGINE_VERSION
}

// Recompute chart/yogas/doshas/numerology from the profile's birth fields and return an
// updated profile stamped with the current engine version. `compute` is { computeChart,
// getYogasAndDoshas, computeNumerology }. Throws if birth fields are missing.
export async function recomputeProfile(profile, compute) {
  if (!profile?.dob || !profile?.time || profile.lat == null || profile.lon == null) {
    throw new Error('Profile is missing birth details; cannot recompute.')
  }
  const chart = await compute.computeChart(profile.name, profile.dob, profile.time, profile.lat, profile.lon, profile.timezone_offset, profile.place)
  const yd = await compute.getYogasAndDoshas(chart, profile)
  const numerology = await compute.computeNumerology(profile.name, profile.dob, profile.gender ?? null, profile.name_in_use ?? null)
  return {
    ...profile,
    chart,
    yogas: yd.yogas_active ?? [],
    doshas: yd.doshas ?? {},
    numerology,
    engineVersion: CHART_ENGINE_VERSION,
  }
}
