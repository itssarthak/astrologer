// src/components/Tabs/MatchTab.jsx
import { useState, useContext, useEffect } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { PyodideContext } from '../../contexts/PyodideContext'
import { useChat } from '../../hooks/useChat'
import { useChatThread } from '../../hooks/useChatThread'
import { formatSynastryContext, formatNumerologyMatchContext } from '../../lib/prompts/formatters'
import { useReportBusy } from '../../contexts/BusyContext'
import AddProfileModal from '../Sidebar/AddProfileModal'
import ChatMessages from '../Chat/ChatMessages'
import ChatInput from '../Chat/ChatInput'
import ChatToolbar from '../shared/ChatToolbar'
import LoadingSpinner from '../shared/LoadingSpinner'
import MatchResultCard from './Match/MatchResultCard'

export default function MatchTab() {
  const { activeProfile, profiles } = useContext(ProfilesContext)
  const { computeSynastry, computeNumerologyMatch } = useContext(PyodideContext)
  const { send, streaming, error, stop } = useChat(activeProfile, 'match')
  const [partnerProfileId, setPartnerProfileId] = useState('')
  const [synastryData, setSynastryData] = useState(null)
  const [numerologyMatch, setNumerologyMatch] = useState(null)
  const [computing, setComputing] = useState(false)
  const [computeError, setComputeError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [synastryRead, setSynastryRead] = useState('')
  // The completed auto-generated compatibility read, pinned so the Read tab keeps showing it
  // even after the user asks follow-up questions in the chat below (which append later
  // assistant messages). A fresh compute / profile change replaces it.
  const [savedRead, setSavedRead] = useState('')
  const [generatingRead, setGeneratingRead] = useState(false)
  // Match resets extra synastry state on profile change (below), so it opts out of the
  // hook's reset effect and drives the message reload itself.
  const { messages, streamingContent, setStreamingContent, reload, clearChat, submit } =
    useChatThread(activeProfile, 'match', { resetOnProfileChange: false })
  useReportBusy(streaming || generatingRead || computing)

  // When the active profile changes, reload its conversation and reset the match — the
  // partner selection and synastry are computed relative to the (old) active profile.
  useEffect(() => {
    reload()
    setStreamingContent('')
    setPartnerProfileId('')
    setSynastryData(null)
    setNumerologyMatch(null)
    setSavedRead('')
    setSynastryRead('')
    setComputeError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id])

  const otherProfiles = profiles.filter(p => p.id !== activeProfile?.id)
  const partnerProfile = profiles.find(p => p.id === partnerProfileId)

  const handleCompute = async () => {
    if (!activeProfile?.chart || !partnerProfile?.chart) return
    setComputing(true)
    setComputeError(null)
    try {
      // Pass the chart objects directly — computeSynastry stringifies them itself.
      // Genders make the Varna/Gana kootas directional (groom -> bride) when known.
      const result = await computeSynastry(activeProfile.chart, partnerProfile.chart, activeProfile.gender, partnerProfile.gender)
      setSynastryData(result)
      const numMatch = await computeNumerologyMatch(
        activeProfile.name, activeProfile.dob, activeProfile.gender ?? '',
        partnerProfile.name, partnerProfile.dob, partnerProfile.gender ?? '')
      setNumerologyMatch(numMatch)
      await generateRead(result, partnerProfile, numMatch)
    } catch (err) {
      setComputeError(err.message)
    } finally {
      setComputing(false)
    }
  }

  // Auto-generate a full compatibility read once the synastry is computed.
  const generateRead = async (synastry, partner, numMatch) => {
    setGeneratingRead(true)
    setSynastryRead('')
    setSavedRead('')
    try {
      const extraContext = formatSynastryContext(synastry, activeProfile, partner) +
        (numMatch ? '\n\n' + formatNumerologyMatchContext(numMatch) : '')
      const fullRead = await send({
        userMessage: 'Give me our full compatibility read.',
        extraContext,
        onChunk: chunk => setSynastryRead(prev => prev + chunk),
      })
      // Pin the completed read for the Read tab, then clear the live buffer.
      setSavedRead(fullRead ?? '')
      reload()
      setSynastryRead('')
    } catch {
      // The computed card still shows the overlays; useChat surfaces the error.
    } finally {
      setGeneratingRead(false)
    }
  }

  const handleSend = userMessage =>
    submit(userMessage, ({ onChunk }) =>
      send({ userMessage, extraContext: (synastryData ? formatSynastryContext(synastryData, activeProfile, partnerProfile) : '') +
        (numerologyMatch ? '\n\n' + formatNumerologyMatchContext(numerologyMatch) : ''), onChunk }))

  // Refresh recomputes the synastry for the selected partner; with none selected there's
  // nothing to recompute, so it just re-syncs the conversation from storage.
  const refresh = () => {
    if (computing || streaming || generatingRead) return
    if (partnerProfileId) handleCompute()
    else reload()
  }

  if (!activeProfile) return <div className="flex-1 flex items-center justify-center text-muted text-sm">No profile selected</div>

  // The Read tab shows the live stream while generating, otherwise the pinned compatibility
  // read (kept across follow-up chat). Fall back to the latest assistant message only when a
  // saved read isn't in state yet — e.g. revisiting a thread computed in an earlier session.
  const lastRead = [...messages].reverse().find(m => m.role === 'assistant')?.content ?? ''
  const readForTab = generatingRead ? synastryRead : (savedRead || lastRead)

  return (
    <div className="flex flex-col h-full">
      <ChatToolbar title="Kundali Match" onRefresh={refresh} onClear={clearChat}
        refreshDisabled={computing || streaming || generatingRead} clearDisabled={streaming || messages.length === 0} />

      <div className="p-4 border-b border-border flex flex-col gap-3 overflow-y-auto flex-shrink-0 max-h-[45%]">
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
            <select value={partnerProfileId} onChange={e => { setPartnerProfileId(e.target.value); setSynastryData(null); setNumerologyMatch(null) }}
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
          <MatchResultCard
            synastryData={synastryData}
            numerologyMatch={numerologyMatch}
            activeProfile={activeProfile}
            partnerProfile={partnerProfile}
            read={readForTab}
            generatingRead={generatingRead}
          />
        )}
      </div>

      <ChatMessages messages={messages} streaming={streaming} streamingContent={streamingContent} />
      {error && <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-t border-red-100">{error}</p>}
      <ChatInput onSend={handleSend} disabled={!synastryData} busy={streaming || generatingRead} onStop={stop}
        placeholder={synastryData ? 'Ask about compatibility...' : 'Compute a match first'} />

      {showAddModal && <AddProfileModal onClose={() => setShowAddModal(false)} />}
    </div>
  )
}
