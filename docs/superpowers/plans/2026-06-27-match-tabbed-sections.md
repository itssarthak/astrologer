# Tabbed Match View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the five stacked sections of the computed Match card behind a 4-tab strip (Compatibility / Planets / Numerology / Read) so the user sees one category at a time.

**Architecture:** Extract the inline sections of the 300-line `MatchTab.jsx` into focused display-only components under `src/components/Tabs/Match/`, with a `MatchResultCard` that owns the tab strip and active-tab state. `MatchTab` keeps compute/chat orchestration and renders `<MatchResultCard>`. Pure presentational change — no compute, formatter, or LLM-context edits.

**Tech Stack:** React (function components + hooks), Tailwind CSS, Vitest + @testing-library/react, Playwright e2e.

## Global Constraints

- Pure presentational change: do NOT touch synastry/numerology computation, `formatSynastryContext`, `formatNumerologyMatchContext`, or any LLM context. (Agent↔UI parity — all five data groups stay on screen, one tab at a time.)
- Tab strip style = the Chart varga-selector pill style: active `bg-primary text-white`; inactive `bg-surface border border-border text-muted hover:border-border-strong`; row is `flex gap-1.5 overflow-x-auto`.
- Tabs render ONLY when `synastryData` exists. Partner selector + compute button + `computeError` stay above, unchanged.
- Default active tab on a fresh compute = `Compatibility`. A new `synastryData` identity resets it.
- Card height: change `max-h-[55%]` → `max-h-[45%]`. Remove the separate Read band (its content moves into the Read tab).
- Read tab: while `generatingRead`, show streaming `read` via `<Markdown>` with `'...'` placeholder; the Read tab LABEL shows a generating hint (pulsing dot) while `generatingRead`.
- No new dependencies. Follow existing conventions: leading `// src/path/File.jsx` comment, Tailwind classes.
- Message shape in the thread is `{ role: 'user'|'assistant', content: string }`.
- Before merge: `npx vitest run`, `npm run lint` (0 errors), `npm run build`, `.venv-test/bin/python -m pytest tests/python` all green.

---

### Task 1: Extract shared Match primitives

Move the small shared render helpers + constants out of `MatchTab.jsx` into one module so the new section components can import them without duplication. `MatchTab.jsx` will import them back in this task (no behavior change yet).

**Files:**
- Create: `src/components/Tabs/Match/matchPrimitives.jsx`
- Create (test): `tests/components/matchPrimitives.test.jsx`
- Modify: `src/components/Tabs/MatchTab.jsx` (remove the moved definitions, import them instead)

**Interfaces:**
- Produces (all named exports from `matchPrimitives.jsx`):
  - `EFFECT_TEXT`, `EFFECT_DOT`, `LEAN_BADGE` — class-name maps (objects).
  - `GUNA_ATTRS` — array of `[key, label]` pairs.
  - `FactorRow({ text, effect })` — a bullet row.
  - `OverlayRow({ o })` — a planetary-overlay row.
  - `OverlaySection({ title, overlays })` — filters to non-neutral, shows up to 5, "+N more".

- [ ] **Step 1: Write the failing test**

```jsx
// tests/components/matchPrimitives.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FactorRow, OverlaySection, GUNA_ATTRS } from '../../src/components/Tabs/Match/matchPrimitives'

describe('matchPrimitives', () => {
  it('FactorRow renders its text', () => {
    render(<FactorRow text="Sun trine Moon" effect="supportive" />)
    expect(screen.getByText('Sun trine Moon')).toBeInTheDocument()
  })

  it('OverlaySection shows only non-neutral overlays, capped at 5 with a +N more', () => {
    const overlays = [
      ...Array.from({ length: 6 }, (_, i) => ({ planet: `P${i}`, falls_in_house: i + 1, house_meaning: 'x', effect: 'supportive' })),
      { planet: 'Q', falls_in_house: 2, house_meaning: 'y', effect: 'neutral' },
    ]
    render(<OverlaySection title="A → B" overlays={overlays} />)
    expect(screen.getByText('A → B')).toBeInTheDocument()
    expect(screen.getByText('+1 more')).toBeInTheDocument() // 6 non-neutral, 5 shown
  })

  it('OverlaySection shows a fallback when nothing is notable', () => {
    render(<OverlaySection title="A → B" overlays={[{ planet: 'P', falls_in_house: 1, house_meaning: 'x', effect: 'neutral' }]} />)
    expect(screen.getByText(/Mostly neutral/)).toBeInTheDocument()
  })

  it('GUNA_ATTRS lists the eight koota attributes', () => {
    expect(GUNA_ATTRS.map(([k]) => k)).toEqual(
      ['varna', 'vashya', 'yoni', 'sign_lord', 'gana', 'nadi', 'moon_sign', 'nakshatra'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/matchPrimitives.test.jsx`
