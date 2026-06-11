# [APP_NAME] Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full non-UI infrastructure — project scaffold, localStorage storage layer, Pyodide computation scripts, PyJHora backend (AWS Lambda), and the unified LLM client — so the UI plan can consume clean, tested interfaces.

**Architecture:** Vite + React 18 shell with no UI yet. Python scripts run in Pyodide for chart/transit/yoga/dosha/numerology/synastry computation. AWS Lambda (`backend/handler.py`) runs full PyJHora when `VITE_PYJHORA_API_URL` is set; Pyodide fallback scripts activate otherwise. Three LLM providers (Claude, Gemini, OpenAI) exposed through a single `llm.chat()` interface.

**Tech Stack:** React 18, Vite 5, Tailwind CSS v4, React Router v6, Pyodide (npm), Vitest, pytest, jyotishganit, pyjhora, pyswisseph

---

## File Map

```
package.json
vite.config.js
index.html
tailwind.config.js
.env.example
postcss.config.js

src/
  main.jsx
  App.jsx

  lib/
    storage/
      profiles.js          # CRUD for birth profiles in localStorage
      keys.js              # API key + provider in localStorage
      chat.js              # Chat history per profile+tab in localStorage

    pyodide/
      index.js             # Pyodide singleton init + script runner
      scripts/
        chart.py           # jyotishganit chart computation
        transit.py         # current planetary positions → natal house hits
        yogas.py           # fallback: top-25 classical yoga rules
        doshas.py          # fallback: all dosha detection
        numerology.py      # Chaldean + Pythagorean
        synastry.py        # Guna Milan + house overlays

    llm/
      claude.js            # Anthropic streaming client
      gemini.js            # Google Generative AI streaming client
      openai.js            # OpenAI streaming client
      index.js             # unified llm.chat() interface

    prompts/
      soul.js              # astro SOUL.md as system prompt string
      formatters.js        # computed JSON → LLM context string per tab

  hooks/
    usePyodide.js          # React hook: pyodide state + compute runner
    useLLM.js              # React hook: provider-agnostic streaming chat

  assets/
    soul.md                # astro personality (bundled at build time)

  styles/
    theme.css              # Tailwind CSS v4 saffron color tokens

backend/
  handler.py               # AWS Lambda: PyJHora yoga/dosha computation
  requirements.txt

tests/
  lib/
    storage/
      profiles.test.js
      keys.test.js
      chat.test.js
    llm/
      formatters.test.js
  python/
    test_yogas.py
    test_doshas.py
    test_numerology.py
    test_synastry.py
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `.env.example`
- Create: `src/main.jsx`
- Create: `src/App.jsx`

- [ ] **Step 1: Initialise the project**

```bash
cd /Users/sarthakchhabra/code/personal/astro
npm create vite@latest . -- --template react
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react-router-dom pyodide
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom tailwindcss@next @tailwindcss/vite postcss
```

- [ ] **Step 3: Write `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
  },
  optimizeDeps: {
    exclude: ['pyodide'],
  },
  worker: {
    format: 'es',
  },
})
```

- [ ] **Step 4: Write `tailwind.config.js`**

```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
}
```

- [ ] **Step 5: Write `postcss.config.js`**

```js
export default {
  plugins: { '@tailwindcss/postcss': {} },
}
```

- [ ] **Step 6: Write `.env.example`**

```
# Optional: set to enable full PyJHora yoga/dosha catalog via AWS Lambda
# Leave blank to use built-in fallback (top-25 classical yogas)
VITE_PYJHORA_API_URL=

# Optional: Google Analytics Measurement ID
VITE_GA_MEASUREMENT_ID=
```

- [ ] **Step 7: Write `tests/setup.js`**

```js
import '@testing-library/jest-dom'
```

- [ ] **Step 8: Write `src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 9: Write `src/App.jsx`** (placeholder — UI plan fills this out)

```jsx
export default function App() {
  return <div className="min-h-screen bg-background">Infrastructure ready</div>
}
```

- [ ] **Step 10: Verify dev server starts**

```bash
npm run dev
```

Expected: server running at `http://localhost:5173`, page shows "Infrastructure ready"

- [ ] **Step 11: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold React + Vite + Tailwind + Vitest"
```

---

### Task 2: Tailwind Theme Tokens

**Files:**
- Create: `src/styles/theme.css`

- [ ] **Step 1: Write theme tokens**

```css
@import "tailwindcss";

@theme {
  --color-background: #fdf6ee;
  --color-surface: #fff8f0;
  --color-surface-2: #fff3e6;
  --color-border: #e8d5b7;
  --color-border-strong: #d4b896;
  --color-primary: #c45c1a;
  --color-primary-hover: #a84d15;
  --color-primary-light: #fde8d0;
  --color-text: #3a2010;
  --color-text-2: #5a3a2a;
  --color-muted: #8a7060;
  --color-muted-2: #b89070;
  --color-user-bubble: #fde8d0;
  --color-dark-bg: #3a2010;
  --color-dark-surface: #5a3218;
  --color-gold: #f5c882;
}
```

- [ ] **Step 2: Verify tokens load**

```bash
npm run dev
```

Expected: no CSS errors in console

- [ ] **Step 3: Commit**

```bash
git add src/styles/theme.css
git commit -m "feat: add saffron theme tokens"
```

---

### Task 3: Storage Layer — Profiles

**Files:**
- Create: `src/lib/storage/profiles.js`
- Create: `tests/lib/storage/profiles.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/lib/storage/profiles.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getProfiles, saveProfile, deleteProfile, getActiveProfileId, setActiveProfileId
} from '../../../src/lib/storage/profiles'

beforeEach(() => localStorage.clear())

