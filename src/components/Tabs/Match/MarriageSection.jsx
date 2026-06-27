// src/components/Tabs/Match/MarriageSection.jsx
export default function MarriageSection({ synastryData, activeProfile, partnerProfile }) {
  if (!synastryData?.marriage_factors) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-text">Marriage significators</span>
      <p className="text-xs text-text-2">
        <span className="font-medium">{activeProfile.name}:</span> {synastryData.marriage_factors.a?.summary ?? '—'}
      </p>
      <p className="text-xs text-text-2">
        <span className="font-medium">{partnerProfile?.name}:</span> {synastryData.marriage_factors.b?.summary ?? '—'}
      </p>
      {synastryData.dasha_overlap?.note && (
        <p className="text-xs text-muted mt-1">Current period: {synastryData.dasha_overlap.note}</p>
      )}
    </div>
  )
}
