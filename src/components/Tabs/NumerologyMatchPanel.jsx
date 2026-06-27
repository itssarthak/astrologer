// src/components/Tabs/NumerologyMatchPanel.jsx
// Indicative (non-classical) numerology compatibility — rendered SEPARATELY from Guna Milan
// and never blended into the 36-point score.
import LoShuGrid from './LoShuGrid'
import CombinedLoShuGrid from './CombinedLoShuGrid'

const DIMS = [
  ['core', 'Core numbers'],
  ['driver_conductor', 'Driver–Conductor'],
  ['grid', 'Grid complementarity'],
]

export default function NumerologyMatchPanel({ match }) {
  if (!match) return null
  const fill = arr => (arr && arr.length ? arr.join(', ') : '—')
  return (
    <div className="border-t border-border pt-3 flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-text">Numerology Compatibility</span>
        <span className="text-xs text-muted">{match.indicative_score}/10 · {match.summary_rating}</span>
      </div>
      <span className="text-[10px] uppercase tracking-wide text-muted bg-surface border border-border rounded px-1.5 py-0.5 self-start">
        {match.indicative_label}
      </span>
      <div className="grid grid-cols-1 gap-0.5 mt-1">
        {DIMS.map(([key, label]) => (
          <div key={key} className="flex justify-between text-xs text-muted">
            <span>{label}</span>
            <span>{match[key].rating} ({match[key].score}/10)</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted mt-1">
        {match.between[1]} supplies {fill(match.grid.a_missing_filled_by_b)} · {match.between[0]} supplies {fill(match.grid.b_missing_filled_by_a)} · shared strengths {fill(match.grid.shared_strengths)}
      </p>
      {match.grid.a_grid && match.grid.b_grid && (
        <div className="flex flex-wrap gap-x-6 gap-y-3 mt-1">
          {[[match.between[0], match.grid.a_grid], [match.between[1], match.grid.b_grid]].map(([name, grid]) => (
            <div key={name} className="flex flex-col">
              <span className="text-xs font-semibold text-text-2 truncate">{name}</span>
              <LoShuGrid grid={grid} />
            </div>
          ))}
        </div>
      )}
      <CombinedLoShuGrid aGrid={match.grid.a_grid} bGrid={match.grid.b_grid} combined={match.combined} names={match.between} />
    </div>
  )
}
