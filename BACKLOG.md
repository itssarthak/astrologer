# Backlog — Upcoming Tasks & Ideas

A parking lot for things we want to do but aren't doing right now. Move items
into a branch/issue when they get picked up.

Legend: 🟣 feature · 🔄 refactor · 🔴 bug · 💡 idea · 📝 chore

---

## Now / Next

_(Pull the top item from here when starting work.)_

-

## Tasks

### 🟣 In-browser voice: STT + TTS (Chat tab)

Add speech-to-text input and text-to-speech output using the Web Speech API —
no server, all in-browser. Scope to the Chat tab first, expand later if it lands.

**Decisions (locked):**
- **TTS:** both — global auto-speak toggle in the toolbar AND a per-message
  play/stop button on each assistant message.
- **STT:** hands-free conversation loop — mic listens → auto-send on silence →
  TTS speaks reply → mic reopens. Single on/off control. Mic forced **off** while
  TTS speaks (so the agent doesn't transcribe its own voice).
- **Scope:** Chat tab only to start.
- **Language:** default `en-IN`, fall back to `en-US` / first English voice.

**Architecture (two primitives + one orchestrator):**
- `src/lib/speech/tts.js` — `isTTSSupported()`, `getEnglishVoices()`,
  `speak(text, {voice, rate, pitch, onEnd})`, `cancelSpeech()`. Prefer
  Google/Natural en-IN→en voices; handle Chrome async `onvoiceschanged`; chunk
  long replies by sentence (Chrome ~15s cutoff). (Seed from the sample below.)
- `src/lib/speech/stt.js` — `isSTTSupported()`,
  `createRecognizer({lang, onInterim, onFinal, onEnd, onError})`. Uses
  `webkitSpeechRecognition`, `continuous=false`, `interimResults=true` so the
  browser's silence-detection fires `onend` → that's the auto-send trigger.
- `useTextToSpeech()` → `{ supported, speaking, autoSpeak, setAutoSpeak, voices,
  voice, setVoice, speak, stop }`. Persist `autoSpeak` + voice to localStorage.
- `useSpeechToText()` → `{ supported, listening, interim, start, stop }`.
- `useVoiceConversation({ onSend, replyText, replyComplete })` →
  `{ handsFree, toggleHandsFree, mode }`. State machine:
  `idle → listening → thinking → speaking → listening…`.

**UI wiring:**
- `ChatInput` — mic button left of Send; idle 🎙️ / listening pulsing-red;
  show live `interim` in the textarea. Manual mode fills textarea for edit;
  hands-free auto-sends.
- `ChatToolbar` — 🔊 auto-speak toggle + 🎧 hands-free toggle. Hide each if its
  API is unsupported (Firefox: no SpeechRecognition → hide mic/hands-free, keep TTS).
- `ChatMessage` — per-message play/stop button (reuses `useTextToSpeech.speak`).

**Edge cases:** unsupported browser degrades silently (buttons hidden, text chat
intact); mic permission denied → inline error + hands-free off; user typing or
Stop cancels active speech + listening.

**Testing:** unit-test `tts.js`/`stt.js` against mocked `speechSynthesis` /
`SpeechRecognition`; loop state machine via vitest + fake timers; manual smoke
for the mic (hard to automate).

**TTS sample to seed from:**
```js
function testTTS() {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance("Testing local text to speech…");
  function applyVoice() {
    const voices = window.speechSynthesis.getVoices();
    const bestVoice =
      voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural')))
      || voices.find(v => v.lang.startsWith('en'))
      || voices[0];
    if (bestVoice) utterance.voice = bestVoice;
    utterance.rate = 1.0; utterance.pitch = 1.0; utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }
  if (window.speechSynthesis.onvoiceschanged !== undefined)
    window.speechSynthesis.onvoiceschanged = applyVoice;
  applyVoice();
}
```

## Ideas

-

## Someday / Maybe

-

---

## Done

_(Move completed items here with a date.)_

-
