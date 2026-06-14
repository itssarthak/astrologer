# Backlog — Upcoming Tasks & Ideas

A parking lot for things we want to do but aren't doing right now. Move items
into a branch/issue when they get picked up.

Legend: 🟣 feature · 🔄 refactor · 🔴 bug · 💡 idea · 📝 chore

---

## Now / Next

_(Pull the top item from here when starting work.)_

- _Nothing active — all planned features shipped. See "Open / optional" below for the two
  open-ended items, and "Ideas" for smaller follow-ups._

## Open / optional

_(Genuinely unfinished, but open-ended and only worth picking up on demand.)_

### 🟣 Yoga catalogue — the long tail toward ~6,500 (NOT done)

The registry has **71 rules** covering the major classical families. The "~6,500" figure is
the count of yoga *results/permutations* across the whole corpus — the rest is a long tail of
obscure named yogas (Sankha, Bheri, Pushkala, Gaja, longevity/Arishta sets, more Raja/Dhana
permutations) with steeply diminishing returns. Add batch-by-family with the same TDD +
clean-room sourcing **only as needed**. This was never literally completed.

### 🟣 Varshaphal — full Tajaka layer (P3 core shipped; this part not done)

The annual-chart core shipped (solar return, Varsha lagna + lord, Muntha + lord, Mudda dasha,
`get_varshaphal`). Still open if wanted: the Tajaka yoga engine (Ithasala, Ishrafa, Nakta,
Yamaya, Manau, Kamboola, … — orb/speed-based applying/separating aspects), the Panchadhikari
**year-lord (Varshesha)** scoring, Sahams, and Tri-pataki / Pancha-vargeeya bala.
Source-variable and complex — scope carefully if picked up.

## Ideas

- 💡 **Tighter STT silence tuning** — Web Speech `continuous=false` ends a turn on its own
  silence timeout; expose a "keep listening" grace or a manual end-of-turn control if
  hands-free turns feel too eager to cut off.
- 💡 **Voice in other tabs** — the voice stack is Chat-only; could extend mic/auto-speak to
  Today/Chart/Numbers/Match if there's demand (all use the same `useChat` now).

## Someday / Maybe

- 💡 Daily proactive push + PDF export — explicitly scoped OUT of the parity work
  ("web-app surfaces only"); parked here only so the decision is recorded, not lost.

---

## Done

_(Most recent first.)_

- ✅ 2026-06-14 — **Chat/voice UX polish**: reactive SVG voice icons (mic broadcast arcs, speaker ripple, headset live-dot, per-message stop); quality-first TTS voice pick + voice dropdown with novelty voices hidden; Esc-to-stop a streaming reply; data-driven divisional-chart tabs (UI shows exactly the vargas the engine computed).
- ✅ 2026-06-14 — **In-browser voice (STT + TTS), Chat tab**: Web Speech primitives + hooks, callback-driven hands-free loop (survives silence, guards double-start, recovers from mic-permission errors), mic, auto-speak, per-message read-aloud. Degrades silently when unsupported.
- ✅ 2026-06-14 — **P3 Varshaphal** annual chart core: solar return (Newton iteration), Varsha lagna + lord, Muntha + lord, Mudda dasha, `get_varshaphal` tool.
- ✅ 2026-06-14 — **Yoga catalogue expansion** 25 → 71 rules (Nabhasa, named classics, Parivartana, Dhana, Daridra), reviewed for classical accuracy.
- ✅ 2026-06-14 — **Backlog ideas**: dated transits + Ashtakavarga-weighted transits, degree-orb-weighted synastry cross-aspects (activated `aspects.py`), auto-migration of stale saved profiles on engine-version bump.
- ✅ 2026-06-14 — **compute_chart tool** harmonized to get_chart's dignity/strength/dasha format.
- ✅ 2026-06-13 — **P0–P2** parity work + infra: chart-facts foundation; yogas; 8 doshas; expanded numerology; deep synastry (cross-aspects, karakas, dasha timing, "challenging until"); unified streaming chat + per-tab configurable tools; markdown replies; live date/time + birth details in the prompt; all computed data exposed as agent tools.
