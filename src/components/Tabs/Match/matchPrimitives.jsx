// src/components/Tabs/Match/matchPrimitives.jsx
// Shared display helpers + class maps for the Match result sections.
export const EFFECT_TEXT = { supportive: 'text-green-700', challenging: 'text-red-600', neutral: 'text-muted' }
export const EFFECT_DOT = { supportive: 'bg-green-600', challenging: 'bg-red-500', neutral: 'bg-border-strong' }
export const LEAN_BADGE = {
  harmonious: 'bg-green-100 text-green-700',
  challenging: 'bg-red-100 text-red-600',
  mixed: 'bg-surface-2 text-text-2',
}

// Per-person guna attributes shown under the Guna Milan score, in koota order.
export const GUNA_ATTRS = [
  ['varna', 'Varna'], ['vashya', 'Vashya'], ['yoni', 'Yoni'],
  ['sign_lord', 'Sign lord'], ['gana', 'Gana'], ['nadi', 'Nadi'],
  ['moon_sign', 'Moon'], ['nakshatra', 'Nakshatra'],
]

export function FactorRow({ text, effect }) {
  return (
    <div className="flex items-start gap-2 text-xs leading-snug">
      <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${EFFECT_DOT[effect]}`} />
      <span className="text-text-2">{text}</span>
    </div>
  )
}

export function OverlayRow({ o }) {
  return (
    <div className="flex items-start gap-2 text-xs leading-snug">
      <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${EFFECT_DOT[o.effect]}`} />
      <span className="text-text-2">
        <span className="font-medium">{o.planet}</span> → their H{o.falls_in_house} ({o.house_meaning})
        <span className={`ml-1 ${EFFECT_TEXT[o.effect]}`}>· {o.effect}</span>
      </span>
    </div>
  )
}

export function OverlaySection({ title, overlays }) {
  const notable = overlays.filter(o => o.effect !== 'neutral')
  const shown = notable.slice(0, 5)
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-text-2">{title}</p>
      {shown.length
        ? shown.map((o, i) => <OverlayRow key={i} o={o} />)
        : <p className="text-xs text-muted">Mostly neutral — no strong pulls either way.</p>}
      {notable.length > shown.length && <p className="text-xs text-muted">+{notable.length - shown.length} more</p>}
    </div>
  )
}
