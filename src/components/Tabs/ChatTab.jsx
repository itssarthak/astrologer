// src/components/Tabs/ChatTab.jsx
import { useContext, useState, useCallback, useRef } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { useChat } from '../../hooks/useChat'
import { useChatThread } from '../../hooks/useChatThread'
import { useReportBusy } from '../../contexts/BusyContext'
import { useTextToSpeech } from '../../hooks/useTextToSpeech'
import { useSpeechToText } from '../../hooks/useSpeechToText'
import { useVoiceConversation } from '../../hooks/useVoiceConversation'
import ChatMessages from '../Chat/ChatMessages'
import ChatGreeting from '../Chat/ChatGreeting'
import ChatInput from '../Chat/ChatInput'
import ChatToolbar from '../shared/ChatToolbar'
import { toolLabelActive } from '../../lib/llm/toolLabels'

export default function ChatTab() {
  const { activeProfile } = useContext(ProfilesContext)
  const { send, stop, busy, error, toolEvent, liveTools } = useChat(activeProfile, 'chat')
  useReportBusy(busy)
  const { messages, streamingContent, reload, clearChat, submit } = useChatThread(activeProfile, 'chat')

  // Text injected into the input from a MANUAL mic transcript (for the user to review/send).
  const [micInject, setMicInject] = useState(undefined)
  // Which assistant message id is currently being spoken (for the per-message ⏹ state).
  const [speakingId, setSpeakingId] = useState(null)

  const tts = useTextToSpeech()

  // The hands-free orchestrator needs `handleTranscript`, but we create `stt` here so its
  // listening/interim state is shared with ChatInput. Resolve the order via a ref: stt's
  // onResult routes to hands-free when engaged, else fills the input for manual review.
  const voiceRef = useRef(null)
  const handleResult = useCallback(text => {
    if (voiceRef.current?.handsFree) voiceRef.current.handleTranscript(text)
    else setMicInject(text)
  }, [])

  const stt = useSpeechToText({
    onResult: handleResult,
    onEnd: () => voiceRef.current?.onListenEnd?.(),
    onError: e => voiceRef.current?.onListenError?.(e),
  })

  // handleVoiceSend: submit to the thread AND return the assistant's reply text to speak.
  const handleVoiceSend = useCallback(async text => {
    let reply = ''
    await submit(text, async ({ onChunk }) => { reply = await send({ userMessage: text, onChunk }) })
    return reply
  }, [submit, send])

  const voice = useVoiceConversation({ onSend: handleVoiceSend, tts, stt })
  voiceRef.current = voice

  const handleSend = useCallback(async userMessage => {
    let reply = ''
    await submit(userMessage, async ({ onChunk }) => { reply = await send({ userMessage, onChunk }) })
    if (tts.autoSpeak && reply) tts.speak(reply)
  }, [submit, send, tts])

  // onSpeak from ChatMessages arrives as (text, id) — track the speaking message id.
  const handleSpeak = useCallback((text, id = null) => {
    setSpeakingId(id)
    tts.speak(text)
  }, [tts])

  const handleStopSpeak = useCallback(() => {
    tts.stop()
    setSpeakingId(null)
  }, [tts])

  // Manual mic: toggles listening when not hands-free.
  const handleMicToggle = useCallback(() => {
    if (stt.listening) stt.stop()
    else stt.start()
  }, [stt])

  if (!activeProfile) return <div className="flex-1 flex items-center justify-center text-muted text-sm">No profile selected</div>

  return (
    <div className="flex flex-col h-full">
      <ChatToolbar title="Chat" onRefresh={reload} onClear={clearChat}
        refreshDisabled={busy} clearDisabled={busy || messages.length === 0}
        ttsSupported={tts.supported} autoSpeak={tts.autoSpeak} speaking={tts.speaking}
        onToggleAutoSpeak={() => tts.setAutoSpeak(!tts.autoSpeak)}
        voices={tts.voices} voice={tts.voice}
        onSelectVoice={uri => tts.setVoice(tts.voices.find(v => v.voiceURI === uri))}
        voiceSupported={voice.supported} handsFree={voice.handsFree}
        onToggleHandsFree={voice.toggleHandsFree} />
      <ChatMessages messages={messages} streaming={busy} streamingContent={streamingContent} streamingTools={liveTools}
        emptyState={<ChatGreeting name={activeProfile.name} />}
        onSpeak={tts.supported ? handleSpeak : undefined}
        onStopSpeak={handleStopSpeak}
        speakingId={tts.speaking ? speakingId : null} />
      {busy && toolEvent && (
        <p className="px-4 py-2 text-xs font-medium text-primary bg-primary-light/50 border-t border-border flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
          {toolLabelActive(toolEvent.name)}…
        </p>
      )}
      {error && <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-t border-red-100">{error}</p>}
      <ChatInput onSend={handleSend} busy={busy} onStop={stop} placeholder="Ask your astrologer anything..."
        micSupported={stt.supported && !voice.handsFree}
        listening={stt.listening} interim={stt.interim}
        onMicToggle={handleMicToggle} injectText={micInject} />
    </div>
  )
}
