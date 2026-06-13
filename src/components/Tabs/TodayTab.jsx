// src/components/Tabs/TodayTab.jsx
import { useState, useContext, useEffect, useRef } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { PyodideContext } from '../../contexts/PyodideContext'
import { useLLM } from '../../hooks/useLLM'
import { useChatThread } from '../../hooks/useChatThread'
import { getTodayTransit, saveTodayTransit } from '../../lib/storage/today'
import { useReportBusy } from '../../contexts/BusyContext'
import { formatTransitContext } from '../../lib/prompts/formatters'
import ChatMessages from '../Chat/ChatMessages'
import ChatInput from '../Chat/ChatInput'
import ChatToolbar from '../shared/ChatToolbar'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function TodayTab() {
  const { activeProfile } = useContext(ProfilesContext)
  const { isReady, computeTransit } = useContext(PyodideContext)
  const { send, streaming, error, stop } = useLLM(activeProfile, 'today')
  const [transitData, setTransitData] = useState(null)
  const [computing, setComputing] = useState(false)
  const [transitError, setTransitError] = useState(null)
  const [llmRead, setLlmRead] = useState('')
  const [generating, setGenerating] = useState(false)
  // Today drives its own per-day compute effect (below), so it opts out of the hook's
  // profile-change reset and reloads messages itself.
  const { messages, streamingContent, reload, clearChat, submit } =
    useChatThread(activeProfile, 'today', { resetOnProfileChange: false })
  const computedForRef = useRef(null)
  useReportBusy(streaming || generating || computing)

  useEffect(() => {
    if (!activeProfile || !isReady) return
    // The Today tab unmounts/remounts on every tab switch, so the in-mount ref alone isn't
    // enough — also reuse today's cached transit so we compute (and call the LLM) at most
    // once per calendar day per profile. The ref still guards StrictMode's double-invoke.
    if (computedForRef.current === activeProfile.id) return
    computedForRef.current = activeProfile.id

    const cached = getTodayTransit(activeProfile.id)
    if (cached) {
      // Already computed today — show the saved transit + existing read, no recompute.
      setTransitData(cached)
      reload()
      return
    }
    computeToday()
  }, [activeProfile?.id, isReady])

  const computeToday = async () => {
    if (!activeProfile) return
    setComputing(true)
    setTransitError(null)
    try {
      // computeTransit needs the natal lagna sign (house 1's sign), not the whole chart.
      const lagnaSign = activeProfile.chart?.d1Chart?.houses?.find(h => h.number === 1)?.sign
      if (!lagnaSign) throw new Error('Could not read your ascendant from the saved chart.')
      const transit = await computeTransit(lagnaSign, activeProfile.lat, activeProfile.lon, activeProfile.timezone_offset)
      setTransitData(transit)
      saveTodayTransit(activeProfile.id, transit)
      await generateRead(transit)
    } catch (err) {
      setTransitError(err.message)
    } finally {
      setComputing(false)
    }
  }

  // Force a fresh transit + read for today (overwrites the cache and appends a new read).
  const refreshToday = () => {
    if (!activeProfile || !isReady || computing || generating) return
    computeToday()
  }

  const generateRead = async transit => {
    setGenerating(true)
    setLlmRead('')
    try {
      const extraContext = formatTransitContext(transit, activeProfile.chart)
      await send({
        userMessage: 'Give me my transit read for today.',
        extraContext,
        onChunk: chunk => setLlmRead(prev => prev + chunk),
      })
      reload()
      setLlmRead('')
    } finally {
      setGenerating(false)
    }
  }

  const handleSend = userMessage =>
    submit(userMessage, ({ onChunk }) =>
      send({ userMessage, extraContext: transitData ? formatTransitContext(transitData, activeProfile.chart) : '', onChunk }))

  if (!activeProfile) return <div className="flex-1 flex items-center justify-center text-muted text-sm">No profile selected</div>

  if (computing) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
      <LoadingSpinner size="lg" />
      <p className="text-sm">Computing today's transits...</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <ChatToolbar
        title={`Today${transitData?.date ? ` · ${transitData.date}` : ''}`}
        onRefresh={refreshToday}
        onClear={clearChat}
        refreshDisabled={computing || generating}
        clearDisabled={computing || generating || messages.length === 0}
      />
      {(generating || llmRead) && (
        <div className="p-4 border-b border-border bg-surface overflow-y-auto flex-shrink-0 max-h-[45%]">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Today's Transit Read</p>
          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{llmRead || '...'}</p>
        </div>
      )}
      {transitError && <p className="px-4 py-2 text-xs text-red-500">{transitError}</p>}
      <ChatMessages messages={messages} streaming={streaming} streamingContent={streamingContent} />
      {error && <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-t border-red-100">{error}</p>}
      <ChatInput onSend={handleSend} busy={streaming || generating} onStop={stop} placeholder="Ask about today's transits..." />
    </div>
  )
}
