// src/components/Tabs/TodayTab.jsx
import { useState, useContext, useEffect } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { PyodideContext } from '../../contexts/PyodideContext'
import { useLLM } from '../../hooks/useLLM'
import { getHistory } from '../../lib/storage/chat'
import { formatTransitContext } from '../../lib/prompts/formatters'
import ChatMessages from '../Chat/ChatMessages'
import ChatInput from '../Chat/ChatInput'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function TodayTab() {
  const { activeProfile } = useContext(ProfilesContext)
  const { isReady, computeTransit } = useContext(PyodideContext)
  const { send, streaming, error } = useLLM(activeProfile, 'today')
  const [transitData, setTransitData] = useState(null)
  const [computing, setComputing] = useState(false)
  const [transitError, setTransitError] = useState(null)
  const [llmRead, setLlmRead] = useState('')
  const [generating, setGenerating] = useState(false)
  const [messages, setMessages] = useState(() =>
    activeProfile ? getHistory(activeProfile.id, 'today') : []
  )
  const [streamingContent, setStreamingContent] = useState('')

  useEffect(() => {
    if (!activeProfile || !isReady) return
    computeToday()
  }, [activeProfile?.id, isReady])

  const computeToday = async () => {
    if (!activeProfile) return
    setComputing(true)
    setTransitError(null)
    try {
      const chartJson = JSON.stringify(activeProfile.chart)
      const transit = await computeTransit(chartJson, activeProfile.lat, activeProfile.lon, activeProfile.timezone_offset)
      setTransitData(transit)
      await generateRead(transit)
    } catch (err) {
      setTransitError(err.message)
    } finally {
      setComputing(false)
    }
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
      setMessages(getHistory(activeProfile.id, 'today'))
      setLlmRead('')
    } finally {
      setGenerating(false)
    }
  }

  const handleSend = async userMessage => {
    const extraContext = transitData ? formatTransitContext(transitData, activeProfile.chart) : ''
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setStreamingContent('')
    try {
      await send({ userMessage, extraContext, onChunk: chunk => setStreamingContent(prev => prev + chunk) })
      setMessages(getHistory(activeProfile.id, 'today'))
      setStreamingContent('')
    } catch {
      setStreamingContent('')
    }
  }

  if (!activeProfile) return <div className="flex-1 flex items-center justify-center text-muted text-sm">No profile selected</div>

  if (computing) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
      <LoadingSpinner size="lg" />
      <p className="text-sm">Computing today's transits...</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {(generating || llmRead) && (
        <div className="p-4 border-b border-border bg-surface">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Today's Transit Read</p>
          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{llmRead || '...'}</p>
        </div>
      )}
      {transitError && <p className="px-4 py-2 text-xs text-red-500">{transitError}</p>}
      <ChatMessages messages={messages} streaming={streaming} streamingContent={streamingContent} />
      {error && <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-t border-red-100">{error}</p>}
      <ChatInput onSend={handleSend} disabled={streaming || generating} placeholder="Ask about today's transits..." />
    </div>
  )
}
