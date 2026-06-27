# Tabbed Match view — declutter the compatibility card

**Date:** 2026-06-27
**Status:** Approved design, pending implementation plan

## Problem

`src/components/Tabs/MatchTab.jsx` renders the computed compatibility card as five
heavy sections stacked vertically inside a cramped `max-h-[55%]` scroll area:

1. **Guna Milan** — score /36, 8-koota breakdown, per-person guna attributes
2. **Planetary compatibility** — lean badge, supportive/challenging/neutral counts, two overlay lists
3. **Strongest currents** — ranked supportive/challenging factors
4. **Marriage significators** — per-person summaries + current period
5. **Numerology Compatibility** (`NumerologyMatchPanel`) — two individual Lo Shu grids + the combined grid

Plus a separate **Compatibility Read** band (the LLM prose) below the card. All of it
shows at once, so the view feels cluttered and requires a lot of scrolling.

## Goal

Hide the sections behind a tab strip so the user sees one category at a time. Tabs are a
purely presentational reorganization of already-computed data — no compute, tool, or
formatter changes.

## Tab set (4 tabs)

The computed card becomes a tabbed panel. Tab content groups:

| Tab | Contains |
|-----|----------|
| **Compatibility** *(default on compute)* | Guna Milan (score/breakdown/per-person attrs) + Strongest currents |
| **Planets** | Planetary compatibility (lean, counts, both overlay lists) + Marriage significators |
| **Numerology** | `NumerologyMatchPanel` (two individual Lo Shu grids + combined grid) |
| **Read** | The LLM **Compatibility Read** prose, moved *into* the card from its old separate band |

## Behaviour decisions (confirmed with user)

1. **Tabs render only when `synastryData` exists.** The partner selector + compute button +
   `computeError` stay above the tab strip, unchanged. Empty/no-partner state unchanged.
2. **On a fresh compute the active tab resets to `Compatibility`.** Switching the active
   profile (which clears `synastryData`) also resets it.
3. **Read tab streaming.** While `generatingRead` is true, the Read tab shows the streaming
   `synastryRead` (with the existing `...` placeholder via `<Markdown>`). After the read is
   persisted to the thread, the Read tab shows the last saved compatibility read from the
   thread (the most recent assistant message). The Read **tab label** carries a subtle
   "generating" hint (a small pulsing dot or `…`) while `generatingRead` is true, so a user
   on another tab knows prose is still coming.
4. **The separate Read band below the card is removed** — its content now lives in the Read tab.
5. **Card height shrinks** from `max-h-[55%]` to `max-h-[45%]`; the freed space goes to chat.
6. **Tab strip style** reuses the existing pill-button style from the Chart varga selector:
   active = `bg-primary text-white`, inactive = `bg-surface border border-border text-muted
   hover:border-border-strong`, in a horizontally-scrollable row.
7. The chat (`ChatMessages` + `ChatInput`) stays below the card, unchanged.

## Component structure

`MatchTab.jsx` is already 300+ lines. Extract the computed card and its sections into focused,
display-only units so each file has one responsibility and is independently testable.

**New files**
- `src/components/Tabs/Match/MatchResultCard.jsx` — owns the tab strip + active-tab state.
  Props: `{ synastryData, numerologyMatch, activeProfile, partnerProfile, read, generatingRead }`
  where `read` is the prose to show in the Read tab (streaming buffer or last saved read).
  Renders the pill tab strip + the active section. Resets to `Compatibility` whenever a new
  `synastryData` identity arrives (via an effect keyed on `synastryData`).
- `src/components/Tabs/Match/GunaMilanSection.jsx` — Guna Milan block. Props:
  `{ guna, activeProfile, partnerProfile }`.
- `src/components/Tabs/Match/StrongestCurrentsSection.jsx` — ranked currents. Props:
  `{ synastryData }`. Renders nothing (returns null) when both lists are empty.
- `src/components/Tabs/Match/PlanetaryOverlaysSection.jsx` — lean badge + counts + the two
  `OverlaySection` lists. Props: `{ synastryData, summary, activeProfile, partnerProfile }`.
  The shared `FactorRow`, `OverlayRow`, `OverlaySection` helpers + `EFFECT_TEXT`/`EFFECT_DOT`/
  `LEAN_BADGE`/`GUNA_ATTRS` constants move to `src/components/Tabs/Match/matchPrimitives.jsx`
  (or co-located) and are imported where used — DRY, no duplication across sections.
- `src/components/Tabs/Match/MarriageSection.jsx` — marriage significators + current period.
  Props: `{ synastryData, activeProfile, partnerProfile }`. Returns null when
  `synastryData.marriage_factors` is absent.

**Reused as-is**
- `NumerologyMatchPanel.jsx` — rendered as the Numerology tab. **One change:** its root
  `border-t border-border pt-3` was designed to sit *under* a sibling section; as a standalone
  tab that top divider is wrong. Drop the `border-t … pt-3` from its root (or have the card not
  rely on it). Keep everything else identical. Its existing tests stay green (they assert
  content, not the divider).

**Slimmed**
- `MatchTab.jsx` — keeps partner selection, compute orchestration (`handleCompute`,
  `generateRead`, `handleSend`, `refresh`), the profile-change reset effect, the chat, and now
  renders `<MatchResultCard … />` instead of the inline sections. It must compute the `read`
  prop: while `generatingRead`, pass `synastryRead`; otherwise pass the last assistant message
  text from `messages` (the persisted compatibility read), or empty.

## Agent ↔ UI parity (CLAUDE.md rule)

No change to what is computed or what the agent receives. `formatSynastryContext` and
`formatNumerologyMatchContext` are untouched; all five data groups remain on screen (one tab at
a time). Nothing is added to or hidden from the agent. ✅

## Testing

- **New** `tests/components/MatchResultCard.test.jsx`: given mock `synastryData` +
  `numerologyMatch`, assert (a) all four tab buttons render; (b) default visible content is the
  Compatibility tab (Guna Milan present, Planetary-compatibility content absent); (c) clicking
  **Planets** shows planetary content and hides Guna Milan; (d) clicking **Numerology** shows
  the numerology panel; (e) clicking **Read** shows the passed `read` text; (f) the Read tab
  label shows the generating hint when `generatingRead` is true.
- Existing `NumerologyMatchPanel`, `LoShuGrid`, `CombinedLoShuGrid` tests stay unchanged (they
  assert content, unaffected by the divider removal).
- **Update** `tests/e2e/match.spec.js`: the single test currently asserts content from four
  sections at once. Under tabs only one section is in the DOM at a time, so route each assertion
  through its tab — assert Guna on the default Compatibility tab, click **Planets** before the
  planetary-overlay assertions, click **Read** before the read-text assertion, click
  **Numerology** before the numerology assertions. (This also sidesteps the pre-existing
  strict-mode duplicate-element failure noted on `match.spec.js`, since only one tab's content
  renders at a time — but confirm whether that specific failure clears; if it was caused by a
  genuinely duplicated string within one tab, fix the selector, don't claim the tabs fixed it.)
- Full bar green before merge: `npx vitest run`, `npm run lint` (0 errors), `npm run build`,
  `.venv-test/bin/python -m pytest tests/python`.

## Out of scope

- Any change to synastry/numerology computation, formatters, or LLM context.
- The Numerology tab's internal layout (the grids render as today).
- The partner-selection / add-profile flow.
- Fixing unrelated pre-existing e2e failures beyond the `match.spec.js` assertions this change
  touches.