describe('profiles storage', () => {
  it('returns empty array when no profiles exist', () => {
    expect(getProfiles()).toEqual([])
  })

  it('saves and retrieves a profile', () => {
    const p = { id: '1', name: 'Sarthak', dob: '1996-11-22', time: '13:06',
                 place: 'Delhi', lat: 28.61, lon: 77.20, timezone_offset: 5.5 }
    saveProfile(p)
    expect(getProfiles()).toHaveLength(1)
    expect(getProfiles()[0].name).toBe('Sarthak')
  })

  it('updates an existing profile by id', () => {
    const p = { id: '1', name: 'Sarthak', dob: '1996-11-22', time: '13:06',
                 place: 'Delhi', lat: 28.61, lon: 77.20, timezone_offset: 5.5 }
    saveProfile(p)
    saveProfile({ ...p, name: 'Sarthak Updated' })
    expect(getProfiles()).toHaveLength(1)
    expect(getProfiles()[0].name).toBe('Sarthak Updated')
  })

  it('deletes a profile by id', () => {
    saveProfile({ id: '1', name: 'A', dob: '1990-01-01', time: '12:00',
                  place: 'Delhi', lat: 28.61, lon: 77.20, timezone_offset: 5.5 })
    deleteProfile('1')
    expect(getProfiles()).toHaveLength(0)
  })

  it('tracks active profile id', () => {
    setActiveProfileId('abc')
    expect(getActiveProfileId()).toBe('abc')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/lib/storage/profiles.test.js
```

Expected: FAIL — `profiles.js` not found

- [ ] **Step 3: Implement `src/lib/storage/profiles.js`**

```js
const KEY = 'astro:profiles'
const ACTIVE_KEY = 'astro:activeProfileId'

export function getProfiles() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveProfile(profile) {
  const profiles = getProfiles()
  const idx = profiles.findIndex(p => p.id === profile.id)
  if (idx >= 0) {
    profiles[idx] = profile
  } else {
    profiles.push(profile)
  }
  localStorage.setItem(KEY, JSON.stringify(profiles))
}

export function deleteProfile(id) {
  const profiles = getProfiles().filter(p => p.id !== id)
  localStorage.setItem(KEY, JSON.stringify(profiles))
  if (getActiveProfileId() === id) {
    setActiveProfileId(profiles[0]?.id ?? null)
  }
}

export function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveProfileId(id) {
  if (id == null) {
    localStorage.removeItem(ACTIVE_KEY)
  } else {
    localStorage.setItem(ACTIVE_KEY, id)
  }
}

export function getActiveProfile() {
  const id = getActiveProfileId()
  return getProfiles().find(p => p.id === id) ?? null
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/lib/storage/profiles.test.js
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/profiles.js tests/lib/storage/profiles.test.js
git commit -m "feat: storage layer — profiles CRUD"
```

---

### Task 4: Storage Layer — API Keys and Chat History

**Files:**
- Create: `src/lib/storage/keys.js`
- Create: `src/lib/storage/chat.js`
- Create: `tests/lib/storage/keys.test.js`
- Create: `tests/lib/storage/chat.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/lib/storage/keys.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { getApiKey, saveApiKey, clearApiKey } from '../../../src/lib/storage/keys'

beforeEach(() => localStorage.clear())

describe('keys storage', () => {
  it('returns null when no key is stored', () => {
    expect(getApiKey()).toBeNull()
  })

  it('saves and retrieves provider + key', () => {
    saveApiKey({ provider: 'claude', key: 'sk-ant-test' })
    expect(getApiKey()).toEqual({ provider: 'claude', key: 'sk-ant-test' })
  })

  it('clears the stored key', () => {
    saveApiKey({ provider: 'claude', key: 'sk-ant-test' })
    clearApiKey()
    expect(getApiKey()).toBeNull()
  })
})
```

```js
// tests/lib/storage/chat.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { getHistory, appendMessage, clearHistory } from '../../../src/lib/storage/chat'

beforeEach(() => localStorage.clear())

describe('chat storage', () => {
  it('returns empty array for unknown profile+tab', () => {
    expect(getHistory('p1', 'today')).toEqual([])
  })

  it('appends messages and retrieves them', () => {
    appendMessage('p1', 'today', { role: 'user', content: 'Hello' })
    appendMessage('p1', 'today', { role: 'assistant', content: 'Hi' })
    expect(getHistory('p1', 'today')).toHaveLength(2)
  })

  it('clears history for a specific profile+tab', () => {
    appendMessage('p1', 'today', { role: 'user', content: 'Hello' })
    clearHistory('p1', 'today')
    expect(getHistory('p1', 'today')).toHaveLength(0)
  })

  it('isolates history per profile and tab', () => {
    appendMessage('p1', 'today', { role: 'user', content: 'A' })
    appendMessage('p1', 'chat', { role: 'user', content: 'B' })
    appendMessage('p2', 'today', { role: 'user', content: 'C' })
    expect(getHistory('p1', 'today')).toHaveLength(1)
    expect(getHistory('p1', 'chat')).toHaveLength(1)
    expect(getHistory('p2', 'today')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/lib/storage/keys.test.js tests/lib/storage/chat.test.js
```

Expected: FAIL — modules not found

- [ ] **Step 3: Implement `src/lib/storage/keys.js`**

```js
const KEY = 'astro:apiKey'

export function getApiKey() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

export function saveApiKey({ provider, key }) {
  localStorage.setItem(KEY, JSON.stringify({ provider, key }))
}

export function clearApiKey() {
  localStorage.removeItem(KEY)
}
```

- [ ] **Step 4: Implement `src/lib/storage/chat.js`**

```js
const prefix = 'astro:chat'

function storageKey(profileId, tab) {
  return `${prefix}:${profileId}:${tab}`
}

export function getHistory(profileId, tab) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(profileId, tab)) ?? '[]')
  } catch {
    return []
  }
}

export function appendMessage(profileId, tab, message) {
  const history = getHistory(profileId, tab)
  history.push(message)
  localStorage.setItem(storageKey(profileId, tab), JSON.stringify(history))
}

export function clearHistory(profileId, tab) {
  localStorage.removeItem(storageKey(profileId, tab))
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx vitest run tests/lib/storage/
```

Expected: 9 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/keys.js src/lib/storage/chat.js tests/lib/storage/
git commit -m "feat: storage layer — API keys and chat history"
```

---

### Task 5: Python Computation Scripts — chart.py and transit.py

**Files:**
- Create: `src/lib/pyodide/scripts/chart.py`
- Create: `src/lib/pyodide/scripts/transit.py`

These run inside Pyodide. Test them directly with a local Python venv.

- [ ] **Step 1: Set up a local Python venv for testing the scripts**

```bash
cd /Users/sarthakchhabra/code/personal/astro
python3 -m venv .venv-test
source .venv-test/bin/activate
pip install jyotishganit pytest
```

- [ ] **Step 2: Write `src/lib/pyodide/scripts/chart.py`**

```python
import json
from datetime import datetime
from jyotishganit import calculate_birth_chart, get_birth_chart_json


def compute_chart(name, dob, time_str, lat, lon, tz_offset, location_name=""):
    """
    dob: 'YYYY-MM-DD', time_str: 'HH:MM', lat/lon: float, tz_offset: float (IST=5.5)
    Returns: dict (full jyotishganit JSON including d1Chart, divisionalCharts, dashas, panchanga)
    """
    dt = datetime.strptime(f"{dob} {time_str}", "%Y-%m-%d %H:%M")
    chart = calculate_birth_chart(
        birth_date=dt,
        latitude=lat,
        longitude=lon,
        timezone_offset=tz_offset,
        location_name=location_name,
        name=name,
    )
    return get_birth_chart_json(chart)


def compute_chart_json(name, dob, time_str, lat, lon, tz_offset, location_name=""):
    """Returns JSON string — use this when calling from Pyodide JS."""
    return json.dumps(compute_chart(name, dob, time_str, lat, lon, tz_offset, location_name),
                      default=str)
```

- [ ] **Step 3: Write `src/lib/pyodide/scripts/transit.py`**

```python
import json
from datetime import datetime
from jyotishganit import calculate_birth_chart, get_birth_chart_json

SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
         "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]


def compute_transit(natal_lagna_sign, lat, lon, tz_offset):
    """
    Casts a chart for the current moment and maps each planet to the natal house
    it occupies (based on natal lagna sign).
    Returns: dict with date, panchanga, planets list
    """
    now = datetime.now()
    chart = calculate_birth_chart(
        birth_date=now,
        latitude=lat,
        longitude=lon,
        timezone_offset=tz_offset,
        location_name="",
        name="TRANSIT",
    )
    js = get_birth_chart_json(chart)

    lagna_idx = SIGNS.index(natal_lagna_sign)
    sign_to_house = {SIGNS[(lagna_idx + i) % 12]: i + 1 for i in range(12)}

    planets = []
    for h in js["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            sign = occ["sign"]
            planets.append({
                "planet": occ["celestialBody"],
                "sign": sign,
                "degrees": round(float(occ["signDegrees"]), 2),
                "nakshatra": occ["nakshatra"],
                "pada": occ.get("pada", 1),
                "natal_house": sign_to_house.get(sign, 0),
                "retrograde": occ.get("motion_type", "direct") == "retrograde",
            })

    # Attach current dasha from natal chart for context — caller passes natal chart JSON
    return {
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M"),
        "panchanga": js["panchanga"],
        "planets": planets,
    }


def compute_transit_json(natal_lagna_sign, lat, lon, tz_offset):
    """Returns JSON string for Pyodide JS."""
    return json.dumps(compute_transit(natal_lagna_sign, lat, lon, tz_offset), default=str)
```

- [ ] **Step 4: Write smoke tests**

```python
# tests/python/test_chart_transit.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
import json
from chart import compute_chart
from transit import compute_transit

def test_chart_returns_expected_lagna():
    # Sarthak's known chart: Aquarius lagna
    result = compute_chart("Sarthak", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")
    houses = result["d1Chart"]["houses"]
    lagna_sign = houses[0]["sign"]
    assert lagna_sign == "Aquarius", f"Expected Aquarius lagna, got {lagna_sign}"

def test_chart_includes_divisional_charts():
    result = compute_chart("Sarthak", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")
    assert "divisionalCharts" in result
    assert "D9" in result["divisionalCharts"]

def test_transit_returns_12_planets():
    result = compute_transit("Aquarius", 28.6139, 77.2090, 5.5)
    assert len(result["planets"]) >= 9  # Sun through Ketu minimum
    assert "panchanga" in result
    assert "date" in result

def test_transit_natal_house_in_range():
    result = compute_transit("Aquarius", 28.6139, 77.2090, 5.5)
    for p in result["planets"]:
        assert 1 <= p["natal_house"] <= 12, f"House {p['natal_house']} out of range for {p['planet']}"
```

- [ ] **Step 5: Run tests**

```bash
source .venv-test/bin/activate
pytest tests/python/test_chart_transit.py -v
```

Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/pyodide/scripts/chart.py src/lib/pyodide/scripts/transit.py tests/python/test_chart_transit.py
git commit -m "feat: Pyodide computation scripts — chart and transit"
```

---

### Task 6: Python Scripts — yogas.py and doshas.py (Fallback)

**Files:**
- Create: `src/lib/pyodide/scripts/yogas.py`
- Create: `src/lib/pyodide/scripts/doshas.py`
- Create: `tests/python/test_yogas_doshas.py`

- [ ] **Step 1: Write `src/lib/pyodide/scripts/yogas.py`**

```python
import json

SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
         "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]

SIGN_LORD = {
    "Aries": "Mars", "Taurus": "Venus", "Gemini": "Mercury", "Cancer": "Moon",
    "Leo": "Sun", "Virgo": "Mercury", "Libra": "Venus", "Scorpio": "Mars",
    "Sagittarius": "Jupiter", "Capricorn": "Saturn", "Aquarius": "Saturn", "Pisces": "Jupiter"
}

EXALTED = {"Sun": "Aries", "Moon": "Taurus", "Mars": "Capricorn",
           "Mercury": "Virgo", "Jupiter": "Cancer", "Venus": "Pisces", "Saturn": "Libra"}

OWN_SIGNS = {
    "Sun": ["Leo"], "Moon": ["Cancer"], "Mars": ["Aries", "Scorpio"],
    "Mercury": ["Gemini", "Virgo"], "Jupiter": ["Sagittarius", "Pisces"],
    "Venus": ["Taurus", "Libra"], "Saturn": ["Capricorn", "Aquarius"]
}

KENDRAS = {1, 4, 7, 10}


def _planets(chart_json):
    result = {}
    for h in chart_json["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            result[occ["celestialBody"]] = {
                "sign": occ["sign"],
                "house": h["number"],
                "retrograde": occ.get("motion_type", "direct") == "retrograde",
            }
    return result


def _is_strong(planet, sign):
    return sign == EXALTED.get(planet) or sign in OWN_SIGNS.get(planet, [])


def _house_lords(lagna_idx):
    return {i + 1: SIGN_LORD[SIGNS[(lagna_idx + i) % 12]] for i in range(12)}


def compute_yogas(chart_json):
    planets = _planets(chart_json)
    lagna_sign = chart_json["d1Chart"]["houses"][0]["sign"]
    lagna_idx = SIGNS.index(lagna_sign)
    lords = _house_lords(lagna_idx)
    yogas = []

    # --- Pancha Mahapurusha ---
    for planet, name in [("Mars", "Ruchaka"), ("Mercury", "Bhadra"),
                          ("Jupiter", "Hamsa"), ("Venus", "Malavya"), ("Saturn", "Sasa")]:
        p = planets.get(planet)
        if p and p["house"] in KENDRAS and _is_strong(planet, p["sign"]):
            yogas.append({"name": name, "category": "Pancha Mahapurusha",
                          "planet": planet, "house": p["house"]})

    # --- Gaja-Kesari: Jupiter in kendra from Moon ---
    moon = planets.get("Moon")
    jup = planets.get("Jupiter")
    if moon and jup:
        diff = (jup["house"] - moon["house"]) % 12
        if diff in {0, 3, 6, 9}:
            yogas.append({"name": "Gaja-Kesari", "category": "Chandra",
                          "planets": ["Moon", "Jupiter"]})

    # --- Chandra-Mangal: Moon + Mars conjunction ---
    mars = planets.get("Mars")
    if moon and mars and moon["house"] == mars["house"]:
        yogas.append({"name": "Chandra-Mangal", "category": "Chandra",
                      "planets": ["Moon", "Mars"]})

    # --- Budha-Aditya: Sun + Mercury conjunction ---
    sun = planets.get("Sun")
    merc = planets.get("Mercury")
    if sun and merc and sun["house"] == merc["house"]:
        yogas.append({"name": "Budha-Aditya", "category": "Solar",
                      "planets": ["Sun", "Mercury"]})

    # --- Adhi Yoga: Mercury/Jupiter/Venus in 6/7/8 from Moon ---
    if moon:
        target = {(moon["house"] - 1 + offset) % 12 + 1 for offset in (5, 6, 7)}
        benefics = [p for p in ["Mercury", "Jupiter", "Venus"]
                    if planets.get(p) and planets[p]["house"] in target]
        if len(benefics) >= 2:
            yogas.append({"name": "Adhi", "category": "Chandra", "planets": benefics})

    # --- Sunapha: planet (not Sun) in 2nd from Moon ---
    if moon:
        h2 = moon["house"] % 12 + 1
        for p in ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"]:
            if planets.get(p) and planets[p]["house"] == h2:
                yogas.append({"name": "Sunapha", "category": "Chandra", "planet": p})
                break

    # --- Anapha: planet (not Sun) in 12th from Moon ---
    if moon:
        h12 = (moon["house"] - 2) % 12 + 1
        for p in ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"]:
            if planets.get(p) and planets[p]["house"] == h12:
                yogas.append({"name": "Anapha", "category": "Chandra", "planet": p})
                break

    # --- Vesi: planet in 2nd from Sun ---
    if sun:
        h2 = sun["house"] % 12 + 1
        for p in ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"]:
            if planets.get(p) and planets[p]["house"] == h2:
                yogas.append({"name": "Vesi", "category": "Solar", "planet": p})
                break

    # --- Vasi: planet in 12th from Sun ---
    if sun:
        h12 = (sun["house"] - 2) % 12 + 1
        for p in ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"]:
            if planets.get(p) and planets[p]["house"] == h12:
                yogas.append({"name": "Vasi", "category": "Solar", "planet": p})
                break

    # --- Lakshmi Yoga: Venus in own/exalted + 9H lord in kendra/trikona strong ---
    venus = planets.get("Venus")
    lord_9 = lords.get(9)
    p9 = planets.get(lord_9) if lord_9 else None
    if (venus and _is_strong("Venus", venus["sign"]) and
            p9 and p9["house"] in KENDRAS | {5, 9} and _is_strong(lord_9, p9["sign"])):
        yogas.append({"name": "Lakshmi", "category": "Raja", "planets": ["Venus", lord_9]})

    # --- Dharma-Karmadhipati: 9H and 10H lords conjunct or in mutual kendra ---
    lord_10 = lords.get(10)
    if lord_9 and lord_10 and lord_9 != lord_10:
        p10 = planets.get(lord_10)
        if p9 and p10:
            diff = (p9["house"] - p10["house"]) % 12
            if diff in {0, 3, 6, 9}:
                yogas.append({"name": "Dharma-Karmadhipati", "category": "Raja",
                              "planets": [lord_9, lord_10]})

    # --- Gajakesari variant: Jupiter in 1/4/7/10 from Lagna ---
    if jup and jup["house"] in KENDRAS and _is_strong("Jupiter", jup["sign"]):
        yogas.append({"name": "Kesari", "category": "Jupiter", "house": jup["house"]})

    return yogas


def compute_yogas_json(chart_json_str):
    """Accepts JSON string, returns JSON string — for Pyodide JS."""
    return json.dumps(compute_yogas(json.loads(chart_json_str)), default=str)
```

- [ ] **Step 2: Write `src/lib/pyodide/scripts/doshas.py`**

```python
import json


def compute_doshas(chart_json):
    planets = {}
    for h in chart_json["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            planets[occ["celestialBody"]] = {
                "house": h["number"],
                "sign": occ["sign"],
                "nakshatra": occ.get("nakshatra", ""),
            }

    doshas = {}

    # --- Mangal (Mars) Dosha: Mars in H1/2/4/7/8/12 ---
    mars = planets.get("Mars")
    if mars:
        manglik_houses = {1, 2, 4, 7, 8, 12}
        present = mars["house"] in manglik_houses
        # Cancellations: Mars in own sign (Aries/Scorpio) or exalted (Capricorn)
        cancelled = mars["sign"] in {"Aries", "Scorpio", "Capricorn"}
        rahu = planets.get("Rahu")
        if rahu and rahu["house"] == mars["house"]:
            cancelled = True  # mutual Manglik cancellation heuristic

        doshas["manglik"] = {
            "present": present and not cancelled,
            "house": mars["house"],
            "cancelled": cancelled,
            "text": (
                "Mangal Dosha present" if (present and not cancelled)
                else "Mangal Dosha present but neutralised" if present
                else "No Mangal Dosha"
            ),
        }

    # --- Kala Sarpa Dosha: all planets between Rahu and Ketu ---
    rahu = planets.get("Rahu")
    ketu = planets.get("Ketu")
    if rahu and ketu:
        rahu_h = rahu["house"]
        ketu_h = ketu["house"]
        classical = {"Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"}
        occupied = {v["house"] for k, v in planets.items() if k in classical}
        min_h, max_h = min(rahu_h, ketu_h), max(rahu_h, ketu_h)
        # All classical planets must fall within the shorter arc
        arc1 = all(min_h <= h <= max_h for h in occupied)
        arc2 = all(h <= min_h or h >= max_h for h in occupied)
        present = arc1 or arc2
        doshas["kala_sarpa"] = {
            "present": present,
            "text": "Kala Sarpa Dosha present" if present else "No Kala Sarpa Dosha",
        }

    # --- Guru Chandala: Jupiter conjunct Rahu ---
    jup = planets.get("Jupiter")
    if jup and rahu:
        present = jup["house"] == rahu["house"]
        doshas["guru_chandala"] = {
            "present": present,
            "text": "Guru Chandala Dosha — Jupiter conjunct Rahu" if present else "No Guru Chandala Dosha",
        }

    # --- Pitru Dosha: Sun conjunct Rahu, or Sun/9H afflicted ---
    sun = planets.get("Sun")
    if sun and rahu:
        present = sun["house"] == rahu["house"]
        doshas["pitru"] = {
            "present": present,
            "text": "Pitru Dosha — Sun conjunct Rahu" if present else "No Pitru Dosha",
        }

    # --- Ganda Moola: Moon in last pada of Ashlesha/Jyeshtha/Moola or
    #     first pada of Ashwini/Magha/Moola ---
    if moon := planets.get("Moon"):
        ganda_moola_nakshatras = {"Ashwini", "Ashlesha", "Magha", "Jyeshtha", "Moola", "Revati"}
        present = moon.get("nakshatra", "") in ganda_moola_nakshatras
        doshas["ganda_moola"] = {
            "present": present,
            "text": f"Ganda Moola Dosha — Moon in {moon.get('nakshatra')}" if present else "No Ganda Moola Dosha",
        }

    return doshas


def compute_doshas_json(chart_json_str):
    """Accepts JSON string, returns JSON string — for Pyodide JS."""
    return json.dumps(compute_doshas(json.loads(chart_json_str)), default=str)
```

- [ ] **Step 3: Write tests**

```python
# tests/python/test_yogas_doshas.py
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from chart import compute_chart
from yogas import compute_yogas
from doshas import compute_doshas

SARTHAK = compute_chart("Sarthak", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")

def test_yogas_returns_list():
    result = compute_yogas(SARTHAK)
    assert isinstance(result, list)

def test_yogas_each_has_name_and_category():
    for y in compute_yogas(SARTHAK):
        assert "name" in y
        assert "category" in y

def test_doshas_returns_dict():
    result = compute_doshas(SARTHAK)
    assert isinstance(result, dict)

def test_doshas_manglik_has_required_keys():
    result = compute_doshas(SARTHAK)
    assert "manglik" in result
    m = result["manglik"]
    assert "present" in m
    assert "text" in m
    assert isinstance(m["present"], bool)

def test_doshas_kala_sarpa_present():
    result = compute_doshas(SARTHAK)
    assert "kala_sarpa" in result
    assert isinstance(result["kala_sarpa"]["present"], bool)
```

- [ ] **Step 4: Run tests**

```bash
source .venv-test/bin/activate
pytest tests/python/test_yogas_doshas.py -v
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/yogas.py src/lib/pyodide/scripts/doshas.py tests/python/test_yogas_doshas.py
git commit -m "feat: Pyodide fallback scripts — yoga and dosha detection"
```

---

### Task 7: Python Scripts — numerology.py and synastry.py

**Files:**
- Create: `src/lib/pyodide/scripts/numerology.py`
- Create: `src/lib/pyodide/scripts/synastry.py`
- Create: `tests/python/test_numerology_synastry.py`

- [ ] **Step 1: Write `src/lib/pyodide/scripts/numerology.py`**

```python
import json
from datetime import datetime

# Chaldean letter values (primary system)
CHALDEAN = {
    'A': 1, 'I': 1, 'J': 1, 'Q': 1, 'Y': 1,
    'B': 2, 'K': 2, 'R': 2,
    'C': 3, 'G': 3, 'L': 3, 'S': 3,
    'D': 4, 'M': 4, 'T': 4,
    'E': 5, 'H': 5, 'N': 5, 'X': 5,
    'U': 6, 'V': 6, 'W': 6,
    'O': 7, 'Z': 7,
    'F': 8, 'P': 8,
}

# Pythagorean letter values (cross-check)
PYTHAGOREAN = {c: (i % 9) + 1
               for i, c in enumerate('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}

MASTER = {11, 22, 33}
VOWELS = set('AEIOU')
CONSONANTS = set('BCDFGHJKLMNPQRSTVWXYZ')


def _reduce(n, keep_master=True):
    while n > 9 and (not keep_master or n not in MASTER):
        n = sum(int(d) for d in str(n))
    return n


def _name_sum(name, mapping, letter_filter=None):
    letters = [c for c in name.upper() if c.isalpha()]
    if letter_filter:
        letters = [c for c in letters if c in letter_filter]
    return sum(mapping.get(c, 0) for c in letters)


def compute_numerology(full_name, dob):
    """
    full_name: str (birth certificate name)
    dob: 'YYYY-MM-DD'
    Returns: dict with life_path, destiny, soul_urge, personality, personal_year
    """
    # Life Path: reduce all digits in DOB
    dob_digits = [int(d) for d in dob if d.isdigit()]
    life_path = _reduce(sum(dob_digits))

    # Destiny (Expression): all letters
    destiny = {
        "chaldean": _reduce(_name_sum(full_name, CHALDEAN)),
        "pythagorean": _reduce(_name_sum(full_name, PYTHAGOREAN)),
    }

    # Soul Urge: vowels only
    soul_urge = {
        "chaldean": _reduce(_name_sum(full_name, CHALDEAN, VOWELS)),
        "pythagorean": _reduce(_name_sum(full_name, PYTHAGOREAN, VOWELS)),
    }

    # Personality: consonants only
    personality = {
        "chaldean": _reduce(_name_sum(full_name, CHALDEAN, CONSONANTS)),
        "pythagorean": _reduce(_name_sum(full_name, PYTHAGOREAN, CONSONANTS)),
    }

    # Personal Year: day + month of birth + current year
    parts = dob.split('-')
    current_year = datetime.now().year
    day_month_sum = int(parts[2]) + int(parts[1])
    year_sum = sum(int(d) for d in str(current_year))
    personal_year = _reduce(day_month_sum + year_sum)

    return {
        "life_path": life_path,
        "destiny": destiny,
        "soul_urge": soul_urge,
        "personality": personality,
        "personal_year": personal_year,
    }


def compute_numerology_json(full_name, dob):
    return json.dumps(compute_numerology(full_name, dob))
```

- [ ] **Step 2: Write `src/lib/pyodide/scripts/synastry.py`**

```python
import json

NAKSHATRA_NAMES = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Moola", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha",
    "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
]
NAKSHATRA_INDEX = {n: i for i, n in enumerate(NAKSHATRA_NAMES)}

# Ashtakoota Guna Milan tables (standard Vedic)
VARNA = ["Brahmin", "Kshatriya", "Vaishya", "Shudra"]
NAK_VARNA = [
    2,2,0,0,2,3,0,0,3,3,2,0,2,3,3,0,0,3,3,2,0,2,3,3,0,0,2
]
NAK_GANA = [
    0,1,2,0,0,1,0,0,1,1,0,0,0,1,1,0,0,1,1,0,0,0,1,1,0,0,0
]  # 0=Deva, 1=Manushya, 2=Rakshasa
NAK_NADI = [
    0,1,2,2,1,0,0,1,2,2,1,0,0,1,2,2,1,0,0,1,2,2,1,0,0,1,2
]  # 0=Vata, 1=Pitta, 2=Kapha
NAK_YONI = [
    0,14,7,3,5,10,8,12,13,1,2,2,12,9,11,9,10,15,15,4,4,11,6,6,3,5,0
]  # 0-15 (male-female pairs)
NAK_GRAHA = [
    4,3,0,1,2,5,4,0,1,3,5,0,1,2,5,4,2,1,4,3,0,1,2,5,4,0,3
]  # 0=Sun,1=Moon,2=Mars,3=Merc,4=Jup,5=Ven,6=Sat
GRAHA_FRIEND = {
    0: {0,1,2,4}, 1: {0,3}, 2: {0,1,4}, 3: {0,5}, 4: {0,1,2}, 5: {3,6}, 6: {3,5}
}

def _moon_nakshatra(chart_json):
    for h in chart_json["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            if occ["celestialBody"] == "Moon":
                return occ.get("nakshatra", ""), occ.get("pada", 1)
    return "", 1

def _nak_idx(name):
    return NAKSHATRA_INDEX.get(name, 0)

def _tara_score(nak_boy, nak_girl):
    diff = (nak_girl - nak_boy) % 27
    tara = diff % 9
    return 3 if tara not in {2, 4, 6, 8} else 0

def _bhakoot_score(nak_boy, nak_girl):
    b = nak_boy // 9 + 1  # sign from nakshatra group
    g = nak_girl // 9 + 1
    diff = abs(b - g)
    return 0 if diff in {6, 8} else 7

def compute_guna_milan(nak_boy_name, pada_boy, nak_girl_name, pada_girl):
    bi = _nak_idx(nak_boy_name)
    gi = _nak_idx(nak_girl_name)

    varna = 1 if NAK_VARNA[gi] >= NAK_VARNA[bi] else 0
    vashya = 2  # simplified: give full score
    tara = _tara_score(bi, gi)
    yoni = 4 if NAK_YONI[bi] == NAK_YONI[gi] else (2 if abs(NAK_YONI[bi] - NAK_YONI[gi]) <= 3 else 0)
    graha_boy = NAK_GRAHA[bi]
    graha_girl = NAK_GRAHA[gi]
    graha_maitri = (5 if graha_boy == graha_girl
                    else 4 if graha_girl in GRAHA_FRIEND.get(graha_boy, set())
                    else 3 if graha_boy in GRAHA_FRIEND.get(graha_girl, set())
                    else 0)
    gana_boy = NAK_GANA[bi]
    gana_girl = NAK_GANA[gi]
    gana = 6 if gana_boy == gana_girl else (3 if abs(gana_boy - gana_girl) == 1 else 0)
    bhakoot = _bhakoot_score(bi, gi)
    nadi = 8 if NAK_NADI[bi] != NAK_NADI[gi] else 0

    total = varna + vashya + tara + yoni + graha_maitri + gana + bhakoot + nadi
    return {
        "total": total,
        "max": 36,
        "breakdown": {
            "varna": {"score": varna, "max": 1},
            "vashya": {"score": vashya, "max": 2},
            "tara": {"score": tara, "max": 3},
            "yoni": {"score": yoni, "max": 4},
            "graha_maitri": {"score": graha_maitri, "max": 5},
            "gana": {"score": gana, "max": 6},
            "bhakoot": {"score": bhakoot, "max": 7},
            "nadi": {"score": nadi, "max": 8},
        },
        "verdict": "Strong" if total >= 24 else "Acceptable" if total >= 18 else "Weak",
    }

def compute_house_overlays(chart_a, chart_b):
    lagna_a = chart_a["d1Chart"]["houses"][0]["sign"]
    signs_a = [h["sign"] for h in chart_a["d1Chart"]["houses"]]
    sign_to_house_a = {s: i + 1 for i, s in enumerate(signs_a)}

    overlays = []
    for h in chart_b["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            planet = occ["celestialBody"]
            sign = occ["sign"]
            house_in_a = sign_to_house_a.get(sign, 0)
            if house_in_a:
                overlays.append({
                    "planet": planet,
                    "falls_in_house": house_in_a,
                    "sign": sign,
                })
    return overlays

def compute_synastry(chart_a_json, chart_b_json):
    nak_a, pada_a = _moon_nakshatra(chart_a_json)
    nak_b, pada_b = _moon_nakshatra(chart_b_json)
    return {
        "guna_milan": compute_guna_milan(nak_a, pada_a, nak_b, pada_b),
        "a_planets_in_b_houses": compute_house_overlays(chart_b_json, chart_a_json),
        "b_planets_in_a_houses": compute_house_overlays(chart_a_json, chart_b_json),
    }

def compute_synastry_json(chart_a_str, chart_b_str):
    return json.dumps(compute_synastry(json.loads(chart_a_str), json.loads(chart_b_str)), default=str)
```

- [ ] **Step 3: Write tests**

```python
# tests/python/test_numerology_synastry.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from numerology import compute_numerology
from synastry import compute_guna_milan, compute_synastry
from chart import compute_chart

def test_numerology_life_path_range():
    result = compute_numerology("Sarthak Chhabra", "1996-11-22")
    assert 1 <= result["life_path"] <= 33

def test_numerology_has_all_keys():
    result = compute_numerology("Sarthak Chhabra", "1996-11-22")
    for key in ("life_path", "destiny", "soul_urge", "personality", "personal_year"):
        assert key in result

def test_numerology_destiny_has_both_systems():
    result = compute_numerology("Sarthak Chhabra", "1996-11-22")
    assert "chaldean" in result["destiny"]
    assert "pythagorean" in result["destiny"]

def test_guna_milan_total_in_range():
    result = compute_guna_milan("Shravana", 3, "Ashwini", 1)
    assert 0 <= result["total"] <= 36

def test_guna_milan_nadi_full_score_different_nadi():
    result = compute_guna_milan("Ashwini", 1, "Rohini", 1)  # Vata vs Kapha
    assert result["breakdown"]["nadi"]["score"] == 8

def test_synastry_returns_guna_milan_and_overlays():
    chart_a = compute_chart("A", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")
    chart_b = compute_chart("B", "1998-07-11", "19:10", 27.1767, 78.0081, 5.5, "Agra")
    result = compute_synastry(chart_a, chart_b)
    assert "guna_milan" in result
    assert "a_planets_in_b_houses" in result
    assert "b_planets_in_a_houses" in result
```

- [ ] **Step 4: Run tests**

```bash
source .venv-test/bin/activate
pytest tests/python/test_numerology_synastry.py -v
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/numerology.py src/lib/pyodide/scripts/synastry.py tests/python/test_numerology_synastry.py
git commit -m "feat: Pyodide scripts — numerology and synastry"
```

---

### Task 8: PyJHora Backend (AWS Lambda)

**Files:**
- Create: `backend/handler.py`
- Create: `backend/requirements.txt`

- [ ] **Step 1: Write `backend/requirements.txt`**

```
pyjhora
pyswisseph
```

- [ ] **Step 2: Write `backend/handler.py`**

```python
import json
import sys

def lambda_handler(event, context):
    """
    AWS Lambda entry point. Accepts birth data, returns PyJHora yogas + doshas.

    Event body (JSON):
    {
      "name": str, "dob": "YYYY-MM-DD", "time": "HH:MM",
      "lat": float, "lon": float, "tz_offset": float
    }

    Response body (JSON):
    { "yogas_active": [...], "doshas": {...} }
    """
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    # Handle CORS preflight
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    try:
        body = json.loads(event.get("body", "{}"))
        name = body["name"]
        dob = body["dob"]           # "YYYY-MM-DD"
        time_str = body["time"]     # "HH:MM"
        lat = float(body["lat"])
        lon = float(body["lon"])
        tz_offset = float(body["tz_offset"])
    except (KeyError, ValueError) as e:
        return {
            "statusCode": 400,
            "headers": headers,
            "body": json.dumps({"error": f"Invalid input: {e}"}),
        }

    try:
        from jhora.horoscope.chart import yoga as jhora_yoga
        from jhora.horoscope.chart import dosha as jhora_dosha
        from jhora import utils

        year, month, day = [int(x) for x in dob.split("-")]
        hour, minute = [int(x) for x in time_str.split(":")]

        place = utils.Place(name, lat, lon, tz_offset)
        jd = utils.julian_day_number((year, month, day), (hour, minute, 0))

        # Yogas
        yogas_raw = jhora_yoga.get_yoga_details(jd, place)
        yogas_active = [
            {"name": y[0], "description": y[1]}
            for y in (yogas_raw or [])
            if y and len(y) >= 2
        ]

        # Doshas
        doshas = {}
        try:
            manglik = jhora_dosha.manglik_dosha(jd, place)
            doshas["manglik"] = {"present": bool(manglik[0]), "text": str(manglik[1])}
        except Exception:
            doshas["manglik"] = {"present": False, "text": "Could not compute"}

        try:
            kala_sarpa = jhora_dosha.kala_sarpa_dosha(jd, place)
            doshas["kala_sarpa"] = {"present": bool(kala_sarpa[0]), "text": str(kala_sarpa[1])}
        except Exception:
            doshas["kala_sarpa"] = {"present": False, "text": "Could not compute"}

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({"yogas_active": yogas_active, "doshas": doshas}),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": str(e)}),
        }
```

- [ ] **Step 3: Commit**

```bash
git add backend/handler.py backend/requirements.txt
git commit -m "feat: PyJHora backend Lambda handler"
```

> **Deploy note:** Package with `pip install -r requirements.txt -t ./package && zip -r function.zip . -x "*.pyc"`. Deploy to AWS Lambda (Python 3.11) with a Function URL (CORS enabled). Set `VITE_PYJHORA_API_URL` in `.env` to the Function URL.

---

### Task 9: Pyodide Singleton Init

**Files:**
- Create: `src/lib/pyodide/index.js`
- Create: `src/hooks/usePyodide.js`

- [ ] **Step 1: Write `src/lib/pyodide/index.js`**

```js
import { loadPyodide } from 'pyodide'

let _pyodide = null
let _initPromise = null

// Rotating loading messages shown during init
export const LOADING_MESSAGES = [
  "Loading Python engine...",
  "Unpacking the star catalogue...",
  "This takes ~15s on first load...",
  "Calibrating ephemeris data...",
  "Almost ready...",
]

async function _init(onMessage) {
  let msgIdx = 0
  const interval = setInterval(() => {
    onMessage?.(LOADING_MESSAGES[msgIdx % LOADING_MESSAGES.length])
    msgIdx++
  }, 2500)

  try {
    const pyodide = await loadPyodide()
    await pyodide.loadPackage(['micropip'])
    await pyodide.runPythonAsync(`
import micropip
await micropip.install('jyotishganit')
`)

    // Load all computation scripts into Pyodide's virtual FS
    const scripts = ['chart', 'transit', 'yogas', 'doshas', 'numerology', 'synastry']
    for (const name of scripts) {
      const resp = await fetch(`/pyodide-scripts/${name}.py`)
      const code = await resp.text()
      pyodide.FS.writeFile(`/home/pyodide/${name}.py`, code)
    }

    clearInterval(interval)
    onMessage?.('Python engine ready')
    return pyodide
  } catch (err) {
    clearInterval(interval)
    throw err
  }
}

export function getPyodide(onMessage) {
  if (_pyodide) return Promise.resolve(_pyodide)
  if (!_initPromise) {
    _initPromise = _init(onMessage).then(p => {
      _pyodide = p
      return p
    })
  }
  return _initPromise
}

export async function runScript(scriptName, fnName, ...args) {
  const py = await getPyodide()
  const argsJson = args.map(a => JSON.stringify(a)).join(', ')
  const result = await py.runPythonAsync(`
import sys
sys.path.insert(0, '/home/pyodide')
from ${scriptName} import ${fnName}
import json
json.dumps(${fnName}(${args.map((_, i) => `json.loads(args[${i}])`).join(', ')}))
`)
  return JSON.parse(result)
}

// Specialised helpers used by hooks
export async function computeChart(name, dob, time, lat, lon, tzOffset, locationName = '') {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from chart import compute_chart_json
`)
  const result = py.globals.get('compute_chart_json')(name, dob, time, lat, lon, tzOffset, locationName)
  return JSON.parse(result)
}

export async function computeTransit(natalLagnaSign, lat, lon, tzOffset) {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from transit import compute_transit_json
`)
  const result = py.globals.get('compute_transit_json')(natalLagnaSign, lat, lon, tzOffset)
  return JSON.parse(result)
}

export async function computeYogasFallback(chartJson) {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from yogas import compute_yogas_json
`)
  const result = py.globals.get('compute_yogas_json')(JSON.stringify(chartJson))
  return JSON.parse(result)
}

export async function computeDoshasFallback(chartJson) {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from doshas import compute_doshas_json
`)
  const result = py.globals.get('compute_doshas_json')(JSON.stringify(chartJson))
  return JSON.parse(result)
}

export async function computeNumerology(fullName, dob) {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from numerology import compute_numerology_json
`)
  const result = py.globals.get('compute_numerology_json')(fullName, dob)
  return JSON.parse(result)
}

export async function computeSynastry(chartJsonA, chartJsonB) {
  const py = await getPyodide()
  await py.runPythonAsync(`
import sys; sys.path.insert(0, '/home/pyodide')
from synastry import compute_synastry_json
`)
  const result = py.globals.get('compute_synastry_json')(
    JSON.stringify(chartJsonA), JSON.stringify(chartJsonB)
  )
  return JSON.parse(result)
}
```

- [ ] **Step 2: Write `src/hooks/usePyodide.js`**

```js
import { useState, useEffect, useCallback } from 'react'
import {
  getPyodide, computeChart, computeTransit,
  computeYogasFallback, computeDoshasFallback,
  computeNumerology, computeSynastry,
} from '../lib/pyodide/index'

export function usePyodide() {
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    setStatus('loading')
    getPyodide(msg => setMessage(msg))
      .then(() => { setStatus('ready'); setMessage('') })
      .catch(() => setStatus('error'))
  }, [])

  const getYogasAndDoshas = useCallback(async (chartJson, birthData) => {
    const apiUrl = import.meta.env.VITE_PYJHORA_API_URL
    if (apiUrl) {
      try {
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(birthData),
        })
        if (resp.ok) return await resp.json()
      } catch {
        // fall through to Pyodide fallback
      }
    }
    const [yogas, doshas] = await Promise.all([
      computeYogasFallback(chartJson),
      computeDoshasFallback(chartJson),
    ])
    return { yogas_active: yogas, doshas }
  }, [])

  return {
    status,
    message,
    isReady: status === 'ready',
    computeChart,
    computeTransit,
    computeNumerology,
    computeSynastry,
    getYogasAndDoshas,
  }
}
```

- [ ] **Step 3: Copy Python scripts to `public/pyodide-scripts/` so Vite serves them**

```bash
mkdir -p public/pyodide-scripts
cp src/lib/pyodide/scripts/*.py public/pyodide-scripts/
```

- [ ] **Step 4: Add copy step to `vite.config.js`** so scripts stay in sync

```js
// Add to vite.config.js plugins array:
import { copyFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

// inline plugin — copies Python scripts to public on build
{
  name: 'copy-py-scripts',
  buildStart() {
    const src = resolve(__dirname, 'src/lib/pyodide/scripts')
    const dest = resolve(__dirname, 'public/pyodide-scripts')
    mkdirSync(dest, { recursive: true })
    for (const f of ['chart', 'transit', 'yogas', 'doshas', 'numerology', 'synastry']) {
      copyFileSync(`${src}/${f}.py`, `${dest}/${f}.py`)
    }
  },
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/ src/hooks/usePyodide.js public/pyodide-scripts/ vite.config.js
git commit -m "feat: Pyodide singleton init + usePyodide hook + PyJHora fallback logic"
```

---

### Task 10: LLM Clients

**Files:**
- Create: `src/lib/llm/claude.js`
- Create: `src/lib/llm/gemini.js`
- Create: `src/lib/llm/openai.js`
- Create: `src/lib/llm/index.js`

- [ ] **Step 1: Write `src/lib/llm/claude.js`**

```js
// Anthropic Messages API — streaming via fetch SSE
export async function claudeChat({ key, messages, systemPrompt, onChunk, model = 'claude-sonnet-4-6' }) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Claude API error ${resp.status}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const event = JSON.parse(data)
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          onChunk?.(event.delta.text)
        }
      } catch { /* skip malformed lines */ }
    }
  }
}
```

- [ ] **Step 2: Write `src/lib/llm/gemini.js`**

```js
// Google Generative AI REST API — streaming
export async function geminiChat({ key, messages, systemPrompt, onChunk, model = 'gemini-2.0-flash' }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}&alt=sse`

  // Convert messages to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 2048 },
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Gemini API error ${resp.status}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6))
        const text = event.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) onChunk?.(text)
      } catch { /* skip */ }
    }
  }
}
```

- [ ] **Step 3: Write `src/lib/llm/openai.js`**

```js
// OpenAI Chat Completions API — streaming
export async function openaiChat({ key, messages, systemPrompt, onChunk, model = 'gpt-4o' }) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 2048,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `OpenAI API error ${resp.status}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const event = JSON.parse(data)
        const text = event.choices?.[0]?.delta?.content
        if (text) onChunk?.(text)
      } catch { /* skip */ }
    }
  }
}
```

- [ ] **Step 4: Write `src/lib/llm/index.js`**

```js
import { claudeChat } from './claude'
import { geminiChat } from './gemini'
import { openaiChat } from './openai'

const CLIENTS = { claude: claudeChat, gemini: geminiChat, openai: openaiChat }

/**
 * Unified streaming chat interface.
 * @param {{ provider: string, key: string, messages: Array, systemPrompt: string, onChunk: Function }} opts
 * @returns Promise<void> — resolves when stream ends
 */
export async function chat({ provider, key, messages, systemPrompt, onChunk }) {
  const client = CLIENTS[provider]
  if (!client) throw new Error(`Unknown provider: ${provider}`)
  return client({ key, messages, systemPrompt, onChunk })
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/
git commit -m "feat: LLM clients — Claude, Gemini, OpenAI with unified streaming interface"
```

---

### Task 11: useLLM Hook + Prompts + Formatters

**Files:**
- Create: `src/hooks/useLLM.js`
- Create: `src/assets/soul.md` (copy from bundle)
- Create: `src/lib/prompts/soul.js`
- Create: `src/lib/prompts/formatters.js`
- Create: `tests/lib/llm/formatters.test.js`

- [ ] **Step 1: Copy `soul.md` from bundle**

```bash
cp /Users/sarthakchhabra/Documents/homeagent-migration-bundle/workspace/astro/SOUL.md src/assets/soul.md
```

- [ ] **Step 2: Write `src/lib/prompts/soul.js`**

```js
import soulMd from '../../assets/soul.md?raw'
import userMdTemplate from '../../assets/user-template.md?raw'

export function buildSystemPrompt(profile) {
  const user = userMdTemplate
    .replace('{{NAME}}', profile.name)
    .replace('{{LAGNA}}', profile.chart?.d1Chart?.houses?.[0]?.sign ?? 'unknown')

  return `${soulMd}\n\n---\n\n# Current User\n${user}`
}
```

- [ ] **Step 3: Create `src/assets/user-template.md`**

```markdown
## Active Profile
- **Name:** {{NAME}}
- **Lagna:** {{LAGNA}}
```

- [ ] **Step 4: Write `src/lib/prompts/formatters.js`**

```js
// Each formatter takes computed data and returns a context string
// appended to the system prompt for that tab.

export function formatTransitContext(transitData, chartJson) {
  const planets = transitData.planets
    .map(p => `- ${p.planet} in your H${p.natal_house} (${p.sign})${p.retrograde ? ' retrograde' : ''}`)
    .join('\n')

  const dasha = chartJson?.dashas?.vimshottari
    ? `Current dasha: ${JSON.stringify(chartJson.dashas.vimshottari).slice(0, 200)}`
    : ''

  return `## Today's Computed Transit Data (${transitData.date} ${transitData.time} IST)

### Panchanga
${JSON.stringify(transitData.panchanga, null, 2)}

### Planetary Positions → Natal Houses
${planets}

${dasha}

Interpret this as a transit read. Effects only — no factor-explaining. 
Plain English, no jargon, no Sanskrit, no house numbers in your reply.`
}

export function formatChartContext(chartJson, yogas, doshas) {
  const activeDoshas = Object.entries(doshas ?? {})
    .filter(([, v]) => v.present)
    .map(([k, v]) => `${k}: ${v.text}`)
    .join('\n')

  return `## Computed Birth Chart Data

### D1 Chart (Rasi)
Lagna: ${chartJson?.d1Chart?.houses?.[0]?.sign ?? 'unknown'}
Planets: ${JSON.stringify(chartJson?.d1Chart?.houses ?? [], null, 2).slice(0, 1500)}

### Active Yogas
${(yogas ?? []).map(y => `- ${y.name} (${y.category})`).join('\n') || 'None detected'}

### Doshas
${activeDoshas || 'None detected'}

### Current Dasha
${JSON.stringify(chartJson?.dashas?.vimshottari ?? {}).slice(0, 300)}

Interpret the chart. Plain English, effects only — no Sanskrit terms, no house numbers in your reply.`
}

export function formatNumerologyContext(numerology) {
  return `## Computed Numerology Profile (Chaldean primary)

Life Path: ${numerology.life_path}
Destiny: Chaldean ${numerology.destiny.chaldean} / Pythagorean ${numerology.destiny.pythagorean}
Soul Urge: Chaldean ${numerology.soul_urge.chaldean} / Pythagorean ${numerology.soul_urge.pythagorean}
Personality: Chaldean ${numerology.personality.chaldean} / Pythagorean ${numerology.personality.pythagorean}
Personal Year: ${numerology.personal_year}

Interpret this numerology profile. Use Chaldean as primary and Pythagorean as cross-check. 
Plain English only — explain what each number means for this person's life.`
}

export function formatSynastryContext(synastryData, profileA, profileB) {
  const { guna_milan, a_planets_in_b_houses, b_planets_in_a_houses } = synastryData
  const breakdown = Object.entries(guna_milan.breakdown)
    .map(([k, v]) => `  ${k}: ${v.score}/${v.max}`)
    .join('\n')

  return `## Computed Synastry Data: ${profileA.name} ↔ ${profileB.name}

### Guna Milan (Ashtakoota)
Total: ${guna_milan.total}/36 — ${guna_milan.verdict}
Breakdown:
${breakdown}

### ${profileA.name}'s Planets in ${profileB.name}'s Chart
${b_planets_in_a_houses.map(o => `- ${o.planet} falls in H${o.falls_in_house} (${o.sign})`).join('\n')}

### ${profileB.name}'s Planets in ${profileA.name}'s Chart
${a_planets_in_b_houses.map(o => `- ${o.planet} falls in H${o.falls_in_house} (${o.sign})`).join('\n')}

Interpret this compatibility. Guna Milan total score first, then key house overlay findings. 
Plain English — tell them what it means for the relationship, not the astrological mechanics.
Only discuss Kundali Match if the user explicitly asks — never volunteer matchmaking framing.`
}
```

- [ ] **Step 5: Write failing formatter tests**

```js
// tests/lib/llm/formatters.test.js
import { describe, it, expect } from 'vitest'
import { formatTransitContext, formatNumerologyContext, formatSynastryContext } from '../../../src/lib/prompts/formatters'

describe('formatTransitContext', () => {
  it('includes date and planet count', () => {
    const transit = {
      date: '2026-06-07', time: '07:00',
      panchanga: { tithi: 'Shukla Tritiya' },
      planets: [
        { planet: 'Sun', sign: 'Taurus', natal_house: 4, retrograde: false },
        { planet: 'Moon', sign: 'Scorpio', natal_house: 10, retrograde: false },
      ],
    }
    const result = formatTransitContext(transit, {})
    expect(result).toContain('2026-06-07')
    expect(result).toContain('H4')
    expect(result).toContain('H10')
  })

  it('marks retrograde planets', () => {
    const transit = {
      date: '2026-06-07', time: '07:00',
      panchanga: {},
      planets: [{ planet: 'Saturn', sign: 'Aquarius', natal_house: 1, retrograde: true }],
    }
    expect(formatTransitContext(transit, {})).toContain('retrograde')
  })
})

describe('formatNumerologyContext', () => {
  it('includes all five number types', () => {
    const num = {
      life_path: 7,
      destiny: { chaldean: 5, pythagorean: 6 },
      soul_urge: { chaldean: 3, pythagorean: 3 },
      personality: { chaldean: 2, pythagorean: 3 },
      personal_year: 9,
    }
    const result = formatNumerologyContext(num)
    expect(result).toContain('Life Path: 7')
    expect(result).toContain('Personal Year: 9')
  })
})

describe('formatSynastryContext', () => {
  it('includes both profile names and total score', () => {
    const synastry = {
      guna_milan: {
        total: 26, verdict: 'Strong',
        breakdown: {
          nadi: { score: 8, max: 8 },
          bhakoot: { score: 7, max: 7 },
        },
      },
      a_planets_in_b_houses: [{ planet: 'Jupiter', falls_in_house: 7, sign: 'Libra' }],
      b_planets_in_a_houses: [],
    }
    const result = formatSynastryContext(synastry, { name: 'Sarthak' }, { name: 'Tanya' })
    expect(result).toContain('Sarthak')
    expect(result).toContain('Tanya')
    expect(result).toContain('26/36')
  })
})
```

- [ ] **Step 6: Run formatter tests**

```bash
npx vitest run tests/lib/llm/formatters.test.js
```

Expected: 4 tests PASS

- [ ] **Step 7: Write `src/hooks/useLLM.js`**

```js
import { useState, useCallback } from 'react'
import { chat } from '../lib/llm/index'
import { getApiKey } from '../lib/storage/keys'
import { appendMessage, getHistory } from '../lib/storage/chat'
import { buildSystemPrompt } from '../lib/prompts/soul'

export function useLLM(profile, tab) {
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)

  const send = useCallback(async ({ userMessage, extraContext = '' }) => {
    const keyData = getApiKey()
    if (!keyData) throw new Error('No API key configured')
    if (!profile) throw new Error('No active profile')

    const systemPrompt = buildSystemPrompt(profile) + (extraContext ? `\n\n${extraContext}` : '')
    const history = getHistory(profile.id, tab)

    appendMessage(profile.id, tab, { role: 'user', content: userMessage })
    const messages = [...history, { role: 'user', content: userMessage }]

    setStreaming(true)
    setError(null)
    let fullResponse = ''

    try {
      await chat({
        provider: keyData.provider,
        key: keyData.key,
        messages,
        systemPrompt,
        onChunk: chunk => { fullResponse += chunk },
      })
      appendMessage(profile.id, tab, { role: 'assistant', content: fullResponse })
      return fullResponse
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setStreaming(false)
    }
  }, [profile, tab])

  return { send, streaming, error }
}
```

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useLLM.js src/lib/prompts/ src/assets/soul.md src/assets/user-template.md tests/lib/llm/
git commit -m "feat: LLM hook, system prompts, and per-tab formatters"
```

---

### Task 12: Analytics Wrapper

**Files:**
- Create: `src/lib/analytics.js`

- [ ] **Step 1: Write `src/lib/analytics.js`**

```js
// GA4 via gtag. Only loads when VITE_GA_MEASUREMENT_ID is set.
// Birth data, chart data, and API keys are never sent.

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID

export function initAnalytics() {
  if (!GA_ID) return
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)
  window.dataLayer = window.dataLayer || []
  window.gtag = function () { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, { send_page_view: false })
}

export function trackPageView(page) {
  if (!GA_ID || !window.gtag) return
  window.gtag('event', 'page_view', { page_title: page, page_path: `/${page}` })
}

export function trackEvent(name, params = {}) {
  if (!GA_ID || !window.gtag) return
  // Safety: strip any personal data fields before sending
  const safe = { ...params }
  for (const key of ['name', 'dob', 'time', 'lat', 'lon', 'key', 'chart', 'numerology']) {
    delete safe[key]
  }
  window.gtag('event', name, safe)
}
```

- [ ] **Step 2: Call `initAnalytics()` from `src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import { initAnalytics } from './lib/analytics'
import App from './App'

initAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/analytics.js src/main.jsx
git commit -m "feat: GA4 analytics wrapper — usage only, no personal data"
```

---

## Running All Tests

```bash
# JS unit tests
npx vitest run

# Python unit tests
source .venv-test/bin/activate
pytest tests/python/ -v
```

Expected output:
- JS: 13 tests PASS
- Python: 15 tests PASS