Expected: FAIL — cannot resolve `../../src/components/Tabs/Match/matchPrimitives`.

- [ ] **Step 3: Create `matchPrimitives.jsx`**

Move these verbatim from `MatchTab.jsx` (current lines 17–65): `EFFECT_TEXT`, `EFFECT_DOT`, `LEAN_BADGE`, `GUNA_ATTRS`, `FactorRow`, `OverlayRow`, `OverlaySection`. Export each.

```jsx
// src/components/Tabs/Match/matchPrimitives.jsx
// Shared display helpers + class maps for the Match result sections.
export const EFFECT_TEXT = { supportive: 'text-green-700', challenging: 'text-red-600', neutral: 'text-muted' }
export const EFFECT_DOT = { supportive: 'bg-green-600', challenging: 'bg-red-500', neutral: 'bg-border-strong' }
export const LEAN_BADGE = {
  harmonious: 'bg-green-100 text-green-700',
  challenging: 'bg-red-100 text-red-600',
  mixed: 'bg-surface-2 text-text-2',
}

// Per-person guna attributes shown under the Guna Milan score, in koota order.
export const GUNA_ATTRS = [
  ['varna', 'Varna'], ['vashya', 'Vashya'], ['yoni', 'Yoni'],
  ['sign_lord', 'Sign lord'], ['gana', 'Gana'], ['nadi', 'Nadi'],
  ['moon_sign', 'Moon'], ['nakshatra', 'Nakshatra'],
]

export function FactorRow({ text, effect }) {
  return (
    <div className="flex items-start gap-2 text-xs leading-snug">
      <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${EFFECT_DOT[effect]}`} />
      <span className="text-text-2">{text}</span>
    </div>
  )
}

