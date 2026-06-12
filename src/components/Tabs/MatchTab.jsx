// src/components/Tabs/MatchTab.jsx
import { useState, useContext } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { PyodideContext } from '../../contexts/PyodideContext'
import { useLLM } from '../../hooks/useLLM'
import { getHistory, clearHistory } from '../../lib/storage/chat'
import { formatSynastryContext } from '../../lib/prompts/formatters'
import AddProfileModal from '../Sidebar/AddProfileModal'
import ChatMessages from '../Chat/ChatMessages'
import ChatInput from '../Chat/ChatInput'
import ChatToolbar from '../shared/ChatToolbar'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function MatchTab() {
  const { activeProfile, profiles } = useContext(ProfilesContext)
  const { computeSynastry } = useContext(PyodideContext)
  const { send, streaming, error } = useLLM(activeProfile, 'match')
  const [partnerProfileId, setPartnerProfileId] = useState('')
  const [synastryData, setSynastryData] = useState(null)
  const [computing, setComputing] = useState(false)
  const [computeError, setComputeError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [messages, setMessages] = useState(() =>
    activeProfile ? getHistory(activeProfile.id, 'match') : []
  )
  const [streamingContent, setStreamingContent] = useState('')

  const otherProfiles = profiles.filter(p => p.id !== activeProfile?.id)
  const partnerProfile = profiles.find(p => p.id === partnerProfileId)

  const handleCompute = async () => {
    if (!activeProfile?.chart || !partnerProfile?.chart) return
    setComputing(true)
    setComputeError(null)
    try {
      // Pass the chart objects directly — computeSynastry stringifies them itself.
      const result = await computeSynastry(activeProfile.chart, partnerProfile.chart)
      setSynastryData(result)
    } catch (err) {
      setComputeError(err.message)
    } finally {
      setComputing(false)
    }
  }

  const handleSend = async userMessage => {
    const extraContext = synastryData ? formatSynastryContext(synastryData, activeProfile, partnerProfile) : ''
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setStreamingContent('')
    try {
      await send({ userMessage, extraContext, onChunk: chunk => setStreamingContent(prev => prev + chunk) })
      setMessages(getHistory(activeProfile.id, 'match'))
      setStreamingContent('')
    } catch {
      setStreamingContent('')
    }
  }

  // Refresh recomputes the synastry for the selected partner; with none selected there's
  // nothing to recompute, so it just re-syncs the conversation from storage.
  const refresh = () => {
    if (computing || streaming) return
    if (partnerProfileId) handleCompute()
    else setMessages(getHistory(activeProfile.id, 'match'))
  }
  const clearChat = () => { clearHistory(activeProfile.id, 'match'); setMessages([]) }

  if (!activeProfile) return <div className="flex-1 flex items-center justify-center text-muted text-sm">No profile selected</div>

  return (
    <div className="flex flex-col h-full">
      <ChatToolbar title="Kundali Match" onRefresh={refresh} onClear={clearChat}
        refreshDisabled={computing || streaming} clearDisabled={streaming || messages.length === 0} />
      <div className="p-4 border-b border-border flex flex-col gap-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Kundali Match</p>
        {otherProfiles.length === 0 ? (
          <div className="flex flex-col gap-2 items-start">
            <p className="text-sm text-muted">Add a second profile to compute compatibility.</p>
            <button onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors">
              + Add Profile
            </button>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap items-center">
            <select value={partnerProfileId} onChange={e => { setPartnerProfileId(e.target.value); setSynastryData(null) }}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-white text-text text-sm focus:outline-none focus:border-primary">
              <option value="">Select partner profile...</option>
              {otherProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={handleCompute} disabled={!partnerProfileId || computing}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors flex items-center gap-2">
              {computing ? <LoadingSpinner size="sm" /> : 'Match →'}
            </button>
            <button onClick={() => setShowAddModal(true)} className="text-sm text-primary underline flex-shrink-0">+ Add profile</button>
          </div>
        )}

        {computeError && <p className="text-xs text-red-500">{computeError}</p>}

        {synastryData && (
          <div className="bg-surface border border-border rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text">Guna Milan Score</span>
              <span className="text-2xl font-bold text-primary">{synastryData.guna_milan?.total ?? '—'}<span className="text-sm text-muted font-normal">/36</span></span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(synastryData.guna_milan?.kuttas ?? []).map((k, i) => (
                <div key={i} className="flex justify-between text-xs text-muted">
                  <span>{k.name}</span>
                  <span className="font-medium text-text-2">{k.score}/{k.max}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ChatMessages messages={messages} streaming={streaming} streamingContent={streamingContent} />
      {error && <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-t border-red-100">{error}</p>}
      <ChatInput onSend={handleSend} disabled={streaming || !synastryData} placeholder={synastryData ? 'Ask about compatibility...' : 'Compute a match first'} />

      {showAddModal && <AddProfileModal onClose={() => setShowAddModal(false)} />}
    </div>
  )
}
