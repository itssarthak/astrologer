# [APP_NAME] — Design Spec
**Date:** 2026-06-07  
**Stack:** React + Vite  
**Backend:** None  
**Status:** Approved

---

## 1. Overview

A public-facing, fully client-side Vedic astrology web app. Users enter their own LLM API key and birth details, and get a personal astrology experience — daily transit reads, birth chart, Kundali Match, and numerology. All computation runs in the browser via Pyodide (CPython compiled to WebAssembly). Nothing is uploaded to any server.

**Core principle:** Code computes, LLM interprets. The LLM receives only structured data computed by Python — it never estimates, guesses, or fills in astrological facts.

---

## 2. Privacy Model

- No backend, no database, no accounts
- All data (profiles, API key, computed charts) stored in browser `localStorage`
- API key goes directly from browser to the chosen LLM provider — no proxy
- Birth data never leaves the device
- Open source
- **Analytics:** Google Analytics 4 (GA4) for app usage only — page views, feature interactions, error rates. Birth data, chart data, and API keys are never sent to GA.
- **Yoga/dosha computation:** When `VITE_PYJHORA_API_URL` is configured, birth data is sent to the Lambda for PyJHora processing. It is computed and immediately discarded — never stored, never logged. All other data stays on device.

Copy rule: never use the word "ever" in privacy claims.

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite |
| Python runtime | Pyodide (CPython → WebAssembly), shipped via npm, cached via service worker |
| Astrology compute | `jyotishganit` (via Pyodide) — D1 + D9 (Navamsa) charts |
| Divisional charts | D1 (main) + D9 (Navamsa, marriage/dharma) rendered in V1 |
| Yoga/dosha detect | **Primary:** AWS Lambda running PyJHora (full catalog) — called when `VITE_PYJHORA_API_URL` is set. **Fallback:** hand-rolled top-25 classical yogas + all doshas in pure Python via Pyodide (used when env var is absent, e.g. self-hosted forks) |
| Numerology | Pure Python (Chaldean primary, Pythagorean cross-check) |
| Synastry | Pure Python (Guna Milan Ashtakoota + house overlays via jyotishganit) |
| Chart rendering | SVG/HTML — North Indian D1 grid, scales to viewport width |
| LLM providers | Claude (Anthropic), Gemini (Google), OpenAI — direct browser API calls |
| Storage | `localStorage` (profiles, chat, keys) + IndexedDB (ephemeris cache) |
| Geocoding | OpenStreetMap Nominatim — free, no API key required |
| Analytics | Google Analytics 4 (GA4) — usage only, no personal data |
| Styling | Tailwind CSS v4, Warm Saffron theme |

**Pyodide delivery:**
- `pyodide` npm package bundled with the app (shipped, not CDN)
- WASM + Python packages cached by service worker after first load
- `de421.bsp` ephemeris (~17MB) + `hip_main.dat` fetched on first run, stored in IndexedDB — subsequent loads instant

---

## 4. Visual Design

**Theme:** Warm Saffron  
- Background: `#fdf6ee`  
- Surface: `#fff8f0`  
- Border: `#e8d5b7`  
- Primary: `#c45c1a`  
- Text: `#3a2010` / `#5a3a2a`  
- Muted: `#b89070` / `#8a7060`  
- User bubble: `#fde8d0`

---

## 5. App Structure

### 5.1 Routing

```
/              → onboarding (if no profile exists) OR main app (if profile exists)
/onboarding    → 4-step setup flow
/app           → main app (requires profile + API key)
```

### 5.2 Onboarding (4 steps, one-time)

**Step 1 — Welcome**
- App logo + name `[APP_NAME]` (placeholder)
- Privacy hero card (dark, leads everything):
  - "🔒 100% private by design"
  - "Your birth data never leaves your device. No servers, no accounts, no tracking."
  - Pills: No sign-up · No cloud storage · No tracking · Open source
- Feature list (below privacy):
  - ☀ Daily Transit Read
  - ◈ Birth Chart
  - ⊕ Kundali Match
  - ∞ Numerology
- CTA: "Get Started →"

**Step 2 — API Key**
- Provider selector: Claude / Gemini / OpenAI
- API key input (masked)
- "How do I get an API key?" link (opens provider docs)
- Stored in `localStorage` as `{ provider, key }` (see §6 Data Architecture)

**Step 3 — Birth Details**
- Fields: Full name, Date of birth, Time of birth, Place of birth
- Place field geocodes to lat/lon client-side (OpenStreetMap Nominatim — no API key required)
- Stored as Profile #1 in `localStorage.profiles`

**Step 4 — Computing**
- Pyodide initialises, downloads ephemeris if needed
- Progress checklist with rotating contextual messages while each step runs:
  - "Loading Python engine..." → "Ephemeris loaded ✓"
  - "Reading the stars..." → "Birth chart computed ✓"
  - "Checking yogas & doshas..." → "Yogas & doshas ✓"
  - "Crunching your numbers..." → "Numerology profile ✓"
