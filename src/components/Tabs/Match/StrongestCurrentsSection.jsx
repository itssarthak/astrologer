// src/components/Tabs/Match/StrongestCurrentsSection.jsx
import { FactorRow } from './matchPrimitives'

export default function StrongestCurrentsSection({ synastryData }) {
  const sup = synastryData?.top_supportive ?? []
  const chal = synastryData?.top_challenging ?? []
  if (sup.length === 0 && chal.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-text">Strongest currents</span>
      {sup.map((s, i) => <FactorRow key={`s${i}`} text={s} effect="supportive" />)}
      {chal.map((s, i) => <FactorRow key={`c${i}`} text={s} effect="challenging" />)}
    </div>
  )
}
