// src/components/Tabs/Match/GunaMilanSection.jsx
import { GUNA_ATTRS } from './matchPrimitives'

export default function GunaMilanSection({ guna, activeProfile, partnerProfile }) {
  if (!guna) return null
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-text">Guna Milan</span>
        <span className="text-2xl font-bold text-primary">
          {guna.total ?? '—'}<span className="text-sm text-muted font-normal">/36</span>
          <span className="ml-2 text-xs text-muted font-medium">{guna.verdict}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2">
        {Object.entries(guna.breakdown ?? {}).map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs text-muted">
            <span className="capitalize">{k.replace(/_/g, ' ')}</span>
            <span className="font-medium text-text-2">{v.score}/{v.max}</span>
          </div>
        ))}
      </div>

      {guna.profiles && (
        <div className="grid grid-cols-2 gap-x-4 mt-3 pt-2 border-t border-border/60">
          {[[activeProfile?.name, guna.profiles.a], [partnerProfile?.name, guna.profiles.b]].map(([who, p], i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-text-2 truncate">{who}</span>
              {p && GUNA_ATTRS.map(([key, label]) => (
                <div key={key} className="flex justify-between text-[11px] text-muted">
                  <span>{label}</span>
                  <span className="text-text-2">{p[key] ?? '—'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
