# AskMyAstro Parity — P0 Foundation & Surfacing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the chart depth `jyotishganit` already computes (dignity, shadbala strength, graha-drishti aspects, full Vimshottari dasha chain, divisional charts) by building shared Python foundation modules and wiring them into the agent's `get_chart`/`get_divisional` tools.

**Architecture:** A new `adapter.py` converts `jyotishganit`'s chart JSON into one clean internal "facts" structure (planets with dignity + shadbala strength + aspects + conjuncts, house lords, current dasha chain, divisional placements). Thin `dignity.py` and `aspects.py` helpers interpret that data (strength labels, aspect orbs/tightness). The worker exposes a `chart_facts_json` entry point; `tools.js` consumes it so the model finally sees strength, aspects, and the full dasha chain, plus a new `get_divisional` tool for D9/Navamsa.

**Tech Stack:** Python (Pyodide Web Worker, `jyotishganit` 0.1.3), pytest (`.venv-test`), JS (Vite, Vitest), React. Compute is 100% client-side — no backend.

**Spec:** `docs/superpowers/specs/2026-06-13-askmyastro-parity-design.md` (§3 verification RESOLVED, §4.1 dignity/aspects = surfacing layers, §8 P0).

**Conventions discovered (follow these):**
- Python compute scripts live in `src/lib/pyodide/scripts/*.py`. The `copy-py-scripts` vite plugin auto-copies them to `public/pyodide-scripts/` — no manual copy needed.
- Each script that the worker calls exposes a `*_json(...)` entry point returning a JSON string (see `chart.py:compute_chart_json`). New worker-called entry points must be registered in **three** places in `src/lib/pyodide/worker.js`: the `scripts` array (line ~79), the `from <mod> import <fn>` preload block (line ~90), and the `PY_FN` map (line ~16); plus a wrapper in `src/lib/pyodide/index.js`.
- Python tests live in `tests/python/test_*.py`, add `src/lib/pyodide/scripts` to `sys.path`, and import the module functions directly (see `tests/python/test_yogas_doshas.py`).
- Run Python tests with: `.venv-test/bin/python -m pytest tests/python/<file> -v`
- `jyotishganit` per-occupant JSON keys: `celestialBody, sign, signDegrees, nakshatra, pada, house, motion_type` (`"retrograde"`/`"direct"`), `dignities.dignity`, `shadbala.Shadbala.{Total,Rupas,MinRequired,MeetsRequirement}` (`"Yes"`/`"No"`), `aspects.{gives,receives}` (items `{to_house|to_planet, aspect_type}` / `{from_planet, aspect_type}`), `conjuncts` (list of names).
- Top-level chart keys: `d1Chart.houses[]` (house `{number, sign, occupants[], lord}`), `dashas.{current, all, balance}` (`all.mahadashas[planet] = {start,end,antardashas{planet:{start,end,pratyantardashas{...}}}}`, dates `"YYYY-MM-DD"`), `divisionalCharts.{d2..d60}` (each `{ascendant, houses[]}`, houses like d1).

---

## File Structure

- **Create** `src/lib/pyodide/scripts/adapter.py` — chart JSON → internal facts (planets, lords, dasha chain, divisional placements). One responsibility: extraction/normalization. No interpretation.
- **Create** `src/lib/pyodide/scripts/dignity.py` — interpretation helpers over a planet fact (strength label, dignity rank). Pure, no chart parsing.
- **Create** `src/lib/pyodide/scripts/aspects.py` — aspect orb math + tightness legend + readable aspect summary from facts. Pure.
- **Create** `tests/python/conftest.py` — shared chart fixtures (Sarthak, Tanya) computed once per session.
- **Create** `tests/python/test_adapter.py`, `tests/python/test_dignity.py`, `tests/python/test_aspects.py`.
- **Modify** `src/lib/pyodide/worker.js` — register `chart_facts_json` as `computeChartFacts`.
- **Modify** `src/lib/pyodide/index.js` — add `computeChartFacts` wrapper.
- **Modify** `src/lib/llm/tools.js` — enrich `get_chart`; add `get_divisional`.
- **Modify** `src/lib/llm/toolLabels.js` — add label for `get_divisional`.

