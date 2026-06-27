# Merge Chat + Chart + Today Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the Chat, Chart, and Today tabs into one view — chat centered, a collapsible chart panel on the right, and Today as a starter template prompt shown when the chat is empty.

**Architecture:** Extract the Chart tab's visual into a reusable `ChartPanel` (pure display of `activeProfile.chart`). Rewrite `ChatTab` into a two-column responsive layout: chat in the middle, `ChartPanel` in a collapsible right column (above-chat on mobile). Add a `TemplatePrompts` chip row rendered only in the empty-chat state; tapping a chip fills the input via the existing `injectText` mechanism. Delete `TodayTab` and `ChartTab` and drop their tab-bar entries.

**Tech Stack:** React (function components + hooks), Tailwind CSS, Vitest + Testing Library, existing `useChat` / `useChatThread` hooks.

## Global Constraints

- Single conversation thread: the merged view uses the `'chat'` thread and `chat` system prompt. Do NOT add per-day auto-compute.
- Chart panel and template prompts must surface only already-computed data; the agent reaches the same via its tools (CLAUDE.md agent↔UI parity). Do NOT add new Python compute, tools, or formatters.
- `src/lib/llm/tabConfig.js` `today`/`chart` entries stay (used by unit tests); do not delete them.
- Tapping a template chip FILLS the input (no auto-send).
- Template chips appear ONLY when the chat is empty.
- Before merge: `npx vitest run`, `npm run lint` (0 errors), `npm run build`, and `.venv-test/bin/python -m pytest tests/python` all green.
- Follow existing file conventions: leading `// src/path/File.jsx` comment, Tailwind utility classes, no new deps.

---

### Task 1: Extract `ChartPanel` from `ChartTab`

Pulls the chart visual (varga selector, Kundli grid, dasha/yoga/dosha pills) out of `ChartTab` into a standalone display component, so the merged view can render it in the right panel. No chat logic — pure display of `profile.chart`.

**Files:**
- Create: `src/components/Kundli/ChartPanel.jsx`
- Create (test): `tests/components/ChartPanel.test.jsx`
- Reference (do not modify yet): `src/components/Tabs/ChartTab.jsx:16-108`

**Interfaces:**
- Consumes: `KundliChart` (`{ chart, size }`), `activeMahadasha(chart)` from `src/lib/prompts/formatters`.
- Produces: `export default function ChartPanel({ profile })` — renders the varga tabs + `KundliChart` + dasha/yoga/dosha pills. Returns `null` when `profile?.chart` is absent.

- [ ] **Step 1: Write the failing test**

```jsx
// tests/components/ChartPanel.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ChartPanel from '../../src/components/Kundli/ChartPanel'

const profile = {
  chart: {
    d1Chart: { houses: [{ number: 1, sign: 'Virgo', occupants: [] }] },
    divisionalCharts: { d9: { houses: [{ number: 1, sign: 'Aries', occupants: [] }] } },
  },
  yogas: [{ name: 'Gajakesari' }],
  doshas: { mangal: { present: true } },
}

describe('ChartPanel', () => {
  it('returns nothing when no chart', () => {
    const { container } = render(<ChartPanel profile={{}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a varga tab per computed divisional plus D1', () => {
    render(<ChartPanel profile={profile} />)
    expect(screen.getByRole('button', { name: 'D1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'D9' })).toBeInTheDocument()
  })

  it('shows yogas and doshas', () => {
    render(<ChartPanel profile={profile} />)
    expect(screen.getByText('Gajakesari')).toBeInTheDocument()
    expect(screen.getByText('mangal')).toBeInTheDocument()
  })

  it('switches the active varga on tab click', () => {
    render(<ChartPanel profile={profile} />)
    fireEvent.click(screen.getByRole('button', { name: 'D9' }))
    expect(screen.getByText('D9').className).toContain('bg-primary')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/ChartPanel.test.jsx`
Expected: FAIL — cannot resolve `../../src/components/Kundli/ChartPanel`.

- [ ] **Step 3: Write `ChartPanel`**

Move the JSX/state from `ChartTab.jsx:16-108` verbatim, dropping all chat/toolbar/`useChat` parts. Keep the `VARGA_NAMES` map and the data-driven varga list.

