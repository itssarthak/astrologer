# Merge Chat + Chart + Today into one view

**Date:** 2026-06-27
**Status:** Approved design, pending implementation plan

## Goal

Collapse the `Chat`, `Chart`, and `Today` tabs into a single primary view:

- **Chat stays in the middle** — the existing conversation experience, unchanged.
- **Chart lives on the right** — a collapsible side panel (desktop) / collapsible section
  above chat (mobile) showing the already-computed Kundli, varga selector, and
  dasha/yoga/dosha pills.
- **Today becomes a template prompt** — no longer a tab with its own auto-computed read.
  It is one of several starter prompts shown when the chat is empty.

After this change the tab bar has three entries: the merged view (labelled **Chat**),
**Numbers**, **Match**.

## Layout

Desktop (`md+`):

```
┌──────────────────────────────────┬──────────────────────┐
│  chat messages (centered)        │  ◀ Chart             │  ← collapsible
│   • empty state shows greeting   │  ┌────────────────┐  │
│     + template prompt chips      │  │ varga tabs     │  │
│                                  │  │ Kundli grid    │  │
│                                  │  │ dasha/yoga/    │  │
│  [ input box ............ ▷ ]   │  │ dosha pills    │  │
│                                  │  └────────────────┘  │
└──────────────────────────────────┴──────────────────────┘
```

Mobile: the chart panel renders as a collapsible section **above** the chat (collapsed by
default), toggled by the same button. Template chips render in a horizontally-scrollable row
inside the empty state. Same components, responsive.

## Behaviour decisions (confirmed with user)

1. **Single `'chat'` thread.** The merged view uses the existing `chat` chat thread and its
   `chat` system prompt. The old per-tab `today` / `chart` *chat histories* become
   inaccessible from the UI (the threads still exist in storage, just unused). This is
   acceptable — one unified conversation is the desired mental model.
2. **Collapsible chart panel**, toggled via a button in the chat toolbar. When collapsed,
   chat goes full-width.
3. **Template chips appear only when the chat is empty** (alongside the greeting), like
   starter prompts. Once the conversation has messages, the chips disappear.
4. **Tapping a chip fills the input box** (does not auto-send) so the user can edit before
   sending. Reuse the existing `injectText` / `micInject` mechanism in `ChatInput`.
5. **No per-day auto-compute on load.** The old `TodayTab` effect that computed the transit
   and auto-sent a read once per calendar day is removed. Today's read now happens only when
   the user taps the "Today's transit read" chip and sends it; the agent fetches the transit
   itself via its `get_today_transit` tool.

## Template prompts

Shown when chat is empty. Each fills the input with its text on tap.

| Chip label              | Input text                                                      |
|-------------------------|-----------------------------------------------------------------|
| Today's transit read    | `Give me my transit read for today.`                            |
| Read my chart           | `Give me an overview reading of my birth chart.`                |
| Current life phase      | `What's the major theme of my current dasha period?`            |
| Year ahead              | `What does the year ahead look like for me?`                    |

## Context wiring (key simplification)

The `chat` system prompt already enables **all tools** (`get_today_transit`, `get_dasha`,
`get_varshaphal`, divisional charts, etc.). Therefore the template prompts do **not** need to
pre-attach `formatTransitContext` / `formatChartContext` — the agent calls the right tool when
the prompt asks for it. This removes the on-load compute the old Today tab needed.

The chart **visual** in the right panel still renders only `activeProfile.chart` (already
computed at onboarding) — it is pure display, no LLM call.

## Agent ↔ UI parity (CLAUDE.md rule)

- Everything the chart panel shows (natal/varga placements, dasha, yogas, doshas) the agent
  can fetch via its existing tools (`get_divisional`, `get_dasha`, `get_yogas`, `get_doshas`).
  Nothing visible becomes unreachable.
- Removing the dedicated `today` / `chart` tab *framing instructions* is fine: the `chat`
  prompt has full tool access, and the template prompts carry the user intent. No new
  computation is added, so no new formatter/tool is required.

## Files

**New**
- `src/components/Kundli/ChartPanel.jsx` — chart visual extracted from `ChartTab`: varga tab
  row, `KundliChart`, and the dasha/yoga/dosha pills. Props: `profile`. Pure display.
- `src/components/Chat/TemplatePrompts.jsx` — the chip row. Props: `onPick(text)`. Renders the
  four prompts above; horizontally scrollable on narrow screens.

**Rewrite**
- `src/components/Tabs/ChatTab.jsx` — wrap the existing chat in a two-column responsive layout;
  add panel-collapse state + toggle button (in `ChatToolbar` or adjacent); render
  `TemplatePrompts` inside the empty state (via `ChatGreeting` or alongside it); wire chip
  taps to fill the input through the existing `injectText` mechanism.

**Edit**
- `src/components/Chat/ChatGreeting.jsx` — accept and render `TemplatePrompts` (or ChatTab
  composes greeting + chips in the `emptyState` prop passed to `ChatMessages`).
- `src/components/TabBar/TabBar.jsx` — remove `today` and `chart` entries.
- `src/components/TabBar/BottomNav.jsx` — remove `today` and `chart` entries.
- `src/pages/MainApp.jsx` — remove `TodayTab` / `ChartTab` imports and `TAB_COMPONENTS`
  entries.

**Delete**
- `src/components/Tabs/TodayTab.jsx`
- `src/components/Tabs/ChartTab.jsx`

**Keep unchanged**
- `src/lib/llm/tabConfig.js` — leave the `today` / `chart` config entries. They are no longer
  reached from the UI but are still exercised by unit tests (`tabConfig.test.js`,
  `systemPrompt.test.js`) and are harmless. (The `ChatToolbar` toggle does not depend on them.)

## Testing

- Unit tests referencing `today`/`chart` as *prompt tab keys* (`tabConfig.test.js`,
  `systemPrompt.test.js`) keep passing because those config entries remain.
- Any e2e/Playwright test that navigates to the Today or Chart **tab** must be updated to the
  merged view (chart panel toggle, template chips) or removed.
- Add a small unit test for `TemplatePrompts` (renders 4 chips, `onPick` fires with the right
  text).
- Before merge: `npx vitest run`, `npm run lint` (0 errors), `npm run build`, and the Python
  suite (`.venv-test/bin/python -m pytest tests/python`) for no regressions.

## Out of scope

- Migrating old `today` / `chart` chat histories into the `chat` thread.
- Any change to the Numbers or Match tabs.
- Restyling the Kundli chart itself.
