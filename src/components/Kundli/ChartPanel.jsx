// src/components/Kundli/ChartPanel.jsx
import { useState } from 'react'
import { activeMahadasha } from '../../lib/prompts/formatters'
import KundliChart from './KundliChart'

// What each varga is traditionally read for — labels whatever the engine actually computed.
// Unknown ids fall back to their bare "Dn" label, so the UI mirrors the data exactly.
const VARGA_NAMES = {
  d1: 'Rasi — overall life',
  d2: 'Hora — wealth',
  d3: 'Drekkana — siblings & courage',
  d4: 'Chaturthamsa — property & fortune',
  d7: 'Saptamsa — children',
  d9: 'Navamsa — marriage & dharma',
  d10: 'Dasamsa — career',
  d12: 'Dwadasamsa — parents & lineage',
  d16: 'Shodasamsa — vehicles & comforts',
  d20: 'Vimsamsa — spiritual life',
  d24: 'Chaturvimsamsa — education',
  d27: 'Bhamsa — strengths & weaknesses',
  d30: 'Trimsamsa — adversity & health',
  d40: 'Khavedamsa — maternal legacy',
  d45: 'Akshavedamsa — paternal legacy',
  d60: 'Shashtiamsa — fine detail & past karma',
}

export default function ChartPanel({ profile }) {
  const [varga, setVarga] = useState('d1')
  const chart = profile?.chart
  const yogas = profile?.yogas ?? []
  const doshas = profile?.doshas ?? {}

  // Build the varga list straight from what was computed — D1 plus every divisional present.
  const dvKeys = Object.keys(chart?.divisionalCharts ?? {})
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  const vargas = ['d1', ...dvKeys].map(id => ({ id, label: id.toUpperCase(), name: VARGA_NAMES[id] ?? id.toUpperCase() }))
  const activeVarga = vargas.find(v => v.id === varga) ?? vargas[0]
  const vargaChart = activeVarga.id === 'd1' ? chart : chart?.divisionalCharts?.[activeVarga.id]

  if (!chart) return null

  return (
    <div className="p-4 overflow-y-auto">
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
        {vargas.map(v => (
          <button key={v.id} onClick={() => setVarga(v.id)} title={v.name}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
              activeVarga.id === v.id ? 'bg-primary text-white' : 'bg-surface border border-border text-muted hover:border-border-strong'
            }`}>
            {v.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted text-center mb-2">{activeVarga.name}</p>

      {(vargaChart?.d1Chart?.houses || vargaChart?.houses)
        ? <KundliChart chart={vargaChart} />
        : <p className="text-sm text-muted text-center py-4">{activeVarga.label} chart not available</p>}

      <div className="mt-4 flex flex-col gap-2 text-sm">
        {(() => {
          const dasha = activeMahadasha(chart)
          return dasha ? (
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-muted text-xs uppercase tracking-wide font-semibold">Dasha:</span>
              <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-border text-text-2 text-xs">
                {dasha.mdLord}{dasha.adLord ? ` › ${dasha.adLord}` : ''}
              </span>
            </div>
          ) : null
        })()}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-muted text-xs uppercase tracking-wide font-semibold">Yogas:</span>
          {yogas.length ? yogas.slice(0, 5).map((y, i) => (
            <span key={y.name ?? y ?? i} className="px-2 py-0.5 rounded-full bg-primary-light text-primary text-xs">{y.name ?? y}</span>
          )) : <span className="text-muted text-xs">None detected</span>}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-muted text-xs uppercase tracking-wide font-semibold">Doshas:</span>
          {Object.entries(doshas).filter(([, v]) => v?.present).map(([k]) => (
            <span key={k} className="px-2 py-0.5 rounded-full bg-surface-2 border border-border text-text-2 text-xs capitalize">{k}</span>
          ))}
          {!Object.values(doshas).some(v => v?.present) && <span className="text-muted text-xs">None</span>}
        </div>
      </div>
    </div>
  )
}