```jsx
// src/components/Kundli/ChartPanel.jsx
import { useState } from 'react'
import { activeMahadasha } from '../../lib/prompts/formatters'
import KundliChart from './KundliChart'

// What each varga is traditionally read for — labels whatever the engine actually computed.
// Unknown ids fall back to their bare "Dn" label, so the UI mirrors the data exactly.
const VARGA_NAMES = {
  d1: 'Rasi — overall life',
  d2: 'Hora — wealth',
  d3: 'Drekkana — siblings & courage',
  d4: 'Chaturthamsa — property & fortune',
  d7: 'Saptamsa — children',
  d9: 'Navamsa — marriage & dharma',
  d10: 'Dasamsa — career',
  d12: 'Dwadasamsa — parents & lineage',
  d16: 'Shodasamsa — vehicles & comforts',
  d20: 'Vimsamsa — spiritual life',
  d24: 'Chaturvimsamsa — education',
  d27: 'Bhamsa — strengths & weaknesses',
  d30: 'Trimsamsa — adversity & health',
  d40: 'Khavedamsa — maternal legacy',
  d45: 'Akshavedamsa — paternal legacy',
  d60: 'Shashtiamsa — fine detail & past karma',
}

export default function ChartPanel({ profile }) {
  const [varga, setVarga] = useState('d1')
  const chart = profile?.chart
  const yogas = profile?.yogas ?? []
  const doshas = profile?.doshas ?? {}

  // Build the varga list straight from what was computed — D1 plus every divisional present.
  const dvKeys = Object.keys(chart?.divisionalCharts ?? {})
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  const vargas = ['d1', ...dvKeys].map(id => ({ id, label: id.toUpperCase(), name: VARGA_NAMES[id] ?? id.toUpperCase() }))
  const activeVarga = vargas.find(v => v.id === varga) ?? vargas[0]
  const vargaChart = activeVarga.id === 'd1' ? chart : chart?.divisionalCharts?.[activeVarga.id]

  if (!chart) return null

  return (
    <div className="p-4 overflow-y-auto">
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
        {vargas.map(v => (
          <button key={v.id} onClick={() => setVarga(v.id)} title={v.name}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
              activeVarga.id === v.id ? 'bg-primary text-white' : 'bg-surface border border-border text-muted hover:border-border-strong'
            }`}>
            {v.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted text-center mb-2">{activeVarga.name}</p>

      {(vargaChart?.d1Chart?.houses || vargaChart?.houses)
        ? <KundliChart chart={vargaChart} />
        : <p className="text-sm text-muted text-center py-4">{activeVarga.label} chart not available</p>}

      <div className="mt-4 flex flex-col gap-2 text-sm">
        {(() => {
          const dasha = activeMahadasha(chart)
          return dasha ? (
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-muted text-xs uppercase tracking-wide font-semibold">Dasha:</span>
              <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-border text-text-2 text-xs">
                {dasha.mdLord}{dasha.adLord ? ` › ${dasha.adLord}` : ''}
              </span>
            </div>
          ) : null
        })()}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-muted text-xs uppercase tracking-wide font-semibold">Yogas:</span>
          {yogas.length ? yogas.slice(0, 5).map((y, i) => (
            <span key={y.name ?? y ?? i} className="px-2 py-0.5 rounded-full bg-primary-light text-primary text-xs">{y.name ?? y}</span>
          )) : <span className="text-muted text-xs">None detected</span>}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-muted text-xs uppercase tracking-wide font-semibold">Doshas:</span>
          {Object.entries(doshas).filter(([, v]) => v?.present).map(([k]) => (
            <span key={k} className="px-2 py-0.5 rounded-full bg-surface-2 border border-border text-text-2 text-xs capitalize">{k}</span>
          ))}
          {!Object.values(doshas).some(v => v?.present) && <span className="text-muted text-xs">None</span>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/ChartPanel.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Kundli/ChartPanel.jsx tests/components/ChartPanel.test.jsx
git commit -m "feat(chart): extract ChartPanel display component from ChartTab"
```

---

### Task 2: `TemplatePrompts` chip row

A small presentational component: four starter-prompt chips. Tapping one calls `onPick(text)`. Used inside the empty-chat state.

**Files:**
- Create: `src/components/Chat/TemplatePrompts.jsx`
- Create (test): `tests/components/TemplatePrompts.test.jsx`

**Interfaces:**
- Produces: `export default function TemplatePrompts({ onPick })` where `onPick: (text: string) => void`. Also `export const TEMPLATE_PROMPTS` — an array of `{ label, text }`.

- [ ] **Step 1: Write the failing test**

```jsx
// tests/components/TemplatePrompts.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TemplatePrompts, { TEMPLATE_PROMPTS } from '../../src/components/Chat/TemplatePrompts'

describe('TemplatePrompts', () => {
  it('exposes four prompts', () => {
    expect(TEMPLATE_PROMPTS).toHaveLength(4)
    expect(TEMPLATE_PROMPTS[0]).toEqual({ label: "Today's transit read", text: 'Give me my transit read for today.' })
  })

  it('renders a chip per prompt', () => {
    render(<TemplatePrompts onPick={() => {}} />)
    expect(screen.getByRole('button', { name: "Today's transit read" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Read my chart' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Current life phase' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Year ahead' })).toBeInTheDocument()
  })

  it('calls onPick with the prompt text when a chip is tapped', () => {
    const onPick = vi.fn()
    render(<TemplatePrompts onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Year ahead' }))
    expect(onPick).toHaveBeenCalledWith('What does the year ahead look like for me?')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/TemplatePrompts.test.jsx`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write `TemplatePrompts`**

```jsx
// src/components/Chat/TemplatePrompts.jsx
// Starter prompts shown only in the empty-chat state. Tapping a chip fills the input
// (via the parent's injectText wiring) so the user can edit before sending.
export const TEMPLATE_PROMPTS = [
  { label: "Today's transit read", text: 'Give me my transit read for today.' },
  { label: 'Read my chart', text: 'Give me an overview reading of my birth chart.' },
  { label: 'Current life phase', text: "What's the major theme of my current dasha period?" },
  { label: 'Year ahead', text: 'What does the year ahead look like for me?' },
]

export default function TemplatePrompts({ onPick }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {TEMPLATE_PROMPTS.map(p => (
        <button key={p.label} onClick={() => onPick(p.text)}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface border border-border text-text hover:border-primary hover:text-primary transition-colors">
          {p.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/TemplatePrompts.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Chat/TemplatePrompts.jsx tests/components/TemplatePrompts.test.jsx
git commit -m "feat(chat): add TemplatePrompts starter-chip row"
```

---

### Task 3: Rewrite `ChatTab` as the merged two-column view

Wrap the existing chat in a responsive two-column layout, add the collapsible `ChartPanel`, and render `TemplatePrompts` in the empty state wired to fill the input. All existing chat/voice behavior is preserved.

**Files:**
- Modify: `src/components/Tabs/ChatTab.jsx` (full rewrite of the render + a little state)

**Interfaces:**
- Consumes: `ChartPanel` (`{ profile }`) from Task 1, `TemplatePrompts` (`{ onPick }`) from Task 2, existing `ChatGreeting`, `ChatMessages` (`emptyState` prop), `ChatInput` (`injectText` prop), `ChatToolbar` (`extraControls` prop).
- Produces: the default-exported `ChatTab` view rendered by `MainApp` for the `chat` tab.

- [ ] **Step 1: Add panel-toggle state and template-fill wiring**

In `ChatTab.jsx`, add a collapse state near the other `useState` hooks (after the `speakingId` state, around line 25):

```jsx
  // Right-side chart panel: collapsible (desktop) / above-chat section (mobile).
  const [chartOpen, setChartOpen] = useState(true)
```

The component already has `micInject` / `setMicInject` (line 23) feeding `ChatInput`'s `injectText`. Reuse it for template chips — a chip pick is just another input injection:

```jsx
  const handlePickPrompt = useCallback(text => setMicInject(text), [])
```

Add this `useCallback` next to the other callbacks (after `handleMicToggle`, ~line 75). `useCallback` is already imported.

- [ ] **Step 2: Replace the return block**

Replace the entire `return ( ... )` (lines 79–106) with the two-column layout. The middle column is the unchanged chat; the right column is `ChartPanel`. `ChatGreeting` + `TemplatePrompts` become the `emptyState`. The toggle button goes in `ChatToolbar`'s `extraControls`.

```jsx
  if (!activeProfile) return <div className="flex-1 flex items-center justify-center text-muted text-sm">No profile selected</div>

  const hasChart = !!activeProfile.chart
  const emptyState = (
    <div className="flex flex-col items-start gap-1">
      <ChatGreeting name={activeProfile.name} />
      <TemplatePrompts onPick={handlePickPrompt} />
    </div>
  )

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0">
      {/* Chart panel: above chat on mobile, right column on desktop. Collapsible. */}
      {hasChart && chartOpen && (
        <div className="order-first md:order-last flex-shrink-0 border-b md:border-b-0 md:border-l border-border bg-surface
                        max-h-[40%] md:max-h-none md:h-full md:w-[340px] overflow-y-auto">
          <ChartPanel profile={activeProfile} />
        </div>
      )}

      {/* Chat column */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <ChatToolbar title="Chat" onRefresh={reload} onClear={clearChat}
          refreshDisabled={busy} clearDisabled={busy || messages.length === 0}
          ttsSupported={tts.supported} autoSpeak={tts.autoSpeak} speaking={tts.speaking}
          onToggleAutoSpeak={() => tts.setAutoSpeak(!tts.autoSpeak)}
          voices={tts.voices} voice={tts.voice}
          onSelectVoice={uri => tts.setVoice(tts.voices.find(v => v.voiceURI === uri))}
          voiceSupported={voice.supported} handsFree={voice.handsFree}
          onToggleHandsFree={voice.toggleHandsFree}
          extraControls={hasChart && (
            <button onClick={() => setChartOpen(o => !o)} title={chartOpen ? 'Hide chart' : 'Show chart'}
              className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors">
              {chartOpen ? '🪐' : '☆'}
            </button>
          )} />
        <ChatMessages messages={messages} streaming={busy} streamingContent={streamingContent} streamingTools={liveTools}
          emptyState={emptyState}
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
    </div>
  )
```

- [ ] **Step 3: Add the new imports**

At the top of `ChatTab.jsx`, add alongside the existing component imports (after the `ChatToolbar` import, line 13):

```jsx
import ChartPanel from '../Kundli/ChartPanel'
import TemplatePrompts from './TemplatePrompts'
```

- [ ] **Step 4: Lint and build**

Run: `npm run lint`
Expected: 0 errors (no unused imports — confirm `ChatGreeting` is still used; it is, inside `emptyState`).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/Tabs/ChatTab.jsx
git commit -m "feat(chat): merged two-column view with collapsible chart panel and starter prompts"
```

---

### Task 4: Remove Today and Chart tabs from navigation

Drop the standalone tabs now that their content lives in the merged view. Delete the components and their tab-bar/nav/MainApp wiring.

**Files:**
- Modify: `src/components/TabBar/TabBar.jsx:2-8`
- Modify: `src/components/TabBar/BottomNav.jsx:2-8`
- Modify: `src/pages/MainApp.jsx:7-23`
- Delete: `src/components/Tabs/TodayTab.jsx`
- Delete: `src/components/Tabs/ChartTab.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: tab set reduced to `chat`, `numbers`, `match`.

- [ ] **Step 1: Trim `TabBar` entries**

In `src/components/TabBar/TabBar.jsx`, replace the `TABS` array:

```jsx
const TABS = [
  { id: 'chat', label: 'Chat' },
  { id: 'numbers', label: 'Numbers' },
  { id: 'match', label: 'Match' },
]
```

- [ ] **Step 2: Trim `BottomNav` entries**

In `src/components/TabBar/BottomNav.jsx`, replace the `TABS` array:

```jsx
const TABS = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'numbers', label: 'Numbers', icon: '✨' },
  { id: 'match', label: 'Match', icon: '❤️' },
]
```

- [ ] **Step 3: Remove imports + components from `MainApp`**

In `src/pages/MainApp.jsx`, delete the two import lines:

```jsx
import TodayTab from '../components/Tabs/TodayTab'
import ChartTab from '../components/Tabs/ChartTab'
```

and reduce `TAB_COMPONENTS` to:

```jsx
const TAB_COMPONENTS = {
  chat: ChatTab,
  numbers: NumbersTab,
  match: MatchTab,
}
```

- [ ] **Step 4: Delete the two tab files**

```bash
git rm src/components/Tabs/TodayTab.jsx src/components/Tabs/ChartTab.jsx
```

- [ ] **Step 5: Lint and build**

Run: `npm run lint`
Expected: 0 errors (no dangling references to TodayTab/ChartTab).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/TabBar/TabBar.jsx src/components/TabBar/BottomNav.jsx src/pages/MainApp.jsx
git commit -m "feat(nav): remove Today and Chart tabs; merged into Chat view"
```

---

### Task 5: Update affected e2e / integration tests and full green

Find and fix any test that navigates to the Today or Chart tab, then run the whole suite.

**Files:**
- Modify: any file under `tests/` matching a Today/Chart tab navigation (discover in Step 1).

**Interfaces:**
- Consumes: nothing new.
- Produces: a fully green test suite.

- [ ] **Step 1: Find references to the removed tabs in tests**

Run:
```bash
grep -rn "Today\b\|Chart\b\|getByText('Today')\|getByText('Chart')\|/chart\|/today" tests e2e 2>/dev/null | grep -vi "ChartPanel\|KundliChart\|chartContext\|formatChart" || echo "none"
```
Expected: a list of test lines (likely Playwright specs clicking the Today/Chart tab), or `none`.

- [ ] **Step 2: Fix each hit**

For each test that clicks a `Today` or `Chart` tab button: either delete the navigation (the content now lives in the Chat view — assert against the chart panel toggle or a template chip instead), or remove the obsolete assertion. Do NOT touch tests that reference `tabConfig`/`systemPrompt` tab *keys* (those still pass). Apply the minimal edit that reflects the merged UI.

- [ ] **Step 3: Run the JS suite**

Run: `npx vitest run`
Expected: PASS (including the two new component tests).

- [ ] **Step 4: Run lint, build, and the Python suite**

Run: `npm run lint` → 0 errors.
Run: `npm run build` → succeeds.
Run: `.venv-test/bin/python -m pytest tests/python` → PASS (no Python touched; confirms no regression).

- [ ] **Step 5: Run e2e if present**

Run: `npx playwright test`
Expected: PASS. If a spec still fails on removed-tab navigation, return to Step 2.

- [ ] **Step 6: Commit**

```bash
git add tests e2e
git commit -m "test: update tab tests for merged Chat/Chart/Today view"
```

---

## Self-Review

**Spec coverage:**
- Two-column layout, chat centered → Task 3. ✅
- Collapsible chart panel (desktop) / above-chat (mobile) → Task 1 (component) + Task 3 (layout + toggle). ✅
- Today as template prompt, chips only when empty, fill-input behavior → Task 2 + Task 3 (`emptyState` + `handlePickPrompt`). ✅
- Single `'chat'` thread, no auto-compute → Task 3 reuses the existing `chat` `useChat`/`useChatThread`; the old per-day effect lives only in deleted `TodayTab` (Task 4). ✅
- Four template prompts with exact text → Task 2 `TEMPLATE_PROMPTS`. ✅
- Remove Today/Chart tabs, delete files, keep `tabConfig` entries → Task 4 (delete) + Global Constraints (keep config). ✅
- Agent↔UI parity, no new compute → Global Constraints; panel is display-only. ✅
- Tests green incl. Python → Task 5. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code. Step 2 of Task 5 is intentionally discovery-driven (can't know test file paths until grep runs) but gives an exact rule for the edit. ✅

**Type consistency:** `ChartPanel({ profile })`, `TemplatePrompts({ onPick })` + `TEMPLATE_PROMPTS`, `handlePickPrompt(text) → setMicInject(text)`, `chartOpen`/`setChartOpen` — names match across Tasks 1–3. `extraControls`, `injectText`, `emptyState` prop names verified against the existing `ChatToolbar`/`ChatInput`/`ChatMessages` signatures. ✅