- Messages rotate within each step to avoid silent spinning (e.g. "This takes ~15s on first load, the star catalogue is 17MB")
- On complete → redirect to `/app`

---

### 5.3 Main App Layout

```
┌─────────────────────────────────────────────────────────┐
│  SIDEBAR (200px)          │  MAIN AREA                  │
│                           │                             │
│  🪐 [APP_NAME]            │  [ Chat ][ Today ][ Chart ] │
│                           │  [ Numbers ][ Match ]       │
│  Profiles                 │─────────────────────────────│
│  ● Sarthak (active)       │                             │
│    Tanya                  │  COMPUTED CARD              │
│  + Add profile            │  (Pyodide output → LLM)     │
│                           │                             │
│  ─────────────────        │  ─────────────────          │
│  ⚙ API Key & Provider     │  INLINE CHAT                │
│  ● Python engine ready    │  (follow-up questions,      │
│                           │   same computed context)    │
│                           │  [ input ][ Send → ]        │
└─────────────────────────────────────────────────────────┘
```

**Sidebar:**
- Profile list (click to switch active profile)
- "Add profile" → same birth details form as onboarding step 3, no re-onboarding
- API Key & Provider settings (editable)
- Pyodide status indicator (loading / ready / error)

---

### 5.4 Tabs

All tabs follow the same pattern: **computed card on top, inline chat below**.

#### Chat tab
- General conversation with the astrologer
- System prompt: astro SOUL.md personality + full active profile chart context
- No computed card — pure chat
- History persisted in `localStorage` per profile

#### Today tab
- Auto-computes on open (or when date changes since last compute)
- Pyodide runs transit script: current planetary positions → natal house hits + panchanga + dasha
- LLM receives computed JSON → outputs plain English transit read
- Card shows: effect bullets, Do today / Don't today tags, one-line summary
- Inline chat: follow-up questions with transit data already in context

#### Chart tab
- Computed once on profile creation, cached in `localStorage.profiles[n].chart`
- SVG North Indian D1 kundli renderer (scales to viewport width, no image)
- Sub-tab within Chart: **D1** (birth chart) and **D9** (Navamsa — marriage/dharma direction)
- Card shows: key facts (lagna, active dasha, top yogas, doshas)
- Inline chat: questions about the chart, with full chart JSON in context

#### Numbers tab (Numerology)
- Computed once on profile creation, cached in `localStorage.profiles[n].numerology`
- Chaldean (primary) + Pythagorean (cross-check)
- Card shows: Life Path, Destiny/Expression, Soul Urge, Personality, Personal Year
- Inline chat: questions about the numerology profile

#### Match tab (Kundali Match)
- Profile selector: active profile + any other saved profile
- Pyodide computes: Guna Milan Ashtakoota (36-point) + house overlays
- Card shows: total score + 8-koota breakdown, key house overlay findings
- Inline chat: deep questions with synastry data in context
- Requires at least 2 profiles to be set up

---

## 6. Data Architecture

### Profile (localStorage)
```json
{
  "id": "uuid-v4",
  "name": "Sarthak Chhabra",
  "dob": "1996-11-22",
  "time": "13:06",
  "place": "Delhi, India",
  "lat": 28.6139,
  "lon": 77.2090,
  "timezone_offset": 5.5,
  "chart": { /* full jyotishganit JSON, cached */ },
  "numerology": { /* Chaldean + Pythagorean profile, cached */ },
  "createdAt": "2026-06-07T10:00:00Z"
}
```

### API Key (localStorage)
```json
{
  "provider": "claude",
  "key": "sk-ant-..."
}
```

