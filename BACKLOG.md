# Backlog — Upcoming Tasks & Ideas

A parking lot for things we want to do but aren't doing right now. Move items
into a branch/issue when they get picked up.

Legend: 🟣 feature · 🔄 refactor · 🔴 bug · 💡 idea · 📝 chore

---

## Now / Next

_(Pull the top item from here when starting work.)_

-

## Tasks

### 🟣 Yoga catalogue — further families (ongoing)

The clean-room registry now has **71 rules** covering the major classical families
(Pancha Mahapurusha, Chandra, Surya, Raja, Viparita, Neecha Bhanga, Dhana, Nabhasa
Sankhya/Asraya/Dala/Akriti, named classics, Parivartana, Daridra). The literal "~6,500"
figure is the count of yoga *results/permutations* across the whole corpus; the generalized
rules already detect many instances. Reaching deeper coverage is open-ended — add more
named/obscure families (Sankha, Bheri, Pushkala, Gaja, Kala-sarpa variants, longevity/Arishta
sets, more Raja/Dhana permutations) batch-by-family with the same TDD + clean-room sourcing.
Diminishing returns past the common families, so pick up only as needed.

### 🟣 Varshaphal — full Tajaka layer (deferred from P3)

P3 shipped the annual chart core (solar return, Varsha lagna + lord, Muntha + lord, Mudda
dasha, placements, `get_varshaphal` tool). Still open if wanted: the Tajaka yoga engine
(Ithasala, Ishrafa, Nakta, Yamaya, Manau, Kamboola, … — orb/speed-based applying/separating
aspects), the Panchadhikari **year-lord (Varshesha)** scoring, Sahams (Punya, etc.), and
Tri-pataki / Pancha-vargeeya bala. Source-variable and complex — scope carefully if picked up.

## Ideas

- 💡 **Tighter STT silence tuning** — Web Speech `continuous=false` ends a turn on its own
  silence timeout; expose a small "keep listening" grace or a manual end-of-turn control if
  hands-free turns feel too eager to cut off.
- 💡 **Voice in other tabs** — the voice stack is Chat-only; could extend the mic/auto-speak
  to Today/Chart/Numbers/Match if there's demand (all use the same `useChat` now).

## Someday / Maybe

- 💡 Daily proactive push + PDF export — explicitly scoped OUT of the parity work
  ("web-app surfaces only"); parked here only so the decision is recorded, not lost.

---

## Done

_(Most recent first.)_

- ✅ 2026-06-14 — **In-browser voice (STT + TTS), Chat tab**: Web Speech primitives + hooks, a callback-driven hands-free conversation loop (survives silence, guards double-start, recovers from mic-permission errors), mic button, global auto-speak toggle, per-message read-aloud. Degrades silently on unsupported browsers.
- ✅ 2026-06-14 — **P3 Varshaphal** annual chart: solar-return (Newton iteration on Sun longitude), Varsha lagna + lord, Muntha + lord, Mudda (annual Vimshottari) dasha, `get_varshaphal` tool.
- ✅ 2026-06-14 — **Yoga catalogue expansion** 25 → 71 rules (Nabhasa Sankhya/Asraya/Dala/Akriti, named classics, Parivartana, Dhana, Daridra), reviewed for classical accuracy.
- ✅ 2026-06-14 — **Backlog ideas**: dated transits + Ashtakavarga-weighted transits, degree-orb-weighted synastry cross-aspects (activated `aspects.py`), auto-migration of stale saved profiles on engine-version bump.
- ✅ 2026-06-14 — **compute_chart tool** harmonized to get_chart's dignity/strength/dasha format.
- ✅ 2026-06-13 — **P0–P2** parity work + infra: chart-facts foundation; 25→ (then 71) yogas; 8 doshas; expanded numerology; deep synastry (cross-aspects, karakas, dasha timing, "challenging until"); unified streaming chat + per-tab configurable tools; markdown replies; live date/time + birth details in the prompt; all computed data exposed as agent tools (dasha, doshas, yogas, ashtakavarga).
