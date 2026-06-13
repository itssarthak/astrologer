// src/components/Tabs/MatchTab.jsx
import { useState, useContext, useEffect } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { PyodideContext } from '../../contexts/PyodideContext'
import { useChat } from '../../hooks/useChat'
import { useChatThread } from '../../hooks/useChatThread'
import { formatSynastryContext } from '../../lib/prompts/formatters'
import { useReportBusy } from '../../contexts/BusyContext'
import AddProfileModal from '../Sidebar/AddProfileModal'
import ChatMessages from '../Chat/ChatMessages'
import Markdown from '../Chat/Markdown'
import ChatInput from '../Chat/ChatInput'
import ChatToolbar from '../shared/ChatToolbar'
import LoadingSpinner from '../shared/LoadingSpinner'

const EFFECT_TEXT = { supportive: 'text-green-700', challenging: 'text-red-600', neutral: 'text-muted' }
const EFFECT_DOT = { supportive: 'bg-green-600', challenging: 'bg-red-500', neutral: 'bg-border-strong' }
const LEAN_BADGE = {
  harmonious: 'bg-green-100 text-green-700',
  challenging: 'bg-red-100 text-red-600',
  mixed: 'bg-surface-2 text-text-2',
}

function FactorRow({ text, effect }) {
  return (
    <div className="flex items-start gap-2 text-xs leading-snug">
      <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${EFFECT_DOT[effect]}`} />
      <span className="text-text-2">{text}</span>
    </div>
  )
}

function OverlayRow({ o }) {
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

function OverlaySection({ title, overlays }) {
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

export default function MatchTab() {
  const { activeProfile, profiles } = useContext(ProfilesContext)
  const { computeSynastry } = useContext(PyodideContext)
  const { send, streaming, error, stop } = useChat(activeProfile, 'match')
  const [partnerProfileId, setPartnerProfileId] = useState('')
  const [synastryData, setSynastryData] = useState(null)
  const [computing, setComputing] = useState(false)
  const [computeError, setComputeError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [synastryRead, setSynastryRead] = useState('')
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
      await generateRead(result, partnerProfile)
    } catch (err) {
      setComputeError(err.message)
    } finally {
      setComputing(false)
    }
  }

  // Auto-generate a full compatibility read once the synastry is computed.
  const generateRead = async (synastry, partner) => {
    setGeneratingRead(true)
    setSynastryRead('')
    try {
      const extraContext = formatSynastryContext(synastry, activeProfile, partner)
      await send({
        userMessage: 'Give me our full compatibility read.',
        extraContext,
        onChunk: chunk => setSynastryRead(prev => prev + chunk),
      })
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
      send({ userMessage, extraContext: synastryData ? formatSynastryContext(synastryData, activeProfile, partnerProfile) : '', onChunk }))

  // Refresh recomputes the synastry for the selected partner; with none selected there's
  // nothing to recompute, so it just re-syncs the conversation from storage.
  const refresh = () => {
    if (computing || streaming || generatingRead) return
    if (partnerProfileId) handleCompute()
    else reload()
  }

  if (!activeProfile) return <div className="flex-1 flex items-center justify-center text-muted text-sm">No profile selected</div>

  const guna = synastryData?.guna_milan
  const summary = synastryData?.overlay_summary

  return (
    <div className="flex flex-col h-full">
      <ChatToolbar title="Kundali Match" onRefresh={refresh} onClear={clearChat}
        refreshDisabled={computing || streaming || generatingRead} clearDisabled={streaming || messages.length === 0} />

      <div className="p-4 border-b border-border flex flex-col gap-3 overflow-y-auto flex-shrink-0 max-h-[55%]">
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
          <div className="bg-surface border border-border rounded-xl p-3 flex flex-col gap-3">
            {/* Guna Milan */}
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-text">Guna Milan</span>
                <span className="text-2xl font-bold text-primary">
                  {guna?.total ?? '—'}<span className="text-sm text-muted font-normal">/36</span>
                  <span className="ml-2 text-xs text-muted font-medium">{guna?.verdict}</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2">
                {Object.entries(guna?.breakdown ?? {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs text-muted">
                    <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-text-2">{v.score}/{v.max}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Planetary overlays */}
            {summary && (
              <div className="border-t border-border pt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text">Planetary compatibility</span>
                  <span className={`text-xs capitalize px-2 py-0.5 rounded-full font-medium ${LEAN_BADGE[summary.lean] ?? LEAN_BADGE.mixed}`}>
                    {summary.lean}
                  </span>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-700">● {summary.supportive} supportive</span>
                  <span className="text-red-600">● {summary.challenging} challenging</span>
                  <span className="text-muted">● {summary.neutral} neutral</span>
                </div>
                <OverlaySection title={`${activeProfile.name} → ${partnerProfile?.name}`} overlays={synastryData.a_planets_in_b_houses ?? []} />
                <OverlaySection title={`${partnerProfile?.name} → ${activeProfile.name}`} overlays={synastryData.b_planets_in_a_houses ?? []} />
              </div>
            )}

            {/* Strongest currents — the ranked cross-aspect + overlay digest */}
            {((synastryData.top_supportive?.length > 0) || (synastryData.top_challenging?.length > 0)) && (
              <div className="border-t border-border pt-3 flex flex-col gap-2">
                <span className="text-sm font-semibold text-text">Strongest currents</span>
                {(synastryData.top_supportive ?? []).map((s, i) => (
                  <FactorRow key={`s${i}`} text={s} effect="supportive" />
                ))}
                {(synastryData.top_challenging ?? []).map((s, i) => (
                  <FactorRow key={`c${i}`} text={s} effect="challenging" />
                ))}
              </div>
            )}

            {/* Marriage significators + current period */}
            {synastryData.marriage_factors && (
              <div className="border-t border-border pt-3 flex flex-col gap-1">
                <span className="text-sm font-semibold text-text">Marriage significators</span>
                <p className="text-xs text-text-2">
                  <span className="font-medium">{activeProfile.name}:</span> {synastryData.marriage_factors.a?.summary ?? '—'}
                </p>
                <p className="text-xs text-text-2">
                  <span className="font-medium">{partnerProfile?.name}:</span> {synastryData.marriage_factors.b?.summary ?? '—'}
                </p>
                {synastryData.dasha_overlap?.note && (
                  <p className="text-xs text-muted mt-1">Current period: {synastryData.dasha_overlap.note}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {(generatingRead || synastryRead) && (
        <div className="p-4 border-b border-border bg-surface overflow-y-auto flex-shrink-0 max-h-[40%]">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Compatibility Read</p>
          <div className="text-sm text-text leading-relaxed">{synastryRead ? <Markdown>{synastryRead}</Markdown> : '...'}</div>
        </div>
      )}

      <ChatMessages messages={messages} streaming={streaming} streamingContent={streamingContent} />
      {error && <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-t border-red-100">{error}</p>}
      <ChatInput onSend={handleSend} disabled={!synastryData} busy={streaming || generatingRead} onStop={stop}
        placeholder={synastryData ? 'Ask about compatibility...' : 'Compute a match first'} />

      {showAddModal && <AddProfileModal onClose={() => setShowAddModal(false)} />}
    </div>
  )
}