---

## Task 1: Shared test fixtures

**Files:**
- Create: `tests/python/conftest.py`

- [ ] **Step 1: Write the fixtures file**

```python
# tests/python/conftest.py
import sys, os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from chart import compute_chart  # noqa: E402


@pytest.fixture(scope="session")
def sarthak_chart():
    # Aquarius-lagna reference used across the suite.
    return compute_chart("Sarthak", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")


@pytest.fixture(scope="session")
def tanya_chart():
    # Smoke anchor from the WhatsApp skill: DOB 11 Jul 1998 19:10 IST, Agra.
    return compute_chart("Tanya", "1998-07-11", "19:10", 27.1767, 78.0081, 5.5, "Agra, India")
```

- [ ] **Step 2: Verify fixtures load (sanity smoke)**

Run: `.venv-test/bin/python -m pytest tests/python/conftest.py -v`
Expected: PASS (no tests collected, no import errors). If "no tests ran" is reported, that's fine — we only need it to import cleanly.

- [ ] **Step 3: Commit**

```bash
git add tests/python/conftest.py
git commit -m "test: shared jyotishganit chart fixtures (Sarthak, Tanya smoke anchor)"
```

---

## Task 2: `adapter.py` — planet facts extraction

**Files:**
- Create: `src/lib/pyodide/scripts/adapter.py`
- Test: `tests/python/test_adapter.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/python/test_adapter.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from adapter import planet_facts


def test_planet_facts_has_core_fields(sarthak_chart):
    facts = planet_facts(sarthak_chart)
    assert "Saturn" in facts
    s = facts["Saturn"]
    for key in ("sign", "sign_idx", "house", "longitude", "nakshatra", "pada",
                "retrograde", "dignity", "rupas", "min_required", "meets", "is_strong",
                "conjuncts", "aspects_gives", "aspects_receives"):
        assert key in s, f"missing {key}"


def test_planet_facts_types(sarthak_chart):
    s = planet_facts(sarthak_chart)["Saturn"]
    assert isinstance(s["sign_idx"], int) and 0 <= s["sign_idx"] <= 11
    assert isinstance(s["retrograde"], bool)
    assert isinstance(s["is_strong"], bool)
    assert isinstance(s["conjuncts"], list)
    assert isinstance(s["aspects_gives"], list)
    assert s["is_strong"] == (s["meets"] == "Yes")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_adapter.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'adapter'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/lib/pyodide/scripts/adapter.py
"""Convert jyotishganit chart JSON into one clean internal 'facts' structure.

This is the single source of truth for chart shape: every downstream rule module
(dignity, aspects, yogas, doshas, synastry) consumes adapter output, never the raw
jyotishganit JSON. Extraction only — no astrological interpretation here.
"""
import json

SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
         "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]
SIGN_IDX = {s: i for i, s in enumerate(SIGNS)}


def planet_facts(chart_json):
    """planet name -> normalized fact dict (sign, house, strength, aspects, ...)."""
    out = {}
    for h in chart_json["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            sb = (occ.get("shadbala") or {}).get("Shadbala", {})
            meets = sb.get("MeetsRequirement", "No")
            asp = occ.get("aspects") or {}
            out[occ["celestialBody"]] = {
                "sign": occ["sign"],
                "sign_idx": SIGN_IDX.get(occ["sign"], -1),
                "house": h["number"],
                "longitude": round(float(occ.get("signDegrees", 0.0)), 4),
                "nakshatra": occ.get("nakshatra", ""),
                "pada": occ.get("pada", 1),
                "retrograde": occ.get("motion_type", "direct") == "retrograde",
                "dignity": (occ.get("dignities") or {}).get("dignity", "neutral"),
                "rupas": sb.get("Rupas"),
                "min_required": sb.get("MinRequired"),
                "meets": meets,
                "is_strong": meets == "Yes",
                "conjuncts": list(occ.get("conjuncts", []) or []),
                "aspects_gives": list(asp.get("gives", []) or []),
                "aspects_receives": list(asp.get("receives", []) or []),
            }
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_adapter.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/adapter.py tests/python/test_adapter.py
git commit -m "feat(adapter): extract normalized planet facts from jyotishganit chart"
```