export function OverlayRow({ o }) {
  return (
    <div className="flex items-start gap-2 text-xs leading-snug">
      <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${EFFECT_DOT[o.effect]}`} />
      <span className="text-text-2">
        <span className="font-medium">{o.planet}</span> → their H{o.falls_in_house} ({o.house_meaning})
        <span className={`ml-1 ${EFFECT_TEXT[o.effect]}`}>· {o.effect}</span>
      </span>
    </div>
  )
}

export function OverlaySection({ title, overlays }) {
  const notable = overlays.filter(o => o.effect !== 'neutral')
  const shown = notable.slice(0, 5)
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-text-2">{title}</p>
      {shown.length
        ? shown.map((o, i) => <OverlayRow key={i} o={o} />)
        : <p className="text-xs text-muted">Mostly neutral — no strong pulls either way.</p>}
      {notable.length > shown.length && <p className="text-xs text-muted">+{notable.length - shown.length} more</p>}
    </div>
  )
}
```

- [ ] **Step 4: Update `MatchTab.jsx` to import them**

In `src/components/Tabs/MatchTab.jsx`, DELETE the now-moved definitions (the current lines 17–65: the three class maps, `GUNA_ATTRS`, `FactorRow`, `OverlayRow`, `OverlaySection`) and add this import alongside the other component imports (after the `LoadingSpinner` import):

```jsx
import { EFFECT_TEXT, EFFECT_DOT, LEAN_BADGE, GUNA_ATTRS, FactorRow, OverlayRow, OverlaySection } from './Match/matchPrimitives'
```

(Leave the rest of `MatchTab.jsx` untouched in this task — it still references these names, now imported. `EFFECT_TEXT`/`EFFECT_DOT`/`OverlayRow` may become unused-in-this-file after later tasks; that is fine for now, but if lint flags an unused import in THIS task, import only the names still referenced in `MatchTab.jsx` after the deletion — currently `LEAN_BADGE`, `GUNA_ATTRS`, `FactorRow`, `OverlaySection` are used directly in the JSX, and `EFFECT_TEXT`/`EFFECT_DOT`/`OverlayRow` are used only inside the moved helpers. Import the four that the file actually uses.)

- [ ] **Step 5: Run tests + lint**

Run: `npx vitest run tests/components/matchPrimitives.test.jsx`
Expected: PASS (4 tests).
Run: `npm run lint`
Expected: 0 errors (no unused imports in `MatchTab.jsx`).

- [ ] **Step 6: Commit**

```bash
git add src/components/Tabs/Match/matchPrimitives.jsx tests/components/matchPrimitives.test.jsx src/components/Tabs/MatchTab.jsx
git commit -m "refactor(match): extract shared match primitives into Match/matchPrimitives"
```

---

### Task 2: Section components (Guna / Currents / Planets / Marriage)

Extract the four computed-data sections from `MatchTab.jsx`'s inline JSX into standalone display components. Each is pure (props in, JSX out) and returns null when its data is absent. `MatchTab.jsx` is NOT rewired in this task — that happens in Task 4 — so `MatchTab` keeps rendering its inline sections for now; this task only ADDS the components + their tests.

**Files:**
- Create: `src/components/Tabs/Match/GunaMilanSection.jsx`
- Create: `src/components/Tabs/Match/StrongestCurrentsSection.jsx`
- Create: `src/components/Tabs/Match/PlanetaryOverlaysSection.jsx`
- Create: `src/components/Tabs/Match/MarriageSection.jsx`
- Create (test): `tests/components/matchSections.test.jsx`

**Interfaces:**
- Consumes: `matchPrimitives` exports from Task 1.
- Produces:
  - `GunaMilanSection({ guna, activeProfile, partnerProfile })` — default export.
  - `StrongestCurrentsSection({ synastryData })` — default export; returns null if both `top_supportive` and `top_challenging` are empty.
  - `PlanetaryOverlaysSection({ synastryData, summary, activeProfile, partnerProfile })` — default export; returns null if `summary` is falsy.
  - `MarriageSection({ synastryData, activeProfile, partnerProfile })` — default export; returns null if `synastryData.marriage_factors` is falsy.

- [ ] **Step 1: Write the failing test**

```jsx
// tests/components/matchSections.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import GunaMilanSection from '../../src/components/Tabs/Match/GunaMilanSection'
import StrongestCurrentsSection from '../../src/components/Tabs/Match/StrongestCurrentsSection'
import PlanetaryOverlaysSection from '../../src/components/Tabs/Match/PlanetaryOverlaysSection'
import MarriageSection from '../../src/components/Tabs/Match/MarriageSection'

const A = { name: 'Asha' }
const B = { name: 'Bibek' }
const guna = {
  total: 28, verdict: 'Good',
  breakdown: { varna: { score: 1, max: 1 }, nadi: { score: 8, max: 8 } },
  profiles: {
    a: { varna: 'Brahmin', vashya: 'Nara', yoni: 'Horse', sign_lord: 'Mars', gana: 'Deva', nadi: 'Aadi', moon_sign: 'Aries', nakshatra: 'Ashwini' },
    b: { varna: 'Kshatriya', vashya: 'Jalachara', yoni: 'Elephant', sign_lord: 'Venus', gana: 'Manava', nadi: 'Madhya', moon_sign: 'Taurus', nakshatra: 'Rohini' },
  },
}
const synastry = {
  top_supportive: ['Venus supports affection'],
  top_challenging: ['Saturn slows things'],
  overlay_summary: { lean: 'mixed', supportive: 3, challenging: 2, neutral: 5 },
  a_planets_in_b_houses: [{ planet: 'Venus', falls_in_house: 7, house_meaning: 'partnership', effect: 'supportive' }],
  b_planets_in_a_houses: [{ planet: 'Mars', falls_in_house: 1, house_meaning: 'self', effect: 'challenging' }],
  marriage_factors: { a: { summary: 'A summary' }, b: { summary: 'B summary' } },
  dasha_overlap: { note: 'Both in Venus periods' },
}

describe('Match sections', () => {
  it('GunaMilanSection shows the score and a koota + per-person attrs', () => {
    render(<GunaMilanSection guna={guna} activeProfile={A} partnerProfile={B} />)
    expect(screen.getByText('Guna Milan')).toBeInTheDocument()
    expect(screen.getByText('/36')).toBeInTheDocument()
    expect(screen.getByText('Brahmin')).toBeInTheDocument()
    expect(screen.getByText('Kshatriya')).toBeInTheDocument()
  })

  it('StrongestCurrentsSection lists supportive and challenging factors, null when empty', () => {
    const { container, rerender } = render(<StrongestCurrentsSection synastryData={synastry} />)
    expect(screen.getByText('Venus supports affection')).toBeInTheDocument()
    expect(screen.getByText('Saturn slows things')).toBeInTheDocument()
    rerender(<StrongestCurrentsSection synastryData={{ top_supportive: [], top_challenging: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('PlanetaryOverlaysSection shows lean + counts + both overlay lists, null without summary', () => {
    const { container, rerender } = render(
      <PlanetaryOverlaysSection synastryData={synastry} summary={synastry.overlay_summary} activeProfile={A} partnerProfile={B} />)
    expect(screen.getByText('Planetary compatibility')).toBeInTheDocument()
    expect(screen.getByText(/3 supportive/)).toBeInTheDocument()
    expect(screen.getByText('Asha → Bibek')).toBeInTheDocument()
    rerender(<PlanetaryOverlaysSection synastryData={synastry} summary={null} activeProfile={A} partnerProfile={B} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('MarriageSection shows per-person summaries + current period, null without marriage_factors', () => {
    const { container, rerender } = render(<MarriageSection synastryData={synastry} activeProfile={A} partnerProfile={B} />)
    expect(screen.getByText('Marriage significators')).toBeInTheDocument()
    expect(screen.getByText('A summary')).toBeInTheDocument()
    expect(screen.getByText(/Both in Venus periods/)).toBeInTheDocument()
    rerender(<MarriageSection synastryData={{}} activeProfile={A} partnerProfile={B} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/matchSections.test.jsx`
Expected: FAIL — cannot resolve the four new modules.

- [ ] **Step 3: Create `GunaMilanSection.jsx`**

Lift the Guna block from `MatchTab.jsx` (current lines 195–228), wrapped as a component. No `border-t` on the root (it's the first thing in the Compatibility tab).

```jsx
// src/components/Tabs/Match/GunaMilanSection.jsx
import { GUNA_ATTRS } from './matchPrimitives'

export default function GunaMilanSection({ guna, activeProfile, partnerProfile }) {
  if (!guna) return null
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-text">Guna Milan</span>
        <span className="text-2xl font-bold text-primary">
          {guna.total ?? '—'}<span className="text-sm text-muted font-normal">/36</span>
          <span className="ml-2 text-xs text-muted font-medium">{guna.verdict}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2">
        {Object.entries(guna.breakdown ?? {}).map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs text-muted">
            <span className="capitalize">{k.replace(/_/g, ' ')}</span>
            <span className="font-medium text-text-2">{v.score}/{v.max}</span>
          </div>
        ))}
      </div>

      {guna.profiles && (
        <div className="grid grid-cols-2 gap-x-4 mt-3 pt-2 border-t border-border/60">
          {[[activeProfile?.name, guna.profiles.a], [partnerProfile?.name, guna.profiles.b]].map(([who, p], i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-text-2 truncate">{who}</span>
              {p && GUNA_ATTRS.map(([key, label]) => (
                <div key={key} className="flex justify-between text-[11px] text-muted">
                  <span>{label}</span>
                  <span className="text-text-2">{p[key] ?? '—'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `StrongestCurrentsSection.jsx`**

Lift from `MatchTab.jsx` (current lines 257–267). No `border-t` (the card/tab spacing handles separation).

```jsx
// src/components/Tabs/Match/StrongestCurrentsSection.jsx
import { FactorRow } from './matchPrimitives'

export default function StrongestCurrentsSection({ synastryData }) {
  const sup = synastryData?.top_supportive ?? []
  const chal = synastryData?.top_challenging ?? []
  if (sup.length === 0 && chal.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-text">Strongest currents</span>
      {sup.map((s, i) => <FactorRow key={`s${i}`} text={s} effect="supportive" />)}
      {chal.map((s, i) => <FactorRow key={`c${i}`} text={s} effect="challenging" />)}
    </div>
  )
}
```

- [ ] **Step 5: Create `PlanetaryOverlaysSection.jsx`**

Lift from `MatchTab.jsx` (current lines 231–254). No `border-t` on the root.

```jsx
// src/components/Tabs/Match/PlanetaryOverlaysSection.jsx
import { LEAN_BADGE, OverlaySection } from './matchPrimitives'

export default function PlanetaryOverlaysSection({ synastryData, summary, activeProfile, partnerProfile }) {
  if (!summary) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text">Planetary compatibility</span>
        <span className={`text-xs capitalize px-2 py-0.5 rounded-full font-medium ${LEAN_BADGE[summary.lean] ?? LEAN_BADGE.mixed}`}>
          {summary.lean}
        </span>
      </div>
      <div className="flex gap-3 text-xs">
        <span className="text-green-700">● {summary.supportive} supportive</span>
        <span className="text-red-600">● {summary.challenging} challenging</span>
        <span className="text-muted">● {summary.neutral} neutral</span>
      </div>
      {summary.lean === 'challenging' && (
        <p className="text-xs text-text-2">
          {synastryData.challenging_until
            ? <>Heightened by the current periods — eases after <span className="font-medium">{synastryData.challenging_until}</span>.</>
            : 'A steady feature of the match rather than a passing phase — one to manage.'}
        </p>
      )}
      <OverlaySection title={`${activeProfile.name} → ${partnerProfile?.name}`} overlays={synastryData.a_planets_in_b_houses ?? []} />
      <OverlaySection title={`${partnerProfile?.name} → ${activeProfile.name}`} overlays={synastryData.b_planets_in_a_houses ?? []} />
    </div>
  )
}
```

- [ ] **Step 6: Create `MarriageSection.jsx`**

Lift from `MatchTab.jsx` (current lines 270–283). No `border-t` on the root.

```jsx
// src/components/Tabs/Match/MarriageSection.jsx
export default function MarriageSection({ synastryData, activeProfile, partnerProfile }) {
  if (!synastryData?.marriage_factors) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-text">Marriage significators</span>
      <p className="text-xs text-text-2">
        <span className="font-medium">{activeProfile.name}:</span> {synastryData.marriage_factors.a?.summary ?? '—'}
      </p>
      <p className="text-xs text-text-2">
        <span className="font-medium">{partnerProfile?.name}:</span> {synastryData.marriage_factors.b?.summary ?? '—'}
      </p>
      {synastryData.dasha_overlap?.note && (
        <p className="text-xs text-muted mt-1">Current period: {synastryData.dasha_overlap.note}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/components/matchSections.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add src/components/Tabs/Match/GunaMilanSection.jsx src/components/Tabs/Match/StrongestCurrentsSection.jsx src/components/Tabs/Match/PlanetaryOverlaysSection.jsx src/components/Tabs/Match/MarriageSection.jsx tests/components/matchSections.test.jsx
git commit -m "feat(match): add display-only section components for the result card"
```

---

### Task 3: `MatchResultCard` — the tab strip

The tabbed container: owns active-tab state, renders the pill strip, and shows the active section. Composes the Task-2 sections + the existing `NumerologyMatchPanel` + a Read panel. Resets to `Compatibility` when a new `synastryData` arrives.

**Files:**
- Create: `src/components/Tabs/Match/MatchResultCard.jsx`
- Create (test): `tests/components/MatchResultCard.test.jsx`
- Modify: `src/components/Tabs/NumerologyMatchPanel.jsx` (drop the root `border-t border-border pt-3`)

**Interfaces:**
- Consumes: `GunaMilanSection`, `StrongestCurrentsSection`, `PlanetaryOverlaysSection`, `MarriageSection` (Task 2); `NumerologyMatchPanel`; `Markdown` from `../../Chat/Markdown`.
- Produces: `MatchResultCard({ synastryData, numerologyMatch, activeProfile, partnerProfile, read, generatingRead })` — default export. `read` is a string (streaming buffer or last saved read). Returns null if `!synastryData`.

- [ ] **Step 1: Drop the stale top divider from `NumerologyMatchPanel`**

In `src/components/Tabs/NumerologyMatchPanel.jsx`, change the root element (current line 17) from:

```jsx
    <div className="border-t border-border pt-3 flex flex-col gap-2">
```

to:

```jsx
    <div className="flex flex-col gap-2">
```

(It now sits as its own tab, not under a sibling section, so the top divider is wrong. Its existing tests assert content, not the divider, so they stay green.)

- [ ] **Step 2: Write the failing test**

```jsx
// tests/components/MatchResultCard.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MatchResultCard from '../../src/components/Tabs/Match/MatchResultCard'

const A = { name: 'Asha' }
const B = { name: 'Bibek' }
const synastryData = {
  guna_milan: { total: 28, verdict: 'Good', breakdown: { nadi: { score: 8, max: 8 } }, profiles: null },
  overlay_summary: { lean: 'mixed', supportive: 3, challenging: 2, neutral: 5 },
  a_planets_in_b_houses: [], b_planets_in_a_houses: [],
  top_supportive: ['Venus supports affection'], top_challenging: [],
  marriage_factors: { a: { summary: 'A sum' }, b: { summary: 'B sum' } },
  dasha_overlap: {},
}
const numerologyMatch = null

const setup = (props = {}) => render(
  <MatchResultCard synastryData={synastryData} numerologyMatch={numerologyMatch}
    activeProfile={A} partnerProfile={B} read="" generatingRead={false} {...props} />)

describe('MatchResultCard', () => {
  it('renders nothing without synastryData', () => {
    const { container } = render(<MatchResultCard synastryData={null} activeProfile={A} partnerProfile={B} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows all four tab buttons', () => {
    setup()
    for (const t of ['Compatibility', 'Planets', 'Numerology', 'Read'])
      expect(screen.getByRole('button', { name: new RegExp(`^${t}`) })).toBeInTheDocument()
  })

  it('defaults to the Compatibility tab (Guna visible, planetary hidden)', () => {
    setup()
    expect(screen.getByText('Guna Milan')).toBeInTheDocument()
    expect(screen.queryByText('Planetary compatibility')).not.toBeInTheDocument()
  })

  it('clicking Planets reveals planetary content and hides Guna', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /^Planets/ }))
    expect(screen.getByText('Planetary compatibility')).toBeInTheDocument()
    expect(screen.queryByText('Guna Milan')).not.toBeInTheDocument()
  })

  it('clicking Read shows the passed read text', () => {
    setup({ read: 'You balance each other well.' })
    fireEvent.click(screen.getByRole('button', { name: /^Read/ }))
    expect(screen.getByText('You balance each other well.')).toBeInTheDocument()
  })

  it('marks the Read tab as generating while generatingRead is true', () => {
    setup({ generatingRead: true })
    const readBtn = screen.getByRole('button', { name: /^Read/ })
    expect(readBtn.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('resets to Compatibility when a new synastryData arrives', () => {
    const { rerender } = setup()
    fireEvent.click(screen.getByRole('button', { name: /^Planets/ }))
    expect(screen.getByText('Planetary compatibility')).toBeInTheDocument()
    rerender(<MatchResultCard synastryData={{ ...synastryData }} numerologyMatch={numerologyMatch}
      activeProfile={A} partnerProfile={B} read="" generatingRead={false} />)
    expect(screen.getByText('Guna Milan')).toBeInTheDocument()
    expect(screen.queryByText('Planetary compatibility')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/components/MatchResultCard.test.jsx`
Expected: FAIL — cannot resolve `MatchResultCard`.

- [ ] **Step 4: Create `MatchResultCard.jsx`**

```jsx
// src/components/Tabs/Match/MatchResultCard.jsx
import { useState, useEffect } from 'react'
import Markdown from '../../Chat/Markdown'
import NumerologyMatchPanel from '../NumerologyMatchPanel'
import GunaMilanSection from './GunaMilanSection'
import StrongestCurrentsSection from './StrongestCurrentsSection'
import PlanetaryOverlaysSection from './PlanetaryOverlaysSection'
import MarriageSection from './MarriageSection'

const TABS = ['Compatibility', 'Planets', 'Numerology', 'Read']

export default function MatchResultCard({ synastryData, numerologyMatch, activeProfile, partnerProfile, read, generatingRead }) {
  const [active, setActive] = useState('Compatibility')

  // A fresh compute (new synastryData identity) snaps back to the headline tab.
  useEffect(() => { setActive('Compatibility') }, [synastryData])

  if (!synastryData) return null
  const guna = synastryData.guna_milan
  const summary = synastryData.overlay_summary

  return (
    <div className="bg-surface border border-border rounded-xl p-3 flex flex-col gap-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setActive(t)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors flex items-center gap-1.5 ${
              active === t ? 'bg-primary text-white' : 'bg-surface border border-border text-muted hover:border-border-strong'
            }`}>
            {t}
            {t === 'Read' && generatingRead && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
          </button>
        ))}
      </div>

      {active === 'Compatibility' && (
        <div className="flex flex-col gap-3">
          <GunaMilanSection guna={guna} activeProfile={activeProfile} partnerProfile={partnerProfile} />
          <StrongestCurrentsSection synastryData={synastryData} />
        </div>
      )}
      {active === 'Planets' && (
        <div className="flex flex-col gap-3">
          <PlanetaryOverlaysSection synastryData={synastryData} summary={summary} activeProfile={activeProfile} partnerProfile={partnerProfile} />
          <MarriageSection synastryData={synastryData} activeProfile={activeProfile} partnerProfile={partnerProfile} />
        </div>
      )}
      {active === 'Numerology' && <NumerologyMatchPanel match={numerologyMatch} />}
      {active === 'Read' && (
        <div className="text-sm text-text leading-relaxed">
          {read ? <Markdown>{read}</Markdown> : <p className="text-xs text-muted">{generatingRead ? '...' : 'No compatibility read yet.'}</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/components/MatchResultCard.test.jsx tests/components/NumerologyMatchPanel.test.jsx`
Expected: PASS (MatchResultCard 7 tests + NumerologyMatchPanel unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/components/Tabs/Match/MatchResultCard.jsx tests/components/MatchResultCard.test.jsx src/components/Tabs/NumerologyMatchPanel.jsx
git commit -m "feat(match): MatchResultCard tab strip composing the section components"
```

---

### Task 4: Wire `MatchResultCard` into `MatchTab` and remove the inline card

Replace the inline computed-card JSX in `MatchTab.jsx` with `<MatchResultCard>`, remove the separate Read band, shrink the card height, and compute the `read` prop. After this task the feature is live.

**Files:**
- Modify: `src/components/Tabs/MatchTab.jsx`

**Interfaces:**
- Consumes: `MatchResultCard` (Task 3).
- Produces: the final `MatchTab` view.

- [ ] **Step 1: Add the import and the `read` derivation**

In `src/components/Tabs/MatchTab.jsx`, add alongside the component imports:

```jsx
import MatchResultCard from './Match/MatchResultCard'
```

After `const summary = synastryData?.overlay_summary` (just before `return (`), derive the read prop — streaming buffer while generating, else the last saved assistant read from the thread:

```jsx
  // The Read tab shows the live stream while generating, otherwise the last saved read.
  const lastRead = [...messages].reverse().find(m => m.role === 'assistant')?.content ?? ''
  const readForTab = generatingRead ? synastryRead : lastRead
```

- [ ] **Step 2: Replace the inline computed card with `MatchResultCard`**

Within the `<div className="p-4 border-b border-border flex flex-col gap-3 overflow-y-auto flex-shrink-0 max-h-[55%]">` block, the partner-selector + `computeError` stay. REPLACE the entire `{synastryData && ( <div className="bg-surface border border-border rounded-xl p-3 …"> … </div> )}` block (current lines 192–288 — the inline Guna/Planetary/Currents/Marriage/Numerology card) with:

```jsx
        {synastryData && (
          <MatchResultCard
            synastryData={synastryData}
            numerologyMatch={numerologyMatch}
            activeProfile={activeProfile}
            partnerProfile={partnerProfile}
            read={readForTab}
            generatingRead={generatingRead}
          />
        )}
```

Also change that wrapper's `max-h-[55%]` to `max-h-[45%]`.

- [ ] **Step 3: Remove the separate Read band**

Delete the block (current lines 291–296):

```jsx
      {(generatingRead || synastryRead) && (
        <div className="p-4 border-b border-border bg-surface overflow-y-auto flex-shrink-0 max-h-[40%]">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Compatibility Read</p>
          <div className="text-sm text-text leading-relaxed">{synastryRead ? <Markdown>{synastryRead}</Markdown> : '...'}</div>
        </div>
      )}
```

(The Read now lives in the Read tab.)

- [ ] **Step 4: Remove now-unused imports/helpers**

After Steps 2–3, `MatchTab.jsx` no longer references the section JSX or the `matchPrimitives` helpers directly, and may no longer use `Markdown`. Remove any import that lint reports as unused — run `npm run lint` and delete exactly what it flags (candidates: the `./Match/matchPrimitives` import added in Task 1, and `Markdown`). Do NOT remove `NumerologyMatchPanel`'s import usage indirectly — `MatchTab` no longer imports it directly (the card does); if `MatchTab` still imports `NumerologyMatchPanel`, remove that import too.

- [ ] **Step 5: Run lint + build + the match tests**

Run: `npm run lint`
Expected: 0 errors.
Run: `npm run build`
Expected: succeeds.
Run: `npx vitest run tests/components/MatchResultCard.test.jsx tests/components/matchSections.test.jsx tests/components/matchPrimitives.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/Tabs/MatchTab.jsx
git commit -m "feat(match): render the tabbed MatchResultCard; drop the inline stacked card"
```

---

### Task 5: Update the Match e2e and bring the whole suite green

The `match.spec.js` test asserts content from four sections at once; under tabs only one tab's content is in the DOM. Route each assertion through its tab, then run the full bar.

**Files:**
- Modify: `tests/e2e/match.spec.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: a green test bar.

- [ ] **Step 1: Read the current test to find the section assertions**

Run: `npx playwright test tests/e2e/match.spec.js --list` and open `tests/e2e/match.spec.js`. The test (around lines 43–58) asserts, in order: Guna Milan + `/36` + a koota (`nadi`), then Planetary compatibility + supportive/challenging, then `Compatibility Read` + the read text, then Numerology content.

- [ ] **Step 2: Insert tab clicks before the relevant assertions**

After the match computes and the card appears (the Guna assertions are on the default **Compatibility** tab, so they need no click), insert a click to the **Planets** tab before the planetary-overlay assertions, a click to **Read** before the read-text assertion, and a click to **Numerology** before the numerology assertions. The tab buttons are pill buttons with the tab label as text. Example shape (adapt to the file's existing `page`/locator style):

```js
// Compatibility tab is active by default — Guna assertions stay as-is.
await expect(page.getByText('Guna Milan')).toBeVisible({ timeout: 150_000 })
await expect(page.getByText('/36')).toBeVisible()
await expect(page.getByText(/nadi/i)).toBeVisible()

// Planetary content lives on the Planets tab now.
await page.getByRole('button', { name: /^Planets/ }).click()
await expect(page.getByText('Planetary compatibility')).toBeVisible()
await expect(page.getByText(/supportive/i).first()).toBeVisible()
await expect(page.getByText(/challenging/i).first()).toBeVisible()

// The LLM read lives on the Read tab (no more "Compatibility Read" band heading).
await page.getByRole('button', { name: /^Read/ }).click()
await expect(page.getByText('You two balance each other well.')).toBeVisible()

// Numerology lives on the Numerology tab.
await page.getByRole('button', { name: /^Numerology/ }).click()
await expect(page.getByText('Numerology Compatibility')).toBeVisible()
await expect(page.getByText(/indicative, non-classical/i)).toBeVisible()
```

Remove the now-obsolete `await expect(page.getByText('Compatibility Read')).toBeVisible()` assertion — that band heading no longer exists (the prose is in the Read tab, with no "Compatibility Read" label). If any assertion targeted a string that appeared in two sections simultaneously (the pre-existing strict-mode dupe), confirm it now resolves to one element because only one tab renders; if it still duplicates within a single tab, tighten the selector (e.g. `.first()` or a more specific role) — do not claim tabs fixed a dupe they didn't.

- [ ] **Step 3: Run the match e2e**

Run: `npx playwright test tests/e2e/match.spec.js --reporter=line`
Expected: the updated test passes. If Playwright cannot run in this environment, report that explicitly and instead confirm via `npm run build` that the app compiles, and rely on the `MatchResultCard` unit test for tab behavior.

- [ ] **Step 4: Run the full bar**

Run: `npx vitest run`
Expected: PASS (all suites, including the three new Match test files).
Run: `npm run lint`
Expected: 0 errors.
Run: `npm run build`
Expected: succeeds.
Run: `.venv-test/bin/python -m pytest tests/python`
Expected: PASS (no Python touched — confirms no regression).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/match.spec.js
git commit -m "test(match): route e2e assertions through the new result tabs"
```

---

## Self-Review

**Spec coverage:**
- 4-tab set (Compatibility/Planets/Numerology/Read), default Compatibility → Task 3 (`MatchResultCard`). ✅
- Sections grouped per spec (Guna+Currents; Planets=overlays+Marriage; Numerology; Read) → Task 3 composition. ✅
- Tabs only when `synastryData` exists; selector stays above → Task 4 (`{synastryData && <MatchResultCard>}`), card returns null without it (Task 3). ✅
- Reset to Compatibility on fresh compute → Task 3 effect keyed on `synastryData`. ✅
- Read tab streaming + generating hint on label → Task 3 (`read`/`generatingRead` props, pulse dot) + Task 4 (`readForTab` derivation). ✅
- Separate Read band removed; card `max-h-[55%]`→`[45%]` → Task 4 Steps 2–3. ✅
- Pill tab style from varga selector → Task 3 Step 4 classes; Global Constraints. ✅
- Component decomposition (MatchResultCard + 4 sections + primitives; NumerologyMatchPanel reused, divider dropped) → Tasks 1–3. ✅
- Agent↔UI parity, no compute/formatter change → Global Constraints; only JSX moved. ✅
- Tests: MatchResultCard test, sections test, primitives test, e2e routed through tabs, full bar → Tasks 1,2,3,5. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code. Task 5 Step 1 is discovery (line numbers may drift) but gives exact assertions to route. ✅

**Type consistency:** `MatchResultCard({ synastryData, numerologyMatch, activeProfile, partnerProfile, read, generatingRead })` matches the call in Task 4. Section prop names (`guna`, `synastryData`, `summary`, `activeProfile`, `partnerProfile`) match between Task 2 definitions, the Task 2 tests, and the Task 3 composition. `matchPrimitives` export names match across Tasks 1–3. `read` is a string both at the prop (Task 3) and the derivation (Task 4). ✅
