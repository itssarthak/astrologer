import { useState, useEffect, useCallback } from 'react'
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
  const [messages, setMessages] = useState(() => (profile ? getHistory(profile.id, tab) : []))
  const [streamingContent, setStreamingContent] = useState('')

  const reload = useCallback(() => {
    setMessages(profile ? getHistory(profile.id, tab) : [])
  }, [profile?.id, tab])

  const clearChat = useCallback(() => {
    if (!profile) return
    clearHistory(profile.id, tab)
    setMessages([])
  }, [profile?.id, tab])

  // Reload this tab's conversation when the active profile changes — chats are per-profile.
  useEffect(() => {
    if (!resetOnProfileChange) return
    setMessages(profile ? getHistory(profile.id, tab) : [])
    setStreamingContent('')
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
      setMessages(profile ? getHistory(profile.id, tab) : [])
    } catch {
      // The provider hook surfaces the error via its own `error` state.
    } finally {
      setStreamingContent('')
    }
  }, [profile?.id, tab])

  return { messages, setMessages, streamingContent, setStreamingContent, reload, clearChat, submit }
}
