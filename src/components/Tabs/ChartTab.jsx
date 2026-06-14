// src/components/Tabs/ChartTab.jsx
import { useState, useContext } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { useChat } from '../../hooks/useChat'
import { useChatThread } from '../../hooks/useChatThread'
import { formatChartContext, activeMahadasha } from '../../lib/prompts/formatters'
import { useReportBusy } from '../../contexts/BusyContext'
import KundliChart from '../Kundli/KundliChart'
import ChatMessages from '../Chat/ChatMessages'
import ChatInput from '../Chat/ChatInput'
import ChatToolbar from '../shared/ChatToolbar'

// What each varga is traditionally read for — used only to label whatever the engine
// actually computed. Unknown ids fall back to their bare "Dn" label, so the UI always
// mirrors the data: only the divisional charts present on the chart are shown.
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

export default function ChartTab() {
  const { activeProfile } = useContext(ProfilesContext)
  const { send, streaming, error, stop } = useChat(activeProfile, 'chart')
  useReportBusy(streaming)
  const [varga, setVarga] = useState('d1')
  const { messages, streamingContent, reload, clearChat, submit } = useChatThread(activeProfile, 'chart')

  const chart = activeProfile?.chart
  const yogas = activeProfile?.yogas ?? []
  const doshas = activeProfile?.doshas ?? {}
  // Build the varga list straight from what was computed — D1 plus every divisional present,
  // ordered by divisional number. The UI thus reflects exactly what the engine produced.
  const dvKeys = Object.keys(chart?.divisionalCharts ?? {})
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  const vargas = ['d1', ...dvKeys].map(id => ({ id, label: id.toUpperCase(), name: VARGA_NAMES[id] ?? id.toUpperCase() }))
  const activeVarga = vargas.find(v => v.id === varga) ?? vargas[0]
  const vargaChart = activeVarga.id === 'd1' ? chart : chart?.divisionalCharts?.[activeVarga.id]

  const handleSend = userMessage =>
    submit(userMessage, ({ onChunk }) =>
      send({ userMessage, extraContext: formatChartContext(chart, yogas, doshas), onChunk }))

  if (!activeProfile?.chart) return (
    <div className="flex-1 flex items-center justify-center text-muted text-sm">Chart not yet computed</div>
  )

  return (
    <div className="flex flex-col h-full">
      <ChatToolbar title="Chart" onRefresh={reload} onClear={clearChat}
        refreshDisabled={streaming} clearDisabled={streaming || messages.length === 0} />
      <div className="p-4 border-b border-border overflow-y-auto flex-shrink-0 max-h-[60%]">
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

      <ChatMessages messages={messages} streaming={streaming} streamingContent={streamingContent} />
      {error && <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-t border-red-100">{error}</p>}
      <ChatInput onSend={handleSend} busy={streaming} onStop={stop} placeholder="Ask about your chart..." />
    </div>
  )
}
