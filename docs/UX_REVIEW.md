# UX Review — Ask My Astro

**Date:** 2026-07-02
**Scope:** Full repo review from a UX perspective — onboarding, app shell/navigation, Chat, Chart panel, Numbers, Match, accessibility, visual design, error handling, copy. Read-only review; no code changed.
**Method:** Every UI component, hook, context, prompt file, and config under `src/` was read, plus `index.html`, `vite.config.js`, `vercel.json`, `theme.css`, and `soul.md`. All file:line references were taken from the code as of this review and key claims were spot-verified.

Each finding has an ID so fixes can be tracked. Severity scale:

| Severity | Meaning |
|---|---|
| **P0** | Blocks or strands users; core flow broken for a segment |
| **P1** | Significantly degrades comprehension, trust, or usability |
| **P2** | Friction, inconsistency, or gap a user will notice |
| **P3** | Polish; low-frequency or cosmetic |

---

## Contents

1. [Overall verdict](#1-overall-verdict)
2. [What's good — do not regress](#2-whats-good--do-not-regress)
3. [Findings: App shell, navigation & mobile (NAV)](#3-app-shell-navigation--mobile-nav)
4. [Findings: Onboarding & first-run (ONB)](#4-onboarding--first-run-onb)
5. [Findings: Chat (CHAT)](#5-chat-chat)
6. [Findings: Chart / Kundli panel (CHART)](#6-chart--kundli-panel-chart)
7. [Findings: Numbers tab (NUM)](#7-numbers-tab-num)
8. [Findings: Match tab (MATCH)](#8-match-tab-match)
9. [Findings: Accessibility, cross-cutting (A11Y)](#9-accessibility-cross-cutting-a11y)
10. [Findings: Errors, resilience & offline (ERR)](#10-errors-resilience--offline-err)
11. [Findings: Visual design & branding (VIS)](#11-visual-design--branding-vis)
12. [Findings: Copy & content (COPY)](#12-copy--content-copy)
13. [Findings: Dead / orphaned surfaces (DEAD)](#13-dead--orphaned-surfaces-dead)
14. [Suggested fix order](#14-suggested-fix-order)
15. [Full findings index](#15-full-findings-index)

---

## 1. Overall verdict

This is a thoughtfully engineered app whose strongest qualities are rare: the privacy promise is honest and actually backed by the code, the heavy in-browser Pyodide boot is communicated like a first-class product moment, and the chat experience (tool chips, stop handling, persona discipline) is genuinely good.

Its two biggest weaknesses are mirror images of its strengths:

1. **Split personality on jargon.** The chat layer is carefully scrubbed of Sanskrit and mechanics (per `soul.md` and `tabConfig.js`), but the structured dashboards sitting right next to it — Dasha/Yoga/Dosha pills, Guna Milan kootas, Lo Shu Kua/Arrows, "Raj Yog" tags — are saturated with unexplained terminology. The app's own layman policy is enforced in one half of the screen and violated in the other.
2. **Mobile is a dead end after onboarding.** Onboarding is mobile-friendly, but the entire Sidebar (profiles, API key, engine status, storage warning) is desktop-only, so a phone user can complete setup and then permanently lose access to profile and key management.

Accessibility is the weakest dimension overall: no live regions for streaming content, no focus-visible styling anywhere, color-only encodings, an unlabeled SVG chart, and non-keyboard-accessible controls.

---

## 2. What's good — do not regress

These are strengths to explicitly preserve while fixing the findings below.

### 2.1 Privacy as UX, honestly backed by code
- The onboarding privacy card says exactly what leaves the browser (questions to the chosen AI provider, birth places to the geocoder) instead of vague reassurance — `src/components/Onboarding/StepWelcome.jsx:16-28`.
- Analytics loads only when `VITE_GA_MEASUREMENT_ID` is set (`src/lib/analytics.js:31`), and `trackEvent` strips personal fields (`name, dob, time, lat, lon, key, chart, numerology`) as a safety net (`src/lib/analytics.js:53-60`).
- A random `localStorage` device id is used as the GA client/user id specifically to avoid cross-device stitching (`src/lib/analytics.js:14-28`); page views send only the path (`src/components/RouteTracker.jsx:10-14`); tab-view events carry no birth data (`src/pages/MainApp.jsx:27`).
- Tight CSP in `vercel.json:22`.

### 2.2 Heavy-engine boot communicated properly (during onboarding)
- 4-step checklist with per-step spinner/check and a progress bar (`src/components/Onboarding/StepComputing.jsx:104-134`).
- Live worker progress messages ("Downloading Python runtime (~5 MB)…", "Loading ephemeris data (~16 MB, first load only)…") streamed from `src/lib/pyodide/worker.js:36-87` via `src/hooks/usePyodide.js:39`.
- Expectation-setting copy: "First load downloads the star catalogue (17MB). Cached after — subsequent loads are instant." (`StepComputing.jsx:108`).
- Pyodide runs in a Web Worker so the UI never freezes (`src/lib/pyodide/index.js:1-4`).
- Boot stall capped at 120s and converted to an error card with a reload button (`StepComputing.jsx:71-101`).

### 2.3 Chat interaction model
- Live tool pills with human-readable labels in two tenses (active/past) from `src/lib/llm/toolLabels.js:5-25`, pinned by a test so a new tool can never show its raw name; chips persist onto the finished message (`src/components/Chat/ChatMessage.jsx:10`).
- Pulsing activity line while tools run ("Reading today's transits…", `src/components/Tabs/ChatTab.jsx:67-72`).
- Empty state is a greeting styled as a real assistant bubble plus starter prompts (`src/components/Chat/ChatMessages.jsx:19`, `ChatGreeting.jsx`, `TemplatePrompts.jsx`).
- Template prompts fill the input rather than auto-send, preserving user control (`ChatTab.jsx:32`, `ChatInput.jsx:14-21`).
- First-class Stop: Send swaps to a red Stop while busy (`ChatInput.jsx:59-64`), global Esc aborts (`ChatInput.jsx:24-31`), and an aborted stream still persists the partial text (`src/hooks/useChat.js:47-49`). Abort during a tool round bubbles cleanly instead of being fed back as a fake tool error (`src/lib/llm/agent.js:208`).
- Per-profile, per-tab history in IndexedDB with a stale-load guard on profile switches (`src/hooks/useChatThread.js:20-42`).
- Clear-chat routed through `ConfirmDialog` with explicit "can't be undone" copy; disabled when empty (`src/components/shared/ChatToolbar.jsx:31-39`, `ChatTab.jsx:57`).
- Prompt caching across tool rounds for the Claude provider (`agent.js:85-87`).

### 2.4 Persona/prompt design matched to the UI
- `src/assets/soul.md` bans Sanskrit, house numbers, and dasha/nakshatra terms with concrete ❌/✅ rewrite examples (`soul.md:16-26`), mandates effects-not-causes and answer-first structure (`soul.md:15, 50`), and fixes output shapes per question type (`soul.md:52-57`) that map exactly onto the Markdown renderer's strong/ul/li styling.
- Anti-hallucination guardrails: "Code computes, you interpret", recompute-or-say-so (`soul.md:7-11, 59-63`).
- `src/lib/llm/tabConfig.js:27-41` (LAYMAN_REMINDER + TOOL_GUIDANCE) repeats the layman policy per tab.

### 2.5 Data-driven rendering discipline
- The varga tab strip is built from `Object.keys(chart.divisionalCharts)` — the UI offers exactly what the engine computed (`src/components/Kundli/ChartPanel.jsx:34-36`).
- `VARGA_NAMES` glosses each varga at the point of display ("D9 → Navamsa — marriage & dharma") with a caption and button tooltips (`ChartPanel.jsx:8-25, 46, 54`) — the best jargon-mitigation in the app.
- Match overlays pair the raw term with a meaning and a supportive/challenging label ("Venus → their H7 (house_meaning) · supportive", `src/components/Tabs/Match/matchPrimitives.jsx:27-37`) and progressively disclose (top 5 + "+N more", `matchPrimitives.jsx:42-49`).
- Retrograde planets marked with ℞ — a non-color visual encoding (`src/components/Kundli/KundliChart.jsx:79`).

### 2.6 Edge-case engineering users actually feel
- Invisible SW updates: `registerType: 'prompt'` + reload applied only when the tab is hidden AND nothing is streaming (`src/lib/swUpdate.js:16-18`, `src/lib/registerSwUpdate.js:33-46`), hourly polling, re-check on focus. Busy state wired from chat/compute into the updater (`src/contexts/BusyContext.jsx:20-27`).
- Real offline capability: precache + CacheFirst for ephemeris/Pyodide CDN, NetworkFirst for geocoding; the 16 MB `de421.bsp` deliberately excluded from precache and cached at runtime (`vite.config.js:52-93`); correct SW cache headers (`vercel.json:13-18`).
- Storage-hydration gate prevents an onboarding flash for returning users (`src/components/StorageGate.jsx:5-17`).
- Profile switching locked mid-stream with explanatory tooltip (`src/components/Sidebar/ProfileItem.jsx:11-22`).
- Cancel-safe profile creation during unabortable WASM compute via `cancelledRef` (`src/components/Sidebar/AddProfileModal.jsx:16-17, 32`).
- Geocode: 400ms debounce + in-flight request abort (`src/hooks/useGeocode.js:21-36`).
- Onboarding step set frozen at mount so progress dots never jump (`src/pages/Onboarding.jsx:16`); StrictMode double-invocation guard prevents duplicate profiles (`StepComputing.jsx:29-36`).
- Storage-quota flag: informative not blocking, dismissible with re-surface logic, `role="status"`/`aria-live` (`src/components/StorageFlag.jsx:17-34`).
- Cross-tab API-key sync (`src/hooks/useApiKey.js:7-11`).
- Per-tab `ErrorBoundary` keyed on `activeTab` — one bad tab can't white-screen the app, and switching tabs clears the error (`src/pages/MainApp.jsx:65`).

### 2.7 Visual system coherence
- The warm parchment/terracotta palette (`src/styles/theme.css:3-20`) is internally consistent, suits the domain, and the PWA manifest colors match the tokens (`vite.config.js:96-99`). The dark sidebar + gold accent gives a pleasant "night-sky" contrast.

---

## 3. App shell, navigation & mobile (NAV)

### NAV-01 — Mobile users are stranded after onboarding — **P0**
- **Where:** `src/pages/MainApp.jsx:36` (`<div className="hidden md:flex">` wraps the Sidebar), `src/components/TabBar/BottomNav.jsx:2-6` (only Chat/Numbers/Match), `src/components/Sidebar/Sidebar.jsx:38-60` (profiles, Add-profile modal, API-key modal, storage flag, engine status all live here).
- **Current behavior:** On viewports below `md`, the entire Sidebar is hidden and BottomNav only exposes the three tabs. There is **no mobile path** to: add a profile, switch profiles, delete a profile, view/edit the API key, see the engine-status indicator, or see the storage-quota warning.
- **Why it matters:** Onboarding itself is mobile-friendly (centered `max-w-md` card), so a phone user can complete setup and then hit a permanent dead end for all account-level management. Key rotation, adding a partner profile for Match, or recovering from a bad key are all impossible on mobile.
- **Fix direction:** Add a mobile entry point (hamburger/sheet/drawer, or a "Profile" item in BottomNav) that surfaces the Sidebar's contents. Ensure StorageFlag and engine status are also reachable.
- **Acceptance:** On a 375px viewport, a user can add/switch/delete profiles, manage the API key, and see engine + storage status without resizing.

### NAV-02 — Tabs are component state, not routes; back button and deep links broken — **P1**
- **Where:** `src/router.jsx:25` (single `/app` route), `src/pages/MainApp.jsx:15-22` (`TAB_COMPONENTS` + `useState('chat')`).
- **Current behavior:** The three tabs are `useState`; onboarding steps are a `step` integer (`src/pages/Onboarding.jsx:11`). Only `/onboarding` and `/app` exist as routes.
- **Why it matters:** Browser Back never moves between tabs (it exits the app), tabs can't be deep-linked or bookmarked, and a refresh always resets to Chat. `RouteTracker` (`src/components/RouteTracker.jsx`) also only sees two paths, so analytics can't distinguish tab usage from path alone (partially mitigated by the manual tab-view event at `MainApp.jsx:27`).
- **Fix direction:** Promote tabs to sub-routes (`/app/chat`, `/app/numbers`, `/app/match`) or sync tab state to the URL (search param) and history.
- **Acceptance:** Refresh preserves the active tab; Back moves between visited tabs; a tab URL can be shared.

### NAV-03 — No 404 / unknown-route state — **P2**
- **Where:** `src/router.jsx:26-33` (`path="*"` unconditionally redirects to `/app` or `/onboarding`).
- **Current behavior:** Any typo'd or stale-bookmarked URL silently bounces to the main app or onboarding.
- **Why it matters:** Users never learn their link was wrong; combined with NAV-02 there is no addressable surface at all.
- **Fix direction:** Keep the redirect for genuinely unknown paths but consider a lightweight "page not found" interstitial, or at least resolve after NAV-02 so real sub-routes exist.

### NAV-04 — Chart is hidden inside Chat behind an icon toggle — **P1**
- **Where:** `src/components/Tabs/ChatTab.jsx:47-52` (ChartPanel as a side/top panel), `ChatTab.jsx:58-63` (🪐/☆ toggle button).
- **Current behavior:** The birth chart — arguably the core artifact of a Vedic astrology app — is not a navigation destination. It renders as a collapsible right column (desktop) / top ≤40%-height section (mobile) inside the Chat tab, toggled by a planet-emoji icon button.
- **Why it matters:** "Where is my chart?" has a non-obvious answer. Discovery depends on noticing and interpreting an emoji toggle. On mobile the chart competes with chat in a constrained scroll area (`max-h-[40%]`, `ChatTab.jsx:49`).
- **Fix direction:** Either promote Chart to a tab (the `tabConfig.js:47` `chart` framing already exists — see DEAD-02) or make the toggle a labeled control ("Chart") with an onboarding hint.
- **Acceptance:** A first-time user can find their chart without trial-and-error.

### NAV-05 — Tab bars lack tab semantics — **P2** *(see also A11Y-02)*
- **Where:** `src/components/TabBar/TabBar.jsx:8-22`, `src/components/TabBar/BottomNav.jsx:8-21`.
- **Current behavior:** Plain `<button>`s in a `<div>`; no `role="tablist"`/`role="tab"`/`aria-selected`, no roving tabindex.
- **Why it matters:** Screen readers won't announce these as a tab set or convey which is active.

### NAV-06 — Steady-state engine status invisible on mobile, minimal on desktop — **P1**
- **Where:** `src/components/Sidebar/Sidebar.jsx:53-56` (status dot, desktop-only per NAV-01); `src/components/Tabs/ChatTab.jsx` (no gating on Pyodide `isReady`).
- **Current behavior:** After onboarding, the only signal that the ~5 MB runtime + 16 MB ephemeris is still loading is a small sidebar dot. Mobile users see nothing. A chat tool call issued against a cold engine simply blocks until the worker resolves.
- **Why it matters:** On a cold cache (new device, cleared storage, SW update), first questions can hang for many seconds with no explanation — reads as "app is broken".
- **Fix direction:** Surface engine boot state in the main content area (banner/inline notice in ChatInput placeholder or a toast) on all viewports; consider disabling send with a "warming up the engine…" message until `isReady`.
- **Acceptance:** On a cold load at `/app`, both desktop and mobile users see what's loading before their first message can hang.

### NAV-07 — StorageGate loading screen has an undefined background class — **P3** *(near-certain CSS bug)*
- **Where:** `src/components/StorageGate.jsx:21` uses `bg-bg`; the theme token is `--color-background` (`src/styles/theme.css:4`), so the valid class is `bg-background`.
- **Current behavior:** `bg-bg` resolves to nothing → the very first screen every user sees (IndexedDB hydration spinner) renders with no background color. Also uses `h-full` near the root where the parent chain may not establish height.
- **Fix direction:** `bg-bg` → `bg-background`; verify the container fills the viewport (`h-screen` or ensured parent height).

---

## 4. Onboarding & first-run (ONB)

*Flow (for reference):* `useIsSetUp()` requires ≥1 profile + active profile id + saved API key (`src/router.jsx:11-19`) → `/onboarding` wizard: Welcome → API key (skipped if key exists, `Onboarding.jsx:16-20`) → Birth details → Computing → `/app`.

### ONB-01 — No back navigation between steps — **P2**
- **Where:** `src/pages/Onboarding.jsx:35-38` (only `next()` exists).
- **Current behavior:** The wizard only advances. There is no way to return from Birth Details to fix a wrong provider/key, or from the key step back to Welcome to re-read the privacy card.
- **Why it matters:** A mistyped key or wrong provider choice discovered at step 3 forces a page reload and full restart.
- **Fix direction:** Add a Back affordance on steps 2-3 (step 4 is compute-in-progress and can stay forward-only).

### ONB-02 — Switching provider wipes the typed API key — **P2**
- **Where:** `src/components/Onboarding/StepApiKey.jsx:22-28` and `src/components/Sidebar/ApiKeyModal.jsx:23-29` (`switchProvider` clears key/baseUrl/model on every provider tap).
- **Current behavior:** A user who pastes a key and then taps another provider tile (e.g. to read its docs link) loses their input with no warning.
- **Fix direction:** Preserve per-provider field state during the session, or only clear on save, or confirm before clearing non-empty fields.

### ONB-03 — Geocode errors computed but never shown — **P1**
- **Where:** `src/hooks/useGeocode.js:35-38, 59` exposes `error`; `src/components/shared/BirthDetailsForm.jsx:17` destructures only `{ results, loading, search, fetchTimezone, clear }` — `error` is never read or rendered. There is also no visible "no results" state for the suggestion list (`BirthDetailsForm.jsx:99-108`).
- **Current behavior:** If Nominatim fails (network, rate limit, CORS), the user sees no suggestions and only the generic "Pick your birth place from the suggestions to continue" hint (`BirthDetailsForm.jsx:109-112`). The submit button stays disabled forever with no explanation.
- **Why it matters:** This is a hard dead end on the critical path — the user cannot complete onboarding and has no idea why.
- **Fix direction:** Render `error` under the place field with a retry hint; add an explicit "no places found" state distinct from "still typing".
- **Acceptance:** With the geocoder blocked, the user sees an actionable error, not a silent dead field.

### ONB-04 — Timezone lookup failure is a silent no-op on final submit — **P1**
- **Where:** `src/components/shared/BirthDetailsForm.jsx:31-50` — `handleSubmit` wraps `fetchTimezone` in `try { … } finally { setSubmitting(false) }` with **no `catch`**.
- **Current behavior:** If timeapi.io fails, the promise rejects (unhandled), `submitting` resets, `onSubmit` is never called. The button un-spins and… nothing. No error, no chart, no retry guidance.
- **Why it matters:** Silent failure at the exact moment of highest user investment (all details typed, place selected).
- **Fix direction:** Catch, show an inline error ("Couldn't determine the timezone for this place — try again"), and keep the form state intact.
- **Acceptance:** With timeapi.io blocked, submitting shows an error message and the user can retry.

### ONB-05 — Place autocomplete is not accessible and shows raw geocoder strings — **P2**
- **Where:** `src/components/shared/BirthDetailsForm.jsx:99-108`.
- **Current behavior:** Suggestions are `<li onClick>` items: no combobox/listbox ARIA roles, no arrow-key navigation, no keyboard selection. Raw Nominatim `display_name` strings can be extremely long ("Mumbai, Mumbai Suburban, Maharashtra, 400001, India"-style).
- **Fix direction:** ARIA combobox pattern (or a vetted primitive); truncate/format display names (city, region, country).

### ONB-06 — Compute step can dead-end at 0% — **P2**
- **Where:** `src/components/Onboarding/StepComputing.jsx:29-30` (early return when `birthData` is missing).
- **Current behavior:** If step 4 mounts without `birthData` (remount, direct navigation, state loss), the effect returns early and the screen sits at 0% forever with no error or way out.
- **Fix direction:** Redirect back to the birth-details step (or show an error with a "start over" action) when `birthData` is absent.

### ONB-07 — Progress bar advances in 25% jumps; first step can look stalled — **P3**
- **Where:** `src/components/Onboarding/StepComputing.jsx:112-113`.
- **Current behavior:** The bar moves only per completed checklist step. The first step (engine + 17 MB download) is by far the longest, so the bar can sit at 0% for tens of seconds. The live worker messages mitigate this, but the bar itself reads "stalled".
- **Fix direction:** Sub-step progress for the download (worker already emits granular messages), or an indeterminate shimmer on the active segment.

### ONB-08 — Profile deletion is one click, no confirmation — **P1**
- **Where:** `src/components/Sidebar/ProfileItem.jsx:35` (`onClick={… removeProfile(profile.id)}`).
- **Current behavior:** The `×` on a profile row permanently deletes the profile (birth data, computed chart, chat history association) on a single click. Inconsistent with clear-chat, which gets a ConfirmDialog (`ChatToolbar.jsx:31-39`).
- **Why it matters:** Destructive, irreversible, and adjacent to the click target for switching profiles.
- **Fix direction:** Route through the existing `ConfirmDialog` with copy stating what is lost.

### ONB-09 — "Clear key" instantly ejects the user to onboarding — **P2**
- **Where:** `src/components/Sidebar/ApiKeyModal.jsx:46-52`; route guard at `src/router.jsx:11-19`.
- **Current behavior:** The Clear button calls `clearApiKey()` immediately; because `useIsSetUp()` requires a key, the user is bounced out of `/app` into onboarding with no confirmation.
- **Fix direction:** Confirm first, and explain the consequence ("You'll be taken back to setup until a new key is added").

### ONB-10 — Modals lack dialog semantics, focus management, and standard dismissal — **P1** *(see also A11Y-05)*
- **Where:** `src/components/Sidebar/AddProfileModal.jsx:52-71`, `src/components/Sidebar/ApiKeyModal.jsx:54-131`, `src/components/shared/ConfirmDialog.jsx:12`.
- **Current behavior:** AddProfileModal and ApiKeyModal have no `role="dialog"`/`aria-modal`/`aria-labelledby`, no focus trap, no autofocus, no Escape-to-close, no backdrop-click-to-close. ConfirmDialog closes on backdrop click but also lacks Escape and a focus trap.
- **Fix direction:** Adopt one dialog primitive (native `<dialog>`, or a small a11y wrapper) and use it for all three.

### ONB-11 — Gender field's consequence isn't stated — **P3**
- **Where:** `src/components/shared/BirthDetailsForm.jsx:76-77` (optional, labelled "for Kundali Match").
- **Current behavior:** Nothing warns that leaving gender blank limits/changes the Match feature later (Guna Milan is bride/groom-directional).
- **Fix direction:** One-line helper text stating what skipping it means.

*Onboarding strengths worth keeping (see §2): frozen step dots, key-step skip for returning users, specific privacy copy, submit gated on a real geocoded selection with explanatory hint (`BirthDetailsForm.jsx:109-115`), private-browsing storage error handling (`StepApiKey.jsx:40-42`), StrictMode guard, 120s boot timeout, proper `htmlFor`/`id` label pairs (`BirthDetailsForm.jsx:55-96`).*

---

## 5. Chat (CHAT)

### CHAT-01 — Raw provider error strings shown to lay users; no retry/backoff — **P1**
- **Where:** `src/hooks/useChat.js:51` surfaces `err.message` verbatim; messages originate in `src/lib/llm/agent.js:44-46, 96-98, 139-141`; no backoff/retry logic exists in `agent.js` or `src/lib/llm/sse.js`.
- **Current behavior:** A 401/429/quota/CORS failure renders whatever the provider returned — e.g. "LLM error 429" or a raw JSON error body — as a red paragraph (`ChatTab.jsx:73`).
- **Why it matters:** The audience explicitly includes non-technical users (the whole persona is built for them); provider JSON is meaningless to them and there's no guidance ("check your key", "you've hit a rate limit — wait a minute").
- **Fix direction:** Map common statuses (401/403 → key problem with a link to the key modal; 429 → rate limit w/ wait guidance; network → offline hint) and add modest automatic retry with backoff for 429/5xx.
- **Acceptance:** Forcing a 401 and a 429 each produces a human-readable, actionable message.

### CHAT-02 — Error bar is not dismissible, not announced, and lingers — **P2**
- **Where:** `src/hooks/useChat.js:30, 51` (error set on failure, cleared only at the start of the *next* send); rendered as a plain `<p>` at `src/components/Tabs/ChatTab.jsx:73` with no `role="alert"`.
- **Current behavior:** A failed message leaves a red bar until the user sends again; screen readers never hear it; there's no × to dismiss.
- **Fix direction:** `role="alert"`, a dismiss control, and/or auto-clear on input focus.

### CHAT-03 — No retry / regenerate affordance — **P2**
- **Where:** `src/hooks/useChat.js:47-49` (partial answers persist on abort), `src/components/Chat/ChatMessage.jsx` (no message actions).
- **Current behavior:** After an error or a Stop, the user must manually retype/resend. The partial answer is saved but there's no "retry", "continue", or "regenerate" control.
- **Fix direction:** A retry button on the error bar (resend last user message) is the minimum; regenerate-last-answer is a nice-to-have.

### CHAT-04 — Auto-scroll fights the reader during streaming — **P2**
- **Where:** `src/components/Chat/ChatMessages.jsx:12-14` (`scrollIntoView({behavior:'smooth'})` on every `streamingContent` change, unconditional).
- **Current behavior:** While a long answer streams, a user who scrolls up to reread earlier messages is yanked back to the bottom on each token batch.
- **Fix direction:** Track "user scrolled away" (scroll offset from bottom > threshold) and suspend auto-scroll until they return; optionally show a "↓ new content" pill.

### CHAT-05 — Streaming and tool activity have no live region — **P1** *(see also A11Y-01)*
- **Where:** `src/components/Chat/ChatMessages.jsx:24-38` (streaming bubble + spinner), `src/components/Chat/ToolChips.jsx`, `src/components/Tabs/ChatTab.jsx:67-72` (activity line).
- **Current behavior:** None of the dynamic chat content is in an `aria-live` region — screen-reader users get no announcement that a reply is streaming, that tools are running, or that the answer finished.
- **Fix direction:** `aria-live="polite"` on the activity line and a completion announcement; avoid live-announcing every token (announce on message completion).

### CHAT-06 — Greeting and starter prompts assume a chart that may not exist — **P2**
- **Where:** `src/components/Chat/ChatGreeting.jsx:4-5` ("I've cast your chart…" whenever `name` exists); `src/components/Tabs/ChatTab.jsx:36-42` (tab renders and prompts show even when `hasChart` is false).
- **Current behavior:** Without a computed chart, the greeting overclaims and prompts like "Read my chart" lead to tool failures surfaced through the raw-error UX of CHAT-01.
- **Fix direction:** Gate the copy/prompts on `hasChart`, or swap in a "your chart is still computing" variant.

### CHAT-07 — `supportsTools` computed but never surfaced — **P2**
- **Where:** `src/hooks/useChat.js:61-64` exposes `supportsTools`; `src/components/Tabs/ChatTab.jsx:17` never destructures it.
- **Current behavior:** If the configured provider/model can't do tool calls, there's no upfront indication — the "astrologer" silently loses the ability to read the chart, and answers degrade to guesswork the persona forbids.
- **Fix direction:** A visible notice when tools are unsupported ("This model can't read your chart data — answers will be generic; switch models for full readings").

### CHAT-08 — Markdown renderer has gaps for GFM output — **P3**
- **Where:** `src/components/Chat/Markdown.jsx:7-27` — `remarkGfm` is enabled but `COMPONENTS` defines no `table/thead/tbody/tr/td/th`, no `pre`, no `img`; code fences reuse the inline-`code` pill style (`:20`).
- **Current behavior:** If the model emits a table (soul.md discourages but doesn't prevent it), it renders unstyled; fenced code blocks get inline-pill treatment with no block formatting.
- **Fix direction:** Minimal styled `table` + `pre` components.

### CHAT-09 — Step-limit terminations are indistinguishable from content judgments — **P3**
- **Where:** `src/lib/llm/agent.js:185-220` (`maxRounds` → generic "I couldn't finish that…" at `:218`).
- **Current behavior:** Hitting the tool-round cap shows the same terminal message as any other failure; the user can't tell it was a step limit (retry would likely work).
- **Fix direction:** Distinct copy for the cap ("That took more steps than I'm allowed — ask again or narrow the question").

### CHAT-10 — No message-level affordances (copy, timestamps) — **P3**
- **Where:** `src/components/Chat/ChatMessage.jsx` (content + chips only).
- **Current behavior:** No copy-answer button, no timestamps, no message actions — common chat affordances users increasingly expect.
- **Fix direction:** Copy button on assistant messages is the highest-value single addition.

### CHAT-11 — Chat textarea has no accessible label — **P2** *(part of A11Y sweep)*
- **Where:** `src/components/Chat/ChatInput.jsx:56-58` (placeholder-only).
- **Fix direction:** `aria-label="Message your astrologer"` (or visually-hidden label).

### CHAT-12 — Sensitive-topic confidence with no reflection framing — **P3** *(product judgment call)*
- **Where:** `src/assets/soul.md:27, 33-35` ("direct, no hedging", "blunt" on compatibility) + life-area readings covering health/marriage/money.
- **Current behavior:** The persona is deliberately confident; there is no prompt-level or UI-level "for reflection/entertainment" framing anywhere in the app.
- **Why it matters:** Blunt verdicts on marriage compatibility or health-adjacent questions can land hard on a lay user who takes them literally. This is a deliberate product stance — flagging it as a decision to make consciously, not an obvious defect.
- **Fix direction (if desired):** A one-time subtle disclaimer in the chat empty state, or a soul.md nudge for sensitive domains.

---

## 6. Chart / Kundli panel (CHART)

### CHART-01 — The chart SVG is invisible to assistive tech — **P1**
- **Where:** `src/components/Kundli/KundliChart.jsx` — no `role="img"`, no `<title>`/`<desc>`, no `aria-label` anywhere in the SVG.
- **Current behavior:** The core artifact of the app is a screen-reader void.
- **Fix direction:** `role="img"` + a generated `aria-label`/`<desc>` summarizing ascendant + placements ("North-Indian chart: Aries ascendant; Sun and Mercury in the 2nd house; …") — the data to generate it already exists.

### CHART-02 — Chart is undecodable without prior knowledge: no legend for planet codes or sign numbers — **P1**
- **Where:** `src/components/Kundli/KundliChart.jsx:69-78` — planets render as two-letter codes ("Su", "Ma", "Ra"); houses show bare sign digits 1-12; no legend exists anywhere in `ChartPanel.jsx`.
- **Current behavior:** A non-astrologer cannot map "Ra" → Rahu or "7" → Libra. The app's entire persona is built for exactly this user.
- **Fix direction:** A collapsible legend under the chart (code → planet name, number → sign name), or tooltips on hover/tap.
- **Acceptance:** A first-time user can identify every glyph on the chart from within the panel.

### CHART-03 — Occupants silently truncate at 5 — **P2**
- **Where:** `src/components/Kundli/KundliChart.jsx:75` (`.slice(0, 5)` with no indicator).
- **Current behavior:** A house with 6+ occupants (stelliums happen; D-charts make them common) silently drops planets. Internally inconsistent: the Match overlays *do* show a "+N more" count (`matchPrimitives.jsx:42-49`).
- **Fix direction:** "+N" marker in the house cell, matching the Match pattern.

### CHART-04 — Dasha/Yogas/Doshas pills are raw jargon with raw keys — **P1**
- **Where:** `src/components/Kundli/ChartPanel.jsx:60-85` — "Dasha: {mdLord} › {adLord}" (`:65-68`), yoga names raw and capped at 5 (`:74-75`), doshas as bare snake-case keys like "mangal" / "kaal_sarp" title-cased (`:80-82`).
- **Current behavior:** None of Dasha, Yoga, or Dosha is defined on screen; dosha keys are internal identifiers leaking into UI. This is the sharpest instance of the app's split personality — these pills sit directly beside the de-jargoned chat.
- **Fix direction:** One-line glosses (the pattern `VARGA_NAMES` already proves at `ChartPanel.jsx:8-25`): "Dasha (current planetary period)", dosha keys mapped to display names + a clause ("Mangal dosha — Mars placement affecting marriage timing"). Meanings can come from the same `reference.js` primitives the agent uses.
- **Acceptance:** Every pill term has an in-context explanation reachable without asking the chat.

### CHART-05 — No loading/error state; panel silently absent until data exists — **P2**
- **Where:** `src/components/Kundli/ChartPanel.jsx:40` (renders nothing without `chart`), `KundliChart.jsx:33` (returns `null` on missing data).
- **Current behavior:** While a profile computes (or if compute failed), the chart area is just… gone. No skeleton, no "computing your chart", no error. Inconsistent with Match, which has spinner + error line.
- **Fix direction:** Skeleton/spinner + failure state consistent with `MatchTab.jsx:144-150`.

---

## 7. Numbers tab (NUM)

### NUM-01 — "Pyth:" cross-check reads as noise — **P2**
- **Where:** `src/components/Tabs/NumbersTab.jsx:54` (secondary "Pyth: N" under the primary number).
- **Current behavior:** The primary numbers are Chaldean with a Pythagorean cross-check, but "Pyth:" is never expanded or explained. A layperson sees a cryptic second number that sometimes disagrees with the big one — which undermines trust in both.
- **Fix direction:** Tooltip/legend: "Two numerology systems — Chaldean (primary) and Pythagorean (shown for comparison)". Or hide the cross-check behind a details toggle.

### NUM-02 — Lo Shu terminology unexplained — **P2**
- **Where:** `src/components/Tabs/LoShuGrid.jsx:24-29` — "Kua", "Arrows of strength/weakness", "Repeated (strong)", "Missing".
- **Current behavior:** Esoteric terms with no gloss. Same split-personality issue as CHART-04.
- **Fix direction:** One-line explanations per term, same approach as CHART-04.

### NUM-03 — Card labels assume numerology literacy — **P3**
- **Where:** `src/components/Tabs/NumbersTab.jsx:39-59` — "Soul Urge", "Personality", "Personal Year".
- **Current behavior:** No hint of what each number *means for the user*. The meanings exist in `src/lib/llm/reference.js` (number traits) — the agent can see them; the UI doesn't show them (a mild violation of the repo's own agent↔UI sync rule).
- **Fix direction:** Sub-caption per card ("Soul Urge — what you deeply want") sourced from the same reference primitives.

### NUM-04 — No loading/empty state before numerology exists — **P2**
- **Where:** `src/components/Tabs/NumbersTab.jsx:39` (grid renders only when `activeProfile.numerology` exists), `LoShuGrid.jsx:7` (returns `null`).
- **Current behavior:** Mid-compute or post-failure, the tab is a bare chat with no explanation of where the numbers went. Inconsistent with Match's spinner/error treatment.
- **Fix direction:** Same skeleton/error pattern as CHART-05.

---

## 8. Match tab (MATCH)

### MATCH-01 — Guna Milan attribute tables are raw koota jargon — **P1**
- **Where:** `src/components/Tabs/Match/matchPrimitives.jsx:12-20` (labels), rendered in `GunaMilanSection.jsx:16-34` — Varna, Vashya, Yoni, Gana, Nadi, Nakshatra as bare labels; breakdown koota names are underscore-replaced keys.
- **Current behavior:** The primary Compatibility landing view presents eight Sanskrit attributes per person with zero explanation.
- **Fix direction:** Gloss each koota with its one-line meaning ("Nadi — health & genes compatibility"), same reference-primitives approach as CHART-04.

### MATCH-02 — Two scoring scales (out of 36 and out of 10) with no explanation of either — **P1**
- **Where:** `GunaMilanSection.jsx` (headline /36), `src/components/Tabs/NumerologyMatchPanel.jsx:19-24` (separate "indicative" /10).
- **Current behavior:** Adjacent sub-tabs show a 24/36 and a 6/10 with no explanation of what's a good score on either scale, or why there are two numbers. The deliberate non-blending is rigorous, but users are left asking "so what's our actual number?"
- **Fix direction:** Scale context on each ("18+ /36 is traditionally considered a viable match"), plus one sentence on why astrology and numerology scores are kept separate.

### MATCH-03 — Combined Lo Shu grid distinguishes partners by color alone — **P1** *(accessibility)*
- **Where:** `src/components/Tabs/CombinedLoShuGrid.jsx:8-9` (`text-primary` vs `text-rose-500`), interleaved digits in shared cells (`:62-63`).
- **Current behavior:** Two people's digits mixed in one cell with only hue to tell them apart — fails for colorblind users, ambiguous for everyone. The orange/rose pair is also low-differentiation.
- **Fix direction:** Add a non-color channel: superscript initials, bold-vs-regular, or per-person symbol prefix; keep the legend.

### MATCH-04 — Combined grid is an information-density wall at 10-11px — **P2**
- **Where:** `src/components/Tabs/CombinedLoShuGrid.jsx:42-82` — legend, merged magic square, completed-line groups (horizontal/vertical/diagonal), "Raj Yog" tags, per-line contributions, "grid still missing N" — all at `text-[10px]`/`text-[11px]`.
- **Current behavior:** A large amount of unexplained esoteric content at near-illegible sizes.
- **Fix direction:** Progressive disclosure (headline verdict + expandable detail), minimum ~12px body text, and gloss "Raj Yog" (`:29`).

### MATCH-05 — Red/green-only effect encoding — **P1** *(accessibility)*
- **Where:** `src/components/Tabs/Match/matchPrimitives.jsx:3-4` (`EFFECT_DOT`/`EFFECT_TEXT` green/red/gray), count row glyphs at `PlanetaryOverlaysSection.jsx:15-17`.
- **Current behavior:** Supportive vs challenging is carried by red/green dots and tinted text — the classic deuteranopia failure. (The row *text* label partially mitigates; the dot and counts don't.)
- **Fix direction:** Pair color with shape or icon (▲/▼, +/−) on dots and count glyphs.

### MATCH-06 — Match result crammed into a 45%-height scroll box on mobile — **P2**
- **Where:** `src/components/Tabs/MatchTab.jsx:126` (`max-h-[45%]` + internal scroll), inner content includes the full multi-tab `MatchResultCard`.
- **Current behavior:** On a phone, the Guna table + overlays + combined grid all scroll inside a box under half the viewport, inside the page — scroll-within-scroll with heavy nesting. Two-column layouts (`GunaMilanSection.jsx:15, 25` `grid-cols-2`) don't collapse on narrow screens, squeezing 11px values further.
- **Fix direction:** On mobile, let the result card take the full content area (chat collapses below), and collapse Guna/grid columns to one at the smallest breakpoint.

### MATCH-07 — Naming drift: "Kundali Match" vs "Match" vs "Kundli" — **P3**
- **Where:** `MatchTab.jsx:123` ("Kundali Match" toolbar title), `TabBar.jsx:5` ("Match"), `src/components/Kundli/` (directory/component spelling "Kundli").
- **Fix direction:** Pick one spelling and one label; use everywhere.

*Match strengths worth keeping (see §2): the no-profile and add-a-second-profile empty states with CTA (`MatchTab.jsx:113, 127-134`), compute spinner and error line (`:144-150`), input disabled with contextual placeholder until a match exists (`:166-167`), fresh synastry snapping back to the Compatibility sub-tab (`MatchResultCard.jsx:16`), full state reset on profile change (`MatchTab.jsx:40-50`), and the auto-generated plain-language "Read" (`MatchTab.jsx:77-98`).*

---

## 9. Accessibility, cross-cutting (A11Y)

These consolidate the per-surface items into one sweep; several are referenced above.

### A11Y-01 — No live regions for any dynamic content — **P1**
- **Where:** streaming replies, spinner bubble, tool chips, activity line, chat errors (`ChatMessages.jsx:24-38`, `ToolChips.jsx`, `ChatTab.jsx:67-73`); Match compute status (`MatchTab.jsx:144-150`).
- **Exceptions that got it right:** `StorageFlag.jsx:17` (`role="status"` + `aria-live`), sidebar engine dot (`Sidebar.jsx:53-56`) — use these as the pattern.
- **Fix direction:** `aria-live="polite"` for status/activity, `role="alert"` for errors, completion announcements for streamed messages.

### A11Y-02 — Tab bars lack tab semantics — **P2**
- See NAV-05. `TabBar.jsx:8-22`, `BottomNav.jsx:8-21`.

### A11Y-03 — No visible keyboard focus anywhere — **P1**
- **Where:** every form field removes the outline (`focus:outline-none focus:border-primary`): `ChatInput.jsx:58`, `ApiKeyModal.jsx:84, 94, 107`, `BirthDetailsForm.jsx:57-96`, `StepApiKey.jsx`; buttons rely on hover-only color changes; no global `:focus-visible` rule exists in any stylesheet.
- **Current behavior:** Keyboard users cannot reliably see where focus is. The border-color swap on inputs is subtle; buttons have nothing.
- **Fix direction:** One global `:focus-visible` ring rule in `theme.css` using the primary token; stop removing outlines without replacement.

### A11Y-04 — Mouse-only controls — **P1**
- **Where:** profile rows are `<div onClick>` with no `role`/`tabIndex`/key handler (`ProfileItem.jsx:16`); place-autocomplete items are `<li onClick>` (`BirthDetailsForm.jsx:99-108`).
- **Fix direction:** Real `<button>`s or full ARIA + keyboard handling.

### A11Y-05 — Modals: no dialog role, focus trap, or Escape — **P1**
- See ONB-10. `AddProfileModal.jsx:52-71`, `ApiKeyModal.jsx:54-131`, `ConfirmDialog.jsx`.

### A11Y-06 — Color contrast below WCAG AA for pervasive muted text — **P1**
- **Where:** `src/styles/theme.css:13-15` — `muted #8a7060` on `background #fdf6ee` ≈ 3.3:1 (AA small-text requires 4.5:1); `muted-2 #b89070` is worse; primary orange `#c45c1a` on cream is borderline for the active-tab text/underline. Muted text is used at `text-xs` sizes throughout (e.g. `MainApp.jsx:45, 58` headers/DOB subtitles, hint lines everywhere).
- **Fix direction:** Darken the muted browns until small-size text passes 4.5:1 (e.g. toward `#6f5847`-range); re-verify the palette with a contrast checker.

### A11Y-07 — Color-only encodings — **P1**
- Consolidates MATCH-03 (partner-by-color grid) and MATCH-05 (red/green effect dots). Also the sidebar engine dot conveys state by color alone (`Sidebar.jsx:10-15`) — its adjacent text label mitigates when present.

### A11Y-08 — SVG chart unlabeled — **P1**
- See CHART-01.

### A11Y-09 — Chat textarea placeholder-only labeling; 10px BottomNav labels — **P2**
- `ChatInput.jsx:56-58` (no `aria-label`); `BottomNav.jsx:17` (`text-[10px]` labels under emoji icons).

---

## 10. Errors, resilience & offline (ERR)

### ERR-01 — No offline/network-state handling anywhere — **P2**
- **Where:** no `navigator.onLine` usage in `src/` (verified by grep). Failure surfaces: `StepComputing.jsx:72` (generic "Python engine failed to load…"), `ChatTab.jsx:73` (raw chat error).
- **Current behavior:** The PWA caches assets well (see §2.6), but the app never *tells* the user they're offline. LLM calls and first-load CDN fetches just fail with generic or raw errors.
- **Fix direction:** Online/offline listener + a banner; offline-specific copy for LLM send failures ("You're offline — your reading needs a connection").

### ERR-02 — Raw `err.message` surfaced in three places — **P1**
- Consolidates CHAT-01 plus: compute error card renders `err.message` verbatim (`StepComputing.jsx:95`); Match compute error line (`MatchTab.jsx:150`).
- **Fix direction:** A small error-mapping helper (status/type → human copy) used by all three surfaces.

### ERR-03 — Silent failure cluster on the birth-details path — **P1**
- Consolidates ONB-03 (geocode error never rendered) + ONB-04 (timezone `try/finally` without `catch`) + ONB-06 (compute step 0% dead-end). These three together make the most valuable flow in the app (first chart) the most fragile.

### ERR-04 — No steady-state engine failure surface — **P2**
- **Where:** `usePyodide.js` exposes error state; outside onboarding nothing renders it except the sidebar dot color (desktop-only).
- **Current behavior:** If the worker dies post-onboarding, tool calls fail with raw errors (CHAT-01) and nothing explains that the engine is down.
- **Fix direction:** Engine-error banner in the main content area with a reload action (pairs with NAV-06).

---

## 11. Visual design & branding (VIS)

### VIS-01 — Browser chrome is placeholder — **P2**
- **Where:** `index.html:7` (`<title>Astro</title>`); favicon is default `/vite.svg`; no `<meta name="description">`, no `<meta name="theme-color">`, no `apple-touch-icon`. Real name/colors exist only in the PWA manifest (`vite.config.js:96-99`).
- **Current behavior:** The browser tab, bookmarks, and link previews all say "Astro" with a Vite logo — undermines the otherwise deliberate brand.
- **Fix direction:** Title "Ask My Astro", real favicon/touch icons, description + theme-color metas matching the tokens.

### VIS-02 — No typographic identity — **P3**
- **Where:** no `font-family` in any CSS, no font `<link>` in `index.html`, no `fontFamily` in `tailwind.config.js` (which is content-globs only). Only `font-mono` appears (API-key fields).
- **Current behavior:** Default system sans throughout. The parchment palette suggests a warm editorial identity the typography never delivers.
- **Fix direction:** One display face for headings (system-stack fallback), keep system sans for body.

### VIS-03 — Emoji as primary iconography — **P3**
- **Where:** BottomNav 💬 ✨ ❤️ (`BottomNav.jsx:3-5`), chart toggle 🪐/☆ (`ChatTab.jsx:62`), sidebar 🔑/⚠.
- **Current behavior:** Renders differently per OS (noto vs apple vs segoe), can't be colored to match the palette, and reads informal against the considered color system.
- **Fix direction:** Small inline SVG icon set tinted with theme tokens.

### VIS-04 — GitHubLink star count causes post-load layout shift — **P3**
- **Where:** `src/components/shared/GitHubLink.jsx:49-54` (async star count injects a variable-width pill after mount) — affects onboarding and the header top-right.
- **Fix direction:** Reserve the pill's width (fixed min-width) or fade it in absolutely-positioned.

### VIS-05 — Light-first tokens fight the one dark surface — **P3** *(watch-item, not a defect)*
- **Where:** `src/components/Sidebar/ProfileItem.jsx:29-32` documents that default `text-text` (`#3a2010`) would be invisible on `dark-bg` (`#3a2010`) — same hex — so gold is used manually.
- **Why it matters:** Every new component placed in the sidebar must remember this manually; there's no `dark-*` text token pair. A future addition will ship invisible text.
- **Fix direction:** Add `--color-dark-text`/`--color-dark-muted` tokens and use them in sidebar components.

---

## 12. Copy & content (COPY)

### COPY-01 — Privacy copy inconsistency: "never uploaded" vs disclosed geocoding — **P2**
- **Where:** `src/components/Onboarding/StepBirthDetails.jsx:12` ("Computed locally — never uploaded") vs `StepWelcome.jsx:19-22` (honestly discloses place names go to the geocoder) vs actual behavior (`useGeocode.js:3-8`: place → Nominatim, coordinates → timeapi.io).
- **Current behavior:** The Welcome screen is honest; the Birth Details screen overclaims. A privacy-sensitive user who reads both sees a contradiction — and this app's differentiator *is* privacy.
- **Fix direction:** Align StepBirthDetails: "Charts are computed on your device. Only the place name is sent to a geocoding service to find coordinates."

### COPY-02 — Developer jargon in the API-key step — **P2**
- **Where:** `StepApiKey.jsx:75` ("OpenAI-compatible endpoint (must allow browser CORS)"), `:87` ("Use any OpenRouter model id"); the Base URL / Model / API Key field cluster generally.
- **Current behavior:** The bring-your-own-key premise is inherently technical, but "browser CORS" and "model id" are developer-speak. "Connect your AI" (`:48`) starts well, then the fields reintroduce the jargon.
- **Fix direction:** Plain-language helper text per provider with a "advanced" disclosure for Base URL/Model on the Custom provider only.

### COPY-03 — "Python engine" leaks implementation detail — **P3**
- **Where:** `Sidebar.jsx:11-14`, `StepComputing.jsx:11` ("Loading Python engine" / "Python engine ready").
- **Fix direction:** "Astrology engine" / "calculation engine".

### COPY-04 — Welcome feature cards use unexplained niche terms — **P3**
- **Where:** `StepWelcome.jsx:2-5` — "yogas, doshas, dashas", "Guna Milan + deep synastry", "Vedic D1", "Chaldean + Pythagorean".
- **Current behavior:** Acceptable for astrology-curious users, but "D1" in particular is insider shorthand on the very first screen.
- **Fix direction:** Swap the most technical terms for outcomes ("your birth chart", "compatibility matching").

### COPY-05 — Raw dosha keys and koota keys leak into UI — rolled into CHART-04 / MATCH-01.

---

## 13. Dead / orphaned surfaces (DEAD)

### DEAD-01 — "Today" is fully built plumbing with no UI — **P1** *(product decision needed)*
- **Where:** `src/lib/llm/tabConfig.js:46` defines a `today` tab framing; `src/lib/storage/today.js` defines `getTodayTransit`/`saveTodayTransit`; `src/lib/storage/db.js:205` hydrates a `today` store. **No component imports any of it** (verified by grep). `useChat` is only ever called with `chat`/`numbers`/`match` (`src/hooks/useChat.js:10` + call sites).
- **Current behavior:** The daily-read surface the config promises is unreachable. Users can ask for a daily read in chat (a starter prompt exists), but the dedicated surface is dead code.
- **Why it matters:** Beyond wasted code, this violates the repo's own CLAUDE.md sync rule (agent-reachable data with no UI surface), and a "Today" tab is arguably the strongest daily-retention surface an astrology app can have.
- **Fix direction:** Decide: ship a Today tab (wiring exists end-to-end) or delete the orphaned config/storage.

### DEAD-02 — `chart` tab framing defined but never invoked — **P2**
- **Where:** `src/lib/llm/tabConfig.js:47`.
- **Current behavior:** Same pattern as DEAD-01 — a `chart` chat framing exists but no surface uses it (the chart panel lives inside the `chat` tab, NAV-04).
- **Fix direction:** Resolve together with NAV-04 (promote Chart to a tab, or remove the framing).

---

## 14. Suggested fix order

Ordered by user impact per unit of effort:

1. **NAV-01** — mobile profile/key management (P0; largest stranded-user segment).
2. **ERR-03 cluster (ONB-03, ONB-04, ONB-06)** — un-silence the birth-details failures; small catches + inline messages protect the highest-investment flow.
3. **ERR-02 / CHAT-01** — one error-mapping helper; human-readable messages in chat, compute, and match.
4. **Jargon glossing sweep (CHART-04, MATCH-01, MATCH-02, NUM-01, NUM-02, NUM-03)** — reuse `reference.js` primitives + the `VARGA_NAMES` pattern; this closes the split-personality gap and honors the app's own layman policy.
5. **A11Y quick wins (A11Y-03 global focus ring, A11Y-01 live regions, CHART-01 SVG label, ONB-08 delete confirm)** — small diffs, large compliance gains.
6. **CHART-02 legend** — makes the core artifact readable.
7. **A11Y-06 contrast + A11Y-07 color-only encodings (MATCH-03, MATCH-05)** — token tweaks + shape channels.
8. **NAV-06/ERR-04** — steady-state engine status + failure banner.
9. **NAV-02** — tabs → routes.
10. **DEAD-01** — decide Today's fate.
11. **Modals (ONB-10/A11Y-05), autocomplete (ONB-05), onboarding back (ONB-01), provider-switch wipe (ONB-02), clear-key confirm (ONB-09)** — onboarding/dialog batch.
12. **Chat comfort (CHAT-04 scroll, CHAT-03 retry, CHAT-02 dismissible errors, CHAT-06 chartless gating, CHAT-07 supportsTools notice)**.
13. **Polish batch (VIS-01…VIS-05, COPY-01…COPY-04, CHAT-08…CHAT-10, CHART-03, MATCH-04, MATCH-06, MATCH-07, NAV-03, NAV-07, ONB-07, ONB-11, ERR-01, A11Y-09, CHAT-12)**.

---

## 15. Full findings index

| ID | Severity | One-liner |
|---|---|---|
| NAV-01 | P0 | Mobile has no profile/key/status management — sidebar is desktop-only |
| NAV-02 | P1 | Tabs are state, not routes: back button & deep links broken |
| NAV-03 | P2 | No 404; unknown URLs silently bounce |
| NAV-04 | P1 | Chart hidden behind an emoji toggle inside Chat |
| NAV-05 | P2 | Tab bars lack ARIA tab semantics |
| NAV-06 | P1 | Engine boot invisible in steady state; nothing at all on mobile |
| NAV-07 | P3 | `bg-bg` undefined class on the first loading screen |
| ONB-01 | P2 | No back navigation in the wizard |
| ONB-02 | P2 | Switching provider wipes the typed key |
| ONB-03 | P1 | Geocode errors computed but never displayed |
| ONB-04 | P1 | Timezone failure = silent no-op on submit (try/finally, no catch) |
| ONB-05 | P2 | Autocomplete not keyboard-accessible; raw geocoder strings |
| ONB-06 | P2 | Compute step dead-ends at 0% without birthData |
| ONB-07 | P3 | Progress bar jumps in 25% steps; longest step looks stalled |
| ONB-08 | P1 | Profile delete is one click, no confirmation |
| ONB-09 | P2 | Clear-key instantly ejects to onboarding, no confirm |
| ONB-10 | P1 | Modals lack dialog role, focus trap, Escape |
| ONB-11 | P3 | Gender field's effect on Match not stated |
| CHAT-01 | P1 | Raw provider errors shown; no retry/backoff |
| CHAT-02 | P2 | Error bar lingers, not dismissible, not announced |
| CHAT-03 | P2 | No retry/regenerate affordance |
| CHAT-04 | P2 | Auto-scroll yanks readers to bottom during streaming |
| CHAT-05 | P1 | No live region for streaming/tool activity |
| CHAT-06 | P2 | Greeting/prompts assume a chart that may not exist |
| CHAT-07 | P2 | `supportsTools` never surfaced; silent capability loss |
| CHAT-08 | P3 | Markdown: no table/pre styling despite GFM |
| CHAT-09 | P3 | Step-limit stop indistinguishable from other failures |
| CHAT-10 | P3 | No copy button / timestamps on messages |
| CHAT-11 | P2 | Chat textarea has no accessible label |
| CHAT-12 | P3 | Blunt persona on sensitive topics; no reflection framing (product call) |
| CHART-01 | P1 | Chart SVG invisible to screen readers |
| CHART-02 | P1 | No legend for planet codes / sign numbers |
| CHART-03 | P2 | House occupants silently truncate at 5 |
| CHART-04 | P1 | Dasha/Yoga/Dosha pills = raw jargon + raw keys |
| CHART-05 | P2 | No loading/error state for the chart panel |
| NUM-01 | P2 | "Pyth:" cross-check unexplained |
| NUM-02 | P2 | Lo Shu Kua/Arrows terminology unexplained |
| NUM-03 | P3 | Number cards lack meaning captions (reference.js has them) |
| NUM-04 | P2 | No loading/empty state before numerology exists |
| MATCH-01 | P1 | Guna koota tables are raw Sanskrit labels |
| MATCH-02 | P1 | /36 and /10 scores with no scale context |
| MATCH-03 | P1 | Combined grid distinguishes partners by color only |
| MATCH-04 | P2 | Combined grid = dense esoteric wall at 10-11px |
| MATCH-05 | P1 | Red/green-only supportive/challenging encoding |
| MATCH-06 | P2 | Match results in a 45%-height scroll box on mobile |
| MATCH-07 | P3 | "Kundali Match" / "Match" / "Kundli" naming drift |
| A11Y-01 | P1 | No aria-live for any dynamic content |
| A11Y-02 | P2 | (= NAV-05) tab semantics |
| A11Y-03 | P1 | No visible keyboard focus anywhere; outlines removed |
| A11Y-04 | P1 | Mouse-only controls (profile rows, autocomplete) |
| A11Y-05 | P1 | (= ONB-10) modal accessibility |
| A11Y-06 | P1 | Muted text ~3.3:1, below WCAG AA |
| A11Y-07 | P1 | Color-only encodings (consolidates MATCH-03/05) |
| A11Y-08 | P1 | (= CHART-01) unlabeled SVG |
| A11Y-09 | P2 | Placeholder-only textarea label; 10px nav labels |
| ERR-01 | P2 | No offline/network-state messaging |
| ERR-02 | P1 | Raw err.message in chat, compute, and match |
| ERR-03 | P1 | Silent-failure cluster on the birth-details path |
| ERR-04 | P2 | No steady-state engine-failure surface |
| VIS-01 | P2 | Placeholder title/favicon/meta ("Astro" + Vite logo) |
| VIS-02 | P3 | No typographic identity (system sans everywhere) |
| VIS-03 | P3 | Emoji as primary iconography |
| VIS-04 | P3 | GitHub star pill causes layout shift |
| VIS-05 | P3 | Light-first tokens fight the dark sidebar (missing dark-text tokens) |
| COPY-01 | P2 | "Never uploaded" contradicts disclosed geocoding |
| COPY-02 | P2 | "browser CORS" / "model id" developer-speak in onboarding |
| COPY-03 | P3 | "Python engine" leaks implementation detail |
| COPY-04 | P3 | "Vedic D1" etc. on the first screen |
| COPY-05 | — | (rolled into CHART-04 / MATCH-01) |
| DEAD-01 | P1 | "Today" surface fully plumbed, zero UI — ship or delete |
| DEAD-02 | P2 | `chart` tab framing defined, never invoked |
