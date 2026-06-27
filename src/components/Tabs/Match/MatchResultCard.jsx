// src/components/Tabs/Match/MatchResultCard.jsx
import { useState, useEffect } from 'react'
import Markdown from '../../Chat/Markdown'
import NumerologyMatchPanel from '../NumerologyMatchPanel'
import GunaMilanSection from './GunaMilanSection'
import StrongestCurrentsSection from './StrongestCurrentsSection'
import PlanetaryOverlaysSection from './PlanetaryOverlaysSection'
import MarriageSection from './MarriageSection'

const TABS = ['Compatibility', 'Planets', 'Numerology', 'Read']

export default function MatchResultCard({ synastryData, numerologyMatch, activeProfile, partnerProfile, read, generatingRead }) {
  const [active, setActive] = useState('Compatibility')

  // A fresh compute (new synastryData identity) snaps back to the headline tab.
  useEffect(() => { setActive('Compatibility') }, [synastryData])

  if (!synastryData) return null
  const guna = synastryData.guna_milan
  const summary = synastryData.overlay_summary

  return (
    <div className="bg-surface border border-border rounded-xl p-3 flex flex-col gap-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setActive(t)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors flex items-center gap-1.5 ${
              active === t ? 'bg-primary text-white' : 'bg-surface border border-border text-muted hover:border-border-strong'
            }`}>
            {t}
            {t === 'Read' && generatingRead && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
          </button>
        ))}
      </div>

      {active === 'Compatibility' && (
        <div className="flex flex-col gap-3">
          <GunaMilanSection guna={guna} activeProfile={activeProfile} partnerProfile={partnerProfile} />
          <StrongestCurrentsSection synastryData={synastryData} />
        </div>
      )}
      {active === 'Planets' && (
        <div className="flex flex-col gap-3">
          <PlanetaryOverlaysSection synastryData={synastryData} summary={summary} activeProfile={activeProfile} partnerProfile={partnerProfile} />
          <MarriageSection synastryData={synastryData} activeProfile={activeProfile} partnerProfile={partnerProfile} />
        </div>
      )}
      {active === 'Numerology' && <NumerologyMatchPanel match={numerologyMatch} />}
      {active === 'Read' && (
        <div className="text-sm text-text leading-relaxed">
          {read ? <Markdown>{read}</Markdown> : <p className="text-xs text-muted">{generatingRead ? '...' : 'No compatibility read yet.'}</p>}
        </div>
      )}
    </div>
  )
}
