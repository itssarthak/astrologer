// Bump when the compute engine changes in a way that should re-migrate saved profiles
// (new yogas/doshas, dignity normalization, etc.). Profiles stamped with an older value
// are silently recomputed on next load.
export const CHART_ENGINE_VERSION = 2
