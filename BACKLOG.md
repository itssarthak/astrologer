# Backlog — Upcoming Tasks & Ideas

A parking lot for things we want to do but aren't doing right now. Move items
into a branch/issue when they get picked up.

Legend: 🟣 feature · 🔄 refactor · 🔴 bug · 💡 idea · 📝 chore

---

## Now / Next

_(Pull the top item from here when starting work.)_

1. 🟣 Full classical yoga catalogue (~6,500) — the original stretch goal
2. 🟣 P3 — Varshaphal / Tajaka (annual chart)

## Tasks

### 🟣 Full classical yoga catalogue (~6,500 yogas)

The original stretch goal: grow the clean-room yoga registry from the current **25**
toward the full classical catalogue (~6,500 yoga *results* spread across ~233 rule
families), entirely **in-browser, no backend**.

**Constraints (locked):**
- **Clean-room only.** Reference PyJHora 4.8.7 `yoga.py` (~233 rules, pure
  `_from_planet_positions` variants) and BPHS/classical texts for *definitions* —
  never copy code (PyJHora is AGPL-3.0; copying would force the whole app open).
- **Never hallucinate** (soul.md hard rule): every rule must come from a sourced
  classical definition, with conservative detection. Per-rule `try/except` in
  `compute_yogas` already isolates a bad rule from crashing the reading.
- Pure-Python in the Pyodide worker; no WASM, no network at detection time.

**Scaffolding already in place** (`src/lib/pyodide/scripts/yogas.py`):
- `YOGA_RULES` registry of `{id, name, category, description, detect(ctx)}`.
- `_context(chart)` → `{planets (sign/house/dignity/strength), lords, lagna_idx}`.
- Helpers: `_associated` (conjunction / mutual aspect / parivartana), `_aspects`,
  `_parivartana`, `OWNED_SIGNS`, `ASPECT_ANGLES`, kendra/trikona/dusthana sets,
  `KENDRAS`/`TRIKONAS`, `EXALTED_IN_SIGN`, `house_distance`, `planet_in`.

**Approach — batch by family, each with tests (synthetic `_ctx` + real-chart smoke), like P1a/b:**
- Nabhasa yogas (Sankhya / Asraya / Dala / Akriti groups — ~32 core + variants).
- Generalized Parivartana (sign-exchange) yogas across all house-lord pairs
  (Maha / Dainya / Khala variants).
- Full Dhana set (2/5/9/11 lord combinations), Daridra, Arishta/longevity.
- Raja yoga variants beyond kendra–trikona (Neechabhanga-driven, exchange-driven).
- Solar/lunar/planet-pair combinations, planet-in-own/exalted-house yogas, etc.
- Surfacing: `get_chart` (top N) + `get_yogas` (full list); descriptions flow through unchanged.

**Effort:** large — do incrementally; count + categorise as families land. Log how many
rules/results are covered so we know the distance to "full".

### 🟣 P3 — Varshaphal / Tajaka (annual chart)

Annual solar-return reading. New `varshaphal.py` + a `get_varshaphal` tool ("what does
this year hold"). Verify whether jyotishganit exposes a solar return; if not, compute the
solar-return moment (Sun returns to natal longitude) ourselves.

**Scope to decide when picked up** (full Tajaka vs. a useful subset):
- Muntha (progressed point) + its house/lord.
- Varshesha (year lord) selection (Panchadhikari / five office-bearers).
- Mudda (annual Vimshottari) dasha.
- Core Tajaka yogas (Ithasala, Ishrafa, Nakta, Yamaya, Manau, Kamboola, …) via Tajaka
  aspects (orb-based, not graha-drishti).
- Sahams (Punya, etc.) — optional.

### 🔄 Harmonize the `compute_chart` tool output (deferred from P0)

The `compute_chart` tool (fresh chart for a **non-saved** person) still returns the ad-hoc
`summarizeChart` shape. Make it return the same dignity/strength/dasha format `get_chart`
uses (via `computeChartFacts`) so the agent reads both consistently.

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

- 💡 **Arbitrary-date transit tool** — `get_today_transit` only does *now*; add a dated
  variant ("what about next month / in March") computing transits for a given date.
- 💡 **Profile recompute / migration** — existing saved profiles miss newer doshas/yogas
  and the dignity-vocabulary fix until re-added. Add a one-time recompute-on-load (or a
  "refresh chart" action) so old profiles pick up engine improvements without re-entry.
- 💡 **Degree-orb aspect weighting** — synastry cross-aspects are sign-based; optionally
  weight them by degree-orb tightness (tight/active/loose) using the existing
  `aspects.py` helpers (`orb_within_sign`, `tightness`).
- 💡 **Ashtakavarga-weighted transits** — fold SAV bindus into `get_today_transit` so a
  transit through a high-bindu sign reads as stronger.

## Someday / Maybe

- 💡 Daily proactive push + PDF export — explicitly scoped OUT of the parity work
  ("web-app surfaces only"); parked here only so the decision is recorded, not lost.

---

## Done

_(Move completed items here with a date.)_

- ✅ 2026-06-13 — **P0** chart-facts foundation (adapter, dignity, strength, `get_chart` + `get_divisional`).
- ✅ 2026-06-13 — **P1a/b** yoga registry → **25 yogas** (Mahapurusha, Chandra/Surya, Raja, Viparita, Neecha Bhanga, Dhana) + adapter dignity-vocabulary fix.
- ✅ 2026-06-13 — **P1c** doshas → **8** (Kalathra/Shrapit/Shakata + Manglik refinements), numerology expansion (mulank/bhagyank + rulers, name-in-use, compound/Cheiro, compatibility), reading-procedure + output-format layer.
- ✅ 2026-06-13 — **P2** deep synastry (planet↔planet cross-aspects, dignity-weighted overlays, 7th-lord/karaka, dasha overlap, ranked digest, Match-card render, "challenging until" timing).
- ✅ 2026-06-13 — Unified **streaming** chat engine + per-tab configurable tools; markdown-rendered replies; live date/time + active-profile birth details in the prompt; Chart-tab context fix.
- ✅ 2026-06-13 — Exposed all computed data as agent tools: `get_dasha`, `get_doshas`, `get_yogas`, `get_ashtakavarga`.