---

## Task 3: `adapter.py` — lagna sign & house lords

**Files:**
- Modify: `src/lib/pyodide/scripts/adapter.py`
- Test: `tests/python/test_adapter.py`

- [ ] **Step 1: Write the failing test (append to test_adapter.py)**

```python
from adapter import lagna_sign, house_lords


def test_lagna_sign(sarthak_chart):
    assert lagna_sign(sarthak_chart) == "Aquarius"  # known Aquarius lagna


def test_house_lords(sarthak_chart):
    lords = house_lords(sarthak_chart)
    assert len(lords) == 12
    assert lords[1] == "Saturn"   # Aquarius (H1) -> Saturn
    assert lords[5] == "Mercury"  # Gemini (5th from Aquarius) -> Mercury
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_adapter.py -v`
Expected: FAIL with `ImportError: cannot import name 'lagna_sign'`.

- [ ] **Step 3: Add implementation to adapter.py**

```python
SIGN_LORD = {
    "Aries": "Mars", "Taurus": "Venus", "Gemini": "Mercury", "Cancer": "Moon",
    "Leo": "Sun", "Virgo": "Mercury", "Libra": "Venus", "Scorpio": "Mars",
    "Sagittarius": "Jupiter", "Capricorn": "Saturn", "Aquarius": "Saturn", "Pisces": "Jupiter",
}


def lagna_sign(chart_json):
    """Ascendant sign (House 1's sign)."""
    for h in chart_json["d1Chart"]["houses"]:
        if h["number"] == 1:
            return h["sign"]
    return chart_json["d1Chart"]["houses"][0]["sign"]


def house_lords(chart_json):
    """house number (1..12) -> ruling planet, walking from the lagna sign."""
    lagna_i = SIGN_IDX[lagna_sign(chart_json)]
    return {i + 1: SIGN_LORD[SIGNS[(lagna_i + i) % 12]] for i in range(12)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_adapter.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/adapter.py tests/python/test_adapter.py
git commit -m "feat(adapter): lagna sign and house lords"
```

---

## Task 4: `adapter.py` — current dasha chain

**Files:**
- Modify: `src/lib/pyodide/scripts/adapter.py`
- Test: `tests/python/test_adapter.py`

- [ ] **Step 1: Write the failing test (append)**

```python
from adapter import current_dasha_chain


def test_dasha_chain_for_known_date(sarthak_chart):
    # 1996-03-10 falls in the birth Ketu mahadasha / Ketu antardasha.
    chain = current_dasha_chain(sarthak_chart, ref_date="1996-03-10")
    assert chain["maha"] == "Ketu"
    assert chain["antar"] == "Ketu"
    assert chain["pratyantar"] is not None


def test_dasha_chain_keys(sarthak_chart):
    chain = current_dasha_chain(sarthak_chart, ref_date="2003-01-01")
    assert set(chain.keys()) == {"maha", "antar", "pratyantar"}
    assert chain["maha"] in {"Ketu", "Venus"}  # near the Ketu->Venus boundary (2003-03-08)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_adapter.py -v`
Expected: FAIL with `ImportError: cannot import name 'current_dasha_chain'`.

- [ ] **Step 3: Add implementation to adapter.py**