### Chat history (localStorage, per profile per tab)
```json
{
  "profileId:tab": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

---

## 7. Computation Layer

All Python runs inside Pyodide. Scripts live in `src/lib/pyodide/scripts/`.

| Script | Input | Output |
|---|---|---|
| `chart.py` | name, dob, time, lat, lon, tz_offset | Full jyotishganit chart JSON (D1–D60) |
| `transit.py` | natal chart JSON, current datetime, lat/lon | Planet positions → natal house hits, panchanga, dasha |
| `yogas.py` | chart JSON | Fallback only: top ~25 classical yogas (used when Lambda unavailable) |
| `doshas.py` | chart JSON | Fallback only: dosha presence/absence with exemption notes |
| `numerology.py` | full name, dob | Chaldean + Pythagorean profile |
| `synastry.py` | chart JSON A, chart JSON B | Guna Milan score + breakdown + house overlays |

**PyJHora Lambda (`VITE_PYJHORA_API_URL`):**
- Input: `{ name, dob, time, lat, lon, tz_offset }`
- Output: `{ yogas_active, doshas }` — full PyJHora catalog
- Stateless — no logging, no storage
- Falls back to `yogas.py` + `doshas.py` if the env var is absent or the call fails

**Pyodide lifecycle:**
- Singleton — initialised once on app start, reused across all tabs
- Ephemeris files fetched to Pyodide's in-memory FS on first run, then IndexedDB-cached
- Loading state shown in sidebar status indicator

---

## 8. LLM Layer

### Unified interface
```js
llm.chat({ messages, systemPrompt, onChunk })
// returns streaming response
// handles Claude / Gemini / OpenAI differences internally
```

### System prompt construction (per tab)
- Base: astro SOUL.md personality (tone, rules, plain-English mandate)
- + Active profile USER context (name, cached chart summary)
- + Tab-specific computed JSON (transit data / chart facts / numerology / synastry)

### LLM never receives:
- Raw birth data to interpret astrologically
- Requests to compute planetary positions
- Requests to evaluate yogas or doshas

---

## 9. File Structure

```
src/
  main.jsx
  App.jsx
  router.jsx

  pages/
    Onboarding.jsx          # 4-step flow
    App.jsx                 # main app shell

  components/
    Sidebar/
      Sidebar.jsx
      ProfileItem.jsx
      AddProfileModal.jsx   # birth details form
      ApiKeyModal.jsx
    Tabs/
      TabBar.jsx
      ChatTab.jsx
      TodayTab.jsx
      ChartTab.jsx
      NumbersTab.jsx
      MatchTab.jsx
    Chat/
      ChatMessage.jsx
      ChatInput.jsx
    Kundli/
      KundliChart.jsx       # SVG North Indian D1 renderer
    shared/
      ComputedCard.jsx
      PrivacyBadge.jsx

  hooks/
    usePyodide.js           # singleton init + compute runner
    useProfiles.js          # localStorage CRUD
    useLLM.js               # provider-agnostic chat
    useChat.js              # conversation state per profile+tab

  lib/
    pyodide/
      index.js              # Pyodide init + script runner
      scripts/
        chart.py
        transit.py
        yogas.py
        doshas.py
        numerology.py
        synastry.py
    llm/
      claude.js
      gemini.js
      openai.js
      index.js              # unified interface
    prompts/
      soul.js               # astro personality as system prompt
      formatters.js         # computed JSON → prompt context per tab
    storage/
      profiles.js
      keys.js
      chat.js

  assets/
    soul.md                 # astro SOUL.md bundled

  styles/
    theme.css               # saffron color tokens

backend/
  handler.py                # AWS Lambda entry point
  requirements.txt          # pyjhora, pyswisseph, etc.
  README.md                 # deploy instructions (sam/serverless/manual)
```

---

## 10. Responsive Design

The app must be fully usable on mobile, tablet, and desktop. Responsive by design — not a desktop-first afterthought.

**Breakpoints:**
- Mobile (< 640px): sidebar collapses to a bottom nav bar or hamburger drawer; tabs stack vertically; computed cards full-width
- Tablet (640px–1024px): sidebar shows as a collapsible drawer; tabs horizontal
- Desktop (> 1024px): full sidebar + tabbed layout as designed

**Layout adaptations:**
- Sidebar → bottom navigation on mobile (profile avatar + tab icons)
- Computed card + chat → single scrollable column on mobile
- Kundli SVG chart → scales to fill available width
- Onboarding steps → full-screen cards on mobile, centred panel on desktop

---

## 11. PyJHora Backend

**Runtime:** AWS Lambda, Python 3.11  
**Trigger:** HTTPS via Lambda Function URL (no API Gateway needed)  
**Env var:** `VITE_PYJHORA_API_URL` — set in `.env` for the deployed app, absent for self-hosted forks

**Request:**
```json
{ "name": "Sarthak", "dob": "1996-11-22", "time": "13:06", "lat": 28.6139, "lon": 77.2090, "tz_offset": 5.5 }
```

**Response:**
```json
{ "yogas_active": [...], "doshas": { "manglik": {...}, "kala_sarpa": {...}, ... } }
```

**Fallback logic in `usePyodide.js`:**
```js
if (import.meta.env.VITE_PYJHORA_API_URL) {
  result = await fetchLambda(birthData)   // PyJHora full catalog
} else {
  result = await pyodide.runPython(yogasScript, chartJson)  // hand-rolled top-25
}
```

**Cost:** AWS Lambda free tier covers ~800K chart computations/month at 256MB / 2s per call.  
**Privacy:** stateless — birth data processed in-flight, nothing stored or logged.

---

## 12. Out of Scope (V1)

- Paid tier / server-side LLM calls
- Chart image export / PDF
- Multiple languages

---

## 13. Open Questions

- Final app name (placeholder: `[APP_NAME]`)
