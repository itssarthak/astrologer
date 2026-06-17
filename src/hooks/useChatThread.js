import { useState, useEffect, useCallback, useRef } from 'react'
import { getHistory, clearHistory } from '../lib/storage/chat'

// Shared per-profile chat-thread state used by every tab's chat pane (Chat/Chart/Numbers/
// Today/Match). It owns the message list + the streaming buffer and the storage sync, so the
// tabs only differ in their provider-specific send and any extra panels.
//
// Each tab calls submit(userMessage, runSend) where runSend({ onText, onChunk }) performs the
// actual provider call via the unified useChat hook, which streams via onChunk (append). The
// onText callback (full replacement) is still provided and is harmless. After the send resolves,
// the thread re-syncs from storage (where useChat persisted both turns).
//
// resetOnProfileChange: tabs that manage messages through their own effect (Today computes once
// per day; Match resets extra synastry state) pass false and drive setMessages themselves.
export function useChatThread(profile, tab, { resetOnProfileChange = true } = {}) {
  // Chat history is read asynchronously from IndexedDB, so we start empty and load in an effect.
  const [messages, setMessages] = useState([])
  const [streamingContent, setStreamingContent] = useState('')

  // Guards against a stale async load (e.g. fast profile switch) overwriting newer messages:
  // only the latest reload request is allowed to set state.
  const loadSeq = useRef(0)

  const reload = useCallback(async () => {
    const myReq = ++loadSeq.current
    const next = profile ? await getHistory(profile.id, tab) : []
    if (loadSeq.current === myReq) setMessages(next)
  }, [profile?.id, tab])

  const clearChat = useCallback(async () => {
    if (!profile) return
    await clearHistory(profile.id, tab)
    setMessages([])
  }, [profile?.id, tab])

  // Reload this tab's conversation when the active profile changes — chats are per-profile.
  useEffect(() => {
    if (!resetOnProfileChange) return
    setStreamingContent('')
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const submit = useCallback(async (userMessage, runSend) => {
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setStreamingContent('')
    try {
      await runSend({
        onText: t => setStreamingContent(t),
        onChunk: chunk => setStreamingContent(prev => prev + chunk),
      })
      // Re-sync from storage, where useChat persisted both turns.
      setMessages(profile ? await getHistory(profile.id, tab) : [])
    } catch {
      // The provider hook surfaces the error via its own `error` state.
    } finally {
      setStreamingContent('')
    }
  }, [profile?.id, tab])

  return { messages, setMessages, streamingContent, setStreamingContent, reload, clearChat, submit }
}