```python
from datetime import datetime


def _active_period(periods, ref):
    """Given {name: {start, end, <subkey>?}}, return (name, node) whose [start,end) holds ref.
    Dates are 'YYYY-MM-DD' strings — lexicographic compare is correct for ISO dates."""
    for name, node in (periods or {}).items():
        if node.get("start", "9999") <= ref < node.get("end", "0000"):
            return name, node
    # ref past the last end (e.g. tree truncated) -> fall back to the last period.
    if periods:
        name = list(periods.keys())[-1]
        return name, periods[name]
    return None, {}


def current_dasha_chain(chart_json, ref_date=None):
    """Walk maha -> antar -> pratyantar for ref_date (default: today). Returns
    {'maha','antar','pratyantar'} planet names (any level may be None if absent)."""
    ref = ref_date or datetime.now().strftime("%Y-%m-%d")
    mahadashas = ((chart_json.get("dashas") or {}).get("all") or {}).get("mahadashas") or {}
    maha_name, maha = _active_period(mahadashas, ref)
    antar_name, antar = _active_period(maha.get("antardashas") if maha else None, ref)
    praty_name, _ = _active_period(antar.get("pratyantardashas") if antar else None, ref)
    return {"maha": maha_name, "antar": antar_name, "pratyantar": praty_name}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_adapter.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/adapter.py tests/python/test_adapter.py
git commit -m "feat(adapter): current Vimshottari dasha chain (maha/antar/pratyantar)"
```

---

## Task 5: `adapter.py` — divisional chart placements

**Files:**
- Modify: `src/lib/pyodide/scripts/adapter.py`
- Test: `tests/python/test_adapter.py`

- [ ] **Step 1: Write the failing test (append)**

```python
from adapter import divisional_positions


def test_divisional_d9(sarthak_chart):
    d9 = divisional_positions(sarthak_chart, "d9")
    assert d9["varga"] == "d9"
    assert d9["ascendant"]  # navamsa lagna sign present
    # Every classical planet should be placed somewhere in the varga.
    placed = {p["planet"] for p in d9["placements"]}
    assert {"Sun", "Moon", "Saturn"}.issubset(placed)
    for p in d9["placements"]:
        assert set(p.keys()) >= {"planet", "sign", "house"}


def test_divisional_unknown_returns_error(sarthak_chart):
    res = divisional_positions(sarthak_chart, "d99")
    assert "error" in res
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_adapter.py -v`
Expected: FAIL with `ImportError: cannot import name 'divisional_positions'`.

- [ ] **Step 3: Add implementation to adapter.py**

```python
def divisional_positions(chart_json, varga):
    """Extract placements for a divisional chart, e.g. 'd9' (Navamsa).
    Returns {varga, ascendant, placements:[{planet, sign, house}]} or {error}."""
    charts = chart_json.get("divisionalCharts") or {}
    dv = charts.get(varga)
    if not dv or "houses" not in dv:
        return {"error": f"Unknown or unavailable divisional chart: {varga!r}"}
    placements = []
    for h in dv["houses"]:
        for occ in h.get("occupants", []):
            placements.append({
                "planet": occ["celestialBody"],
                "sign": occ["sign"],
                "house": h["number"],
                "retrograde": occ.get("motion_type", "direct") == "retrograde",
            })
    return {
        "varga": varga,
        "ascendant": dv.get("ascendant"),
        "placements": placements,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_adapter.py -v`
