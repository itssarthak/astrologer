// src/components/Tabs/ChartTab.jsx
import { useState, useContext } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { useLLM } from '../../hooks/useLLM'
import { getHistory, clearHistory } from '../../lib/storage/chat'
import { formatChartContext, activeMahadasha } from '../../lib/prompts/formatters'
import KundliChart from '../Kundli/KundliChart'
import ChatMessages from '../Chat/ChatMessages'
import ChatInput from '../Chat/ChatInput'
import ChatToolbar from '../shared/ChatToolbar'

const SUB_TABS = ['D1', 'D9']

export default function ChartTab() {
  const { activeProfile } = useContext(ProfilesContext)
  const { send, streaming, error } = useLLM(activeProfile, 'chart')
  const [subTab, setSubTab] = useState('D1')
  const [messages, setMessages] = useState(() =>
    activeProfile ? getHistory(activeProfile.id, 'chart') : []
  )
  const [streamingContent, setStreamingContent] = useState('')

  const chart = activeProfile?.chart
  const yogas = activeProfile?.yogas ?? []
  const doshas = activeProfile?.doshas ?? {}
  const d9Chart = chart?.divisionalCharts?.d9 ?? null

  const handleSend = async userMessage => {
    const chartJson = JSON.stringify(chart)
    const extraContext = formatChartContext(chartJson, yogas, doshas)
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setStreamingContent('')
    try {
      await send({ userMessage, extraContext, onChunk: chunk => setStreamingContent(prev => prev + chunk) })
      setMessages(getHistory(activeProfile.id, 'chart'))
      setStreamingContent('')
    } catch {
      setStreamingContent('')
    }
  }

  const reload = () => setMessages(getHistory(activeProfile.id, 'chart'))
  const clearChat = () => { clearHistory(activeProfile.id, 'chart'); setMessages([]) }

  if (!activeProfile?.chart) return (
    <div className="flex-1 flex items-center justify-center text-muted text-sm">Chart not yet computed</div>
  )

  return (
    <div className="flex flex-col h-full">
      <ChatToolbar title="Chart" onRefresh={reload} onClear={clearChat}
        refreshDisabled={streaming} clearDisabled={streaming || messages.length === 0} />
      <div className="p-4 border-b border-border overflow-y-auto flex-shrink-0 max-h-[60%]">
        <div className="flex gap-2 mb-4">
          {SUB_TABS.map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                subTab === t ? 'bg-primary text-white' : 'bg-surface border border-border text-muted hover:border-border-strong'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {subTab === 'D1' && <KundliChart chart={chart} />}
        {subTab === 'D9' && (d9Chart
          ? <KundliChart chart={d9Chart} />
          : <p className="text-sm text-muted text-center py-4">D9 chart not available</p>
        )}

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
              <span key={i} className="px-2 py-0.5 rounded-full bg-primary-light text-primary text-xs">{y.name ?? y}</span>
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
      <ChatInput onSend={handleSend} disabled={streaming} placeholder="Ask about your chart..." />
    </div>
  )
}
