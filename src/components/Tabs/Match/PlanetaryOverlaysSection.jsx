// src/components/Tabs/Match/PlanetaryOverlaysSection.jsx
import { LEAN_BADGE, OverlaySection } from './matchPrimitives'

export default function PlanetaryOverlaysSection({ synastryData, summary, activeProfile, partnerProfile }) {
  if (!summary) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text">Planetary compatibility</span>
        <span className={`text-xs capitalize px-2 py-0.5 rounded-full font-medium ${LEAN_BADGE[summary.lean] ?? LEAN_BADGE.mixed}`}>
          {summary.lean}
        </span>
      </div>
      <div className="flex gap-3 text-xs">
        <span className="text-green-700">● {summary.supportive} supportive</span>
        <span className="text-red-600">● {summary.challenging} challenging</span>
        <span className="text-muted">● {summary.neutral} neutral</span>
      </div>
      {summary.lean === 'challenging' && (
        <p className="text-xs text-text-2">
          {synastryData.challenging_until
            ? <>Heightened by the current periods — eases after <span className="font-medium">{synastryData.challenging_until}</span>.</>
            : 'A steady feature of the match rather than a passing phase — one to manage.'}
        </p>
      )}
      <OverlaySection title={`${activeProfile.name} → ${partnerProfile?.name}`} overlays={synastryData.a_planets_in_b_houses ?? []} />
      <OverlaySection title={`${partnerProfile?.name} → ${activeProfile.name}`} overlays={synastryData.b_planets_in_a_houses ?? []} />
    </div>
  )
}