Expected: PASS (8 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/adapter.py tests/python/test_adapter.py
git commit -m "feat(adapter): divisional chart placements (D9 etc.)"
```

---

## Task 6: `dignity.py` — strength interpretation helpers

**Files:**
- Create: `src/lib/pyodide/scripts/dignity.py`
- Test: `tests/python/test_dignity.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/python/test_dignity.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from dignity import strength_label, DIGNITY_RANK


def test_strength_label_bands():
    assert strength_label({"rupas": 7.0, "min_required": 5.0}) == "strong"
    assert strength_label({"rupas": 5.0, "min_required": 5.0}) == "adequate"
    assert strength_label({"rupas": 3.0, "min_required": 5.0}) == "weak"


def test_strength_label_missing_data():
    assert strength_label({"rupas": None, "min_required": None}) == "unknown"


def test_dignity_rank_orders_exalted_above_debilitated():
    assert DIGNITY_RANK["exalted"] > DIGNITY_RANK["debilitated"]
    assert DIGNITY_RANK["own"] > DIGNITY_RANK["neutral"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_dignity.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'dignity'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/lib/pyodide/scripts/dignity.py
"""Interpretation helpers over a single planet fact (from adapter.planet_facts).
jyotishganit already computes dignity + shadbala; we only label/rank it here."""

# Higher = stronger placement. jyotishganit's dignity strings map onto this ladder.
DIGNITY_RANK = {
    "exalted": 5,
    "moolatrikona": 4,
    "own": 3,
    "friend": 2,
    "neutral": 1,
    "enemy": 0,
    "debilitated": -1,
}


def strength_label(fact):
    """'strong' | 'adequate' | 'weak' | 'unknown' from shadbala Rupas vs MinRequired."""
    rupas = fact.get("rupas")
    minreq = fact.get("min_required")
    if rupas is None or minreq is None:
        return "unknown"
    if rupas > minreq:
        return "strong"
    if rupas >= minreq:  # exactly meets requirement
        return "adequate"
    return "weak"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_dignity.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/dignity.py tests/python/test_dignity.py
git commit -m "feat(dignity): shadbala strength labels and dignity ranking"
```

---

## Task 7: `aspects.py` — orb math, tightness & aspect summary

**Files:**
- Create: `src/lib/pyodide/scripts/aspects.py`
- Test: `tests/python/test_aspects.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/python/test_aspects.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from aspects import orb_within_sign, tightness, aspect_summary


def test_orb_within_sign_wraps():
    assert orb_within_sign(2.0, 5.0) == 3.0
    assert orb_within_sign(1.0, 29.0) == 2.0  # shortest distance on the 30-degree wheel


def test_tightness_bands():
    assert tightness(2.0) == "tight"
    assert tightness(5.0) == "active"
    assert tightness(8.0) == "loose"
    assert tightness(12.0) == "noted"


def test_aspect_summary_lists_given_aspects():
    facts = {
        "Saturn": {"aspects_gives": [{"to_planet": "Jupiter", "aspect_type": "10"},
                                     {"to_house": 4, "aspect_type": "3"}],
                   "aspects_receives": [{"from_planet": "Mars", "aspect_type": "8"}],
                   "conjuncts": ["Ketu"]},
    }
    summ = aspect_summary(facts, "Saturn")
    assert "Jupiter" in summ["aspects_planets"]
    assert "Ketu" in summ["conjuncts"]
    assert 4 in summ["aspects_houses"]
    assert "Mars" in summ["aspected_by"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_aspects.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'aspects'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/lib/pyodide/scripts/aspects.py
"""Graha-drishti surfacing over adapter facts. jyotishganit already computes which
planets/houses each planet aspects (aspects.gives/receives); we add the degree-orb
tightness legend and a readable summary."""


def orb_within_sign(deg_a, deg_b):
    """Shortest separation of two within-sign degrees on the 30-degree wheel."""
    d = abs(float(deg_a) - float(deg_b)) % 30
    return round(min(d, 30 - d), 2)


def tightness(orb):
    """Weighting band for an aspect orb (skill legend)."""
    if orb <= 3:
        return "tight"     # full strength
    if orb <= 7:
        return "active"    # weight modestly
    if orb <= 10:
        return "loose"     # colouring only
    return "noted"         # list, do not act on


def aspect_summary(facts, planet):
    """Readable drishti summary for one planet from its adapter fact."""
    f = facts.get(planet, {})
    gives = f.get("aspects_gives", [])
    receives = f.get("aspects_receives", [])
    return {
        "aspects_planets": [g["to_planet"] for g in gives if "to_planet" in g],
        "aspects_houses": [g["to_house"] for g in gives if "to_house" in g],
        "aspected_by": [r["from_planet"] for r in receives if "from_planet" in r],
        "conjuncts": list(f.get("conjuncts", [])),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_aspects.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/aspects.py tests/python/test_aspects.py
git commit -m "feat(aspects): graha-drishti orbs, tightness legend, aspect summary"
```

---

## Task 8: `adapter.py` — `chart_facts` aggregator + JSON entry point

**Files:**
- Modify: `src/lib/pyodide/scripts/adapter.py`
- Test: `tests/python/test_adapter.py`

- [ ] **Step 1: Write the failing test (append)**

```python
import json as _json
from adapter import chart_facts, chart_facts_json


def test_chart_facts_aggregates(sarthak_chart):
    cf = chart_facts(sarthak_chart, ref_date="2020-01-01")
    assert cf["lagna"] == "Aquarius"
    assert cf["planets"]["Saturn"]["sign"]
    assert cf["planets"]["Saturn"]["strength"] in {"strong", "adequate", "weak", "unknown"}
    assert set(cf["dasha"].keys()) == {"maha", "antar", "pratyantar"}
    assert cf["lords"][1] == "Saturn"


def test_chart_facts_json_roundtrips(sarthak_chart):
    s = chart_facts_json(_json.dumps(sarthak_chart), "2020-01-01")
    parsed = _json.loads(s)
    assert parsed["lagna"] == "Aquarius"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_adapter.py -v`
Expected: FAIL with `ImportError: cannot import name 'chart_facts'`.

- [ ] **Step 3: Add implementation to adapter.py**

```python
from dignity import strength_label


def chart_facts(chart_json, ref_date=None):
    """Aggregate the full internal facts view consumed by tools and rule modules."""
    planets = planet_facts(chart_json)
    for name, f in planets.items():
        f["strength"] = strength_label(f)
    return {
        "lagna": lagna_sign(chart_json),
        "lords": house_lords(chart_json),
        "planets": planets,
        "dasha": current_dasha_chain(chart_json, ref_date),
    }


def chart_facts_json(chart_json_str, ref_date=None):
    """Worker entry point: accepts JSON string, returns JSON string."""
    rd = ref_date or None
    return json.dumps(chart_facts(json.loads(chart_json_str), rd), default=str)
```

Note: `dignity.py` must already exist (Task 6). The `from dignity import strength_label` line goes near the top of `adapter.py` with the other imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_adapter.py -v`
Expected: PASS (10 passed).

- [ ] **Step 5: Run the FULL python suite (no regressions)**

Run: `.venv-test/bin/python -m pytest tests/python/ -v`
Expected: PASS (all pre-existing tests + the new ones).

- [ ] **Step 6: Commit**

```bash
git add src/lib/pyodide/scripts/adapter.py tests/python/test_adapter.py
git commit -m "feat(adapter): chart_facts aggregator + chart_facts_json worker entry point"
```

---

## Task 9: Wire `chart_facts_json` into the Pyodide worker

**Files:**
- Modify: `src/lib/pyodide/worker.js` (lines ~16, ~79, ~90)
- Modify: `src/lib/pyodide/index.js`

- [ ] **Step 1: Register the entry point in `worker.js`**

In `PY_FN` (around line 16), add the mapping:

```javascript
const PY_FN = {
  computeChart: 'compute_chart_json',
  computeTransit: 'compute_transit_json',
  computeYogasFallback: 'compute_yogas_json',
  computeDoshasFallback: 'compute_doshas_json',
  computeNumerology: 'compute_numerology_json',
  computeSynastry: 'compute_synastry_json',
  computeChartFacts: 'chart_facts_json',
}
```

In the `scripts` array (around line 79), add `dignity` and `adapter` **before** any module that imports them (`adapter` imports `dignity`):

```javascript
  const scripts = ['chart', 'transit', 'yogas', 'doshas', 'numerology', 'synastry', 'dignity', 'aspects', 'adapter']
```

In the preload import block (around line 90), add:

```javascript
from adapter import chart_facts_json
```

- [ ] **Step 2: Add the wrapper in `index.js`**

After `computeSynastry` (end of file, around line 82), add:

```javascript
export async function computeChartFacts(chartJson, refDate = null) {
  return compute('computeChartFacts', [asJson(chartJson), refDate])
}
```

- [ ] **Step 3: Verify the worker boots and the entry point runs (e2e smoke)**

Run: `npx playwright test tests/e2e/compute.spec.js`
Expected: PASS (the existing compute e2e still boots the worker with the added scripts). If Playwright browsers are not installed, run `npx playwright install chromium` first.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pyodide/worker.js src/lib/pyodide/index.js
git commit -m "feat(pyodide): expose chart_facts_json as computeChartFacts"
```

---

## Task 10: Surface depth in the agent tools

**Files:**
- Modify: `src/lib/llm/tools.js` (`get_chart` ~line 44–63; add `get_divisional`)
- Modify: `src/lib/llm/toolLabels.js`
- Test: `tests/e2e/compute.spec.js` (existing; extended assertion optional)

- [ ] **Step 1: Import the new compute function in `tools.js`**

At the top of `src/lib/llm/tools.js`, extend the pyodide import (currently `import { computeChart, computeTransit, computeSynastry, computeNumerology } from '../pyodide/index'`):

```javascript
import { computeChart, computeTransit, computeSynastry, computeNumerology, computeChartFacts } from '../pyodide/index'
```

- [ ] **Step 2: Enrich `get_chart` execute (replace lines 51–62)**

```javascript
    async execute({ profile_name }) {
      const profile = findProfileByName(profile_name)
      if (!profile?.chart) throw new Error(`No saved chart found for "${profile_name ?? 'active profile'}".`)
      const facts = await computeChartFacts(profile.chart)
      // Strength-annotated planets the model can weight (was: name+sign only).
      const planets = Object.entries(facts.planets).map(([name, f]) =>
        `${name}: ${f.sign} (H${f.house}), ${f.dignity}, ${f.strength}${f.retrograde ? ', retrograde' : ''}`)
      const d = facts.dasha
      return {
        name: profile.name,
        ascendant: facts.lagna,
        planets,
        // Full running period, not just the mahadasha label.
        dasha: [d.maha, d.antar, d.pratyantar].filter(Boolean).join(' → '),
        yogas: (profile.yogas ?? []).map(y => y.name ?? y).slice(0, 12),
        doshas: Object.entries(profile.doshas ?? {}).filter(([, v]) => v?.present).map(([k]) => k),
      }
    },
```

- [ ] **Step 3: Add the `get_divisional` tool (insert after the `get_chart` object, before `get_today_transit`)**

```javascript
  {
    name: 'get_divisional',
    description: "Get a saved profile's divisional (varga) chart placements. D9 (Navamsa) is the key chart for marriage and dharma questions; also D10 (career), D7 (children), D2/D3/D12 etc. Defaults to the active profile and D9.",
    parameters: {
      type: 'object',
      properties: {
        varga: { type: 'string', description: 'Divisional chart id: d2, d3, d4, d7, d9, d10, d12, d16, d20, d24, d27, d30, d40, d45, d60. Default d9.' },
        profile_name: { type: 'string', description: 'Name of a saved profile. Omit for the active profile.' },
      },
      required: [],
    },
    async execute({ varga, profile_name }) {
      const profile = findProfileByName(profile_name)
      if (!profile?.chart) throw new Error(`No saved chart found for "${profile_name ?? 'active profile'}".`)
      const key = (varga || 'd9').toLowerCase()
      const dv = profile.chart?.divisionalCharts?.[key]
      if (!dv?.houses) throw new Error(`Divisional chart "${key}" is not available for ${profile.name}.`)
      const placements = []
      for (const h of dv.houses) {
        for (const occ of h.occupants ?? []) {
          placements.push(`${occ.celestialBody} in ${occ.sign} (H${h.number})${occ.motion_type === 'retrograde' ? ' retro' : ''}`)
        }
      }
      return { name: profile.name, varga: key, ascendant: dv.ascendant, placements }
    },
  },
```

- [ ] **Step 4: Add the tool-chip label in `toolLabels.js`**

Open `src/lib/llm/toolLabels.js`, find the map of tool name → label, and add an entry consistent with the existing style (e.g. if entries look like `get_chart: 'Reading the chart'`):

```javascript
  get_divisional: 'Reading divisional charts',
```

(Match the exact object/format already in the file — read it first and mirror the existing entries.)

- [ ] **Step 5: Run JS unit tests + lint**

Run: `npx vitest run tests/lib/llm/toolLabels.test.js && npm run lint`
Expected: PASS, 0 lint errors. (If `toolLabels.test.js` asserts a complete label set, update it to include `get_divisional`.)

- [ ] **Step 6: Run the agent/compute e2e**

Run: `npx playwright test tests/e2e/agent.spec.js tests/e2e/compute.spec.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/llm/tools.js src/lib/llm/toolLabels.js tests/lib/llm/toolLabels.test.js
git commit -m "feat(tools): surface dignity/strength + full dasha chain in get_chart; add get_divisional"
```

---

## Task 11: Full verification & phase wrap

**Files:** none (verification only)

- [ ] **Step 1: Run the entire test suite**

Run: `.venv-test/bin/python -m pytest tests/python/ -v && npx vitest run && npm run lint`
Expected: all PASS, 0 lint errors.

- [ ] **Step 2: Run the production build (scripts copy + bundle)**

Run: `npm run build`
Expected: build succeeds; `public/pyodide-scripts/` now contains `adapter.py`, `dignity.py`, `aspects.py`.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Run: `npm run dev`, open the app, ask the chat "what's my chart strength and current period?" and confirm the reply reflects planet strength + a maha→antar→pratyantar dasha chain (proves the surfacing reached the model). Stop the dev server when done.

- [ ] **Step 4: Commit any test-snapshot updates and finish**

```bash
git add -A
git commit -m "test: P0 foundation full-suite green" --allow-empty
```

---

## Self-Review notes (for the implementer)

- **Spec coverage (P0):** adapter (Tasks 2–5,8) ✓; dignity surfacing (Task 6) ✓; aspects surfacing (Task 7) ✓; golden-fixture harness (Task 1, smoke anchors) ✓; surface depth via `get_chart` + `get_divisional` (Tasks 9–10) ✓. Out of P0 scope (later plans): yoga registry expansion, doshas→8, deep synastry, Varshaphal, numerology expansion, `reading-procedure` prompt block.
- **Type consistency:** `planet_facts` field names (`is_strong`, `rupas`, `min_required`, `meets`, `aspects_gives/receives`, `conjuncts`) are reused verbatim by `dignity.strength_label`, `aspects.aspect_summary`, and `chart_facts`. `chart_facts` adds `strength`; `get_chart` reads `f.dignity/f.strength/f.house/f.sign/f.retrograde` and `facts.lagna/planets/dasha`. The worker key `computeChartFacts` → `chart_facts_json` matches the `index.js` wrapper.
- **Ordering gotcha:** in `worker.js` the `scripts` array must list `dignity` before `adapter` is imported in the preload block (adapter imports dignity); both files are fetched before the `runPythonAsync` import block executes, so array order only affects fetch logging, but keep `dignity`/`aspects`/`adapter` last as shown.
```
