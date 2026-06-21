// src/components/Tabs/LoShuGrid.jsx
// Renders the populated Lo Shu magic square (4-9-2 / 3-5-7 / 8-1-6). Each cell shows its
// digit repeated by how many times it was placed; empty cells render a muted dot.
const SQUARE = [4, 9, 2, 3, 5, 7, 8, 1, 6]

export default function LoShuGrid({ grid }) {
  if (!grid) return null
  const count = n => grid.counts?.[String(n)] ?? 0
  const join = arr => (arr && arr.length ? arr.join(', ') : '—')

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Lo Shu Grid</p>
      <div className="grid grid-cols-3 gap-1 w-40">
        {SQUARE.map(n => {
          const c = count(n)
          return (
            <div key={n} className="aspect-square bg-surface border border-border rounded-lg flex items-center justify-center text-sm font-semibold text-primary">
              {c > 0 ? String(n).repeat(c) : <span className="text-muted">·</span>}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex flex-col gap-0.5 text-xs text-muted">
        <span>Missing: {join(grid.missing)}</span>
        <span>Repeated (strong): {join(grid.repeated)}</span>
        <span>{grid.kua != null ? `Kua: ${grid.kua}` : (grid.kua_note ?? 'Kua: —')}</span>
        <span>Arrows of strength: {join(grid.arrows_strength)}</span>
        <span>Arrows of weakness: {join(grid.arrows_weakness)}</span>
      </div>
    </div>
  )
}
