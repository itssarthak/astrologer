// src/components/Tabs/CombinedLoShuGrid.jsx
// Merged Lo Shu grid for two people: each cell shows both partners' digit copies
// colour-coded per person, plus the lines newly completed by the UNION (full together
// but not held by either alone). Completed diagonals carry the popular-numerology
// "Raj Yog" tag. Indicative, non-classical — the meanings are the sourced planet-ruler
// summaries returned by the engine.
const SQUARE = [4, 9, 2, 3, 5, 7, 8, 1, 6]
const A_CLASS = 'text-primary'
const B_CLASS = 'text-rose-500'

export default function CombinedLoShuGrid({ aGrid, bGrid, combined, names }) {
  if (!combined || !aGrid || !bGrid) return null
  const [nameA, nameB] = names
  const ca = aGrid.counts ?? {}
  const cb = bGrid.counts ?? {}
  const who = src => (src === 'a' ? nameA : src === 'b' ? nameB : 'both')
  const lines = combined.completed_lines ?? []

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Combined grid</p>
        <span className="text-[11px] text-muted">Raj Yog: {combined.has_raj_yog ? 'yes' : 'none'}</span>
      </div>
      <div className="flex items-center gap-3 mt-1 mb-2 text-[11px]">
        <span className={`flex items-center gap-1 ${A_CLASS}`}><span className="w-2 h-2 rounded-full bg-current inline-block" />{nameA}</span>
        <span className={`flex items-center gap-1 ${B_CLASS}`}><span className="w-2 h-2 rounded-full bg-current inline-block" />{nameB}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 w-40">
        {SQUARE.map(n => {
          const a = ca[String(n)] ?? 0
          const b = cb[String(n)] ?? 0
          return (
            <div key={n} className="aspect-square bg-surface border border-border rounded-lg flex items-center justify-center gap-0.5 text-sm font-semibold">
              {a === 0 && b === 0
                ? <span className="text-muted">·</span>
                : (
                  <>
                    {a > 0 && <span className={A_CLASS}>{String(n).repeat(a)}</span>}
                    {b > 0 && <span className={B_CLASS}>{String(n).repeat(b)}</span>}
                  </>
                )}
            </div>
          )
        })}
      </div>
      {lines.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold text-text-2">Completed together</p>
          {lines.map(line => (
            <div key={line.name} className="text-[11px] text-muted">
              <span className="text-text-2">{line.name}</span>
              {line.raj_yog && (
                <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">Raj Yog</span>
              )}
              <span> — {line.meaning}</span>
              <div className="text-muted">{line.from.map(f => `${f.number} from ${who(f.source)}`).join(' · ')}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted">No new planes or lines completed by the pairing.</p>
      )}
    </div>
  )
}
