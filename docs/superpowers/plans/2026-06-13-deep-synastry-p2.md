# Deep Synastry (P2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Extend Kundali Match beyond Moon-only Guna Milan + planet→house overlays to a deep synastry: planet↔planet cross-aspects between the two charts, dignity/strength-weighted overlays, a 7th-lord/karaka relationship read per person, and current-dasha-period compatibility — surfaced concisely (under the 6000-char tool cap).

**Architecture:** A shared `relationships.py` holds the canonical Naisargika planetary-friendship matrix (factored out of `numerology.py`, dedup). `synastry.py` gains the deep layers, consuming the adapter's normalized facts (`planet_facts` → sign_idx, dignity, strength; `house_lords`; `current_dasha_chain`) rather than raw chart JSON, so it can weight by dignity/strength and read dasha. `compute_synastry` aggregates everything plus a ranked supportive/challenging digest; the `match_profiles` tool and the Match-tab formatter surface a compact view.

**Tech Stack:** Pure Python in the Pyodide worker; pytest (`.venv-test/bin/python -m pytest`); JS via `npx vitest run`; `npm run lint` (0 errors / 9 warnings baseline); `npm run build`. Fixtures `sarthak_chart`/`tanya_chart` in `tests/python/conftest.py`.

**Verified facts:**
- `adapter.planet_facts(chart)` → `{planet: {sign, sign_idx, house, dignity (normalized: own/exalted/debilitated/moolatrikona/neutral), strength (strong/adequate/weak/unknown after chart_facts), is_strong, ...}}`. Note: `planet_facts` alone does NOT set `strength` (that's added in `chart_facts`); for synastry use `chart_facts(chart)["planets"]` to get the `strength` label, OR call `strength_label(fact)` from `dignity.py`. **Use `adapter.chart_facts(chart)` to get planets-with-strength + lords + dasha in one call.**
- `adapter.chart_facts(chart)` → `{lagna, lords (house→planet), planets (with strength), dasha (maha/antar/pratyantar)}`.
- `numerology.py` has `_NAISARGIKA` (9-planet friend/enemy matrix; Rahu↔Saturn set, Ketu↔Mars set) and `_planet_relation(a,b)` → friend|enemy|neutral. These move to `relationships.py`.
- Worker loads scripts listed in BOTH `src/lib/pyodide/worker.js` `scripts` array AND `vite.config.js` `PY_SCRIPTS` — keep in sync. New module `relationships` must be added to both.
- `compute_synastry(chart_a_json, chart_b_json, gender_a, gender_b)` is the entry; `compute_synastry_json` wraps it; the `match_profiles` tool + `formatSynastryContext` consume it.

---

## File Structure

- Create: `src/lib/pyodide/scripts/relationships.py` — Naisargika matrix + `planet_relation`.
- Modify: `src/lib/pyodide/scripts/numerology.py` — import from `relationships` (dedup).
- Modify: `src/lib/pyodide/scripts/synastry.py` — cross-aspects, dignity-weighted overlays, karaka/7th-lord, dasha overlap, aggregation.
- Modify: `src/lib/pyodide/worker.js` + `vite.config.js` — add `relationships` to the script lists.
- Modify: `src/lib/llm/tools.js` — richer-but-capped `match_profiles` result.
- Modify: `src/lib/prompts/formatters.js` — `formatSynastryContext` surfaces the deep data.
- Tests: `tests/python/test_relationships.py` (new); extend `tests/python/test_synastry_kootas.py` and `tests/python/test_numerology_synastry.py`.

---

### Task 1: Shared `relationships.py` (dedup the friendship matrix)

**Files:** Create `src/lib/pyodide/scripts/relationships.py`; Modify `numerology.py`, `worker.js`, `vite.config.js`; Test `tests/python/test_relationships.py`.

- [ ] **Step 1: Write failing test** `tests/python/test_relationships.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from relationships import NAISARGIKA, planet_relation


def test_matrix_has_nine_grahas():
    assert set(NAISARGIKA) == {"Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"}


def test_relations_symmetric_severity():
    assert planet_relation("Sun", "Jupiter") == "friend"
    assert planet_relation("Sun", "Saturn") == "enemy"
    assert planet_relation("Saturn", "Jupiter") == "neutral"
    # enemy dominates if either side is an enemy
    assert planet_relation("Moon", "Mercury") == "enemy"   # Mercury counts Moon an enemy
    assert planet_relation("nope", "Sun") == "neutral"     # unknown -> neutral
```

- [ ] **Step 2: Run, confirm FAIL** — `.venv-test/bin/python -m pytest tests/python/test_relationships.py -v`.

- [ ] **Step 3: Create `relationships.py`** — move the matrix + relation here verbatim (the canonical reference; keep the existing comments):

```python
# src/lib/pyodide/scripts/relationships.py
"""Naisargika (natural) planetary friendships (BPHS) — the canonical reference used by both
numerology compatibility and synastry. 'friend'/'enemy'/'neutral' only. Rahu follows Saturn's
set and Ketu follows Mars's set (standard convention)."""

NAISARGIKA = {
    "Sun":     {"friend": {"Moon", "Mars", "Jupiter"},   "enemy": {"Venus", "Saturn"}},
    "Moon":    {"friend": {"Sun", "Mercury"},            "enemy": set()},
    "Mars":    {"friend": {"Sun", "Moon", "Jupiter"},    "enemy": {"Mercury"}},
    "Mercury": {"friend": {"Sun", "Venus"},              "enemy": {"Moon"}},
    "Jupiter": {"friend": {"Sun", "Moon", "Mars"},       "enemy": {"Mercury", "Venus"}},
    "Venus":   {"friend": {"Mercury", "Saturn"},         "enemy": {"Sun", "Moon"}},
    "Saturn":  {"friend": {"Mercury", "Venus"},          "enemy": {"Sun", "Moon", "Mars"}},
    "Rahu":    {"friend": {"Mercury", "Venus", "Saturn"},"enemy": {"Sun", "Moon", "Mars"}},
    "Ketu":    {"friend": {"Sun", "Moon", "Jupiter"},    "enemy": {"Mercury"}},
}


def planet_relation(p_a, p_b):
    """friend | enemy | neutral between two planets (enemy dominates, then friend, else neutral)."""
    a = NAISARGIKA.get(p_a, {})
    b = NAISARGIKA.get(p_b, {})
    if p_b in a.get("enemy", set()) or p_a in b.get("enemy", set()):
        return "enemy"
    if p_b in a.get("friend", set()) or p_a in b.get("friend", set()):
        return "friend"
    return "neutral"
```

- [ ] **Step 4: Refactor `numerology.py`** — replace the local `_NAISARGIKA`/`_planet_relation` with an import: `from relationships import planet_relation`. Update `compute_number_compatibility` to call `planet_relation(pa, pb)` instead of `_planet_relation`. Delete the now-duplicate `_NAISARGIKA` dict and `_planet_relation` def from numerology.py. (Its existing tests in `test_numerology_synastry.py` must still pass — behaviour identical.)

- [ ] **Step 5: Wire the module into the worker.** In `src/lib/pyodide/worker.js` add `'relationships'` to the `scripts` array (place it before `'numerology'` and `'synastry'` for readability — load order doesn't matter since all files are written before any import). In `vite.config.js` add `'relationships'` to `PY_SCRIPTS`. (No new `PY_FN`/preload import needed — it's imported transitively by numerology/synastry.)

- [ ] **Step 6: Run** — `.venv-test/bin/python -m pytest tests/python/test_relationships.py tests/python/test_numerology_synastry.py -v` → all pass. `npm run build` → success (confirms the script lists are valid).

- [ ] **Step 7: Commit** — `refactor: extract Naisargika friendship matrix into relationships.py` (+ Co-Authored-By trailer).

---

### Task 2: Planet↔planet cross-aspects

**Files:** Modify `synastry.py`; Test `tests/python/test_synastry_kootas.py`.

Vedic graha-drishti is sign-based and zodiac signs are shared across charts, so the cross-aspect from A's planet (sign index iA) to B's planet (sign index iB) uses `dist = ((iB - iA) % 12) + 1` (1=same sign=conjunction, 7=opposition, etc.).

- [ ] **Step 1: Write failing tests** in `tests/python/test_synastry_kootas.py`:

```python
from synastry import cross_aspects, ASPECT_ANGLES

def _pf(planet, sign_idx, dignity="neutral", strength="adequate"):
    return {planet: {"sign_idx": sign_idx, "dignity": dignity, "strength": strength}}

def test_seventh_aspect_is_mutual():
    # A's Venus in Aries(0), B's Mars in Libra(6): distance 7 both ways -> both aspect.
    a = _pf("Venus", 0); b = _pf("Mars", 6)
    res = cross_aspects(a, b)
    pairs = {(x["from"], x["from_owner"], x["to"]) for x in res}
    assert ("Venus", "A", "Mars") in pairs   # Venus aspects Mars (7th)
    assert ("Mars", "B", "Venus") in pairs    # Mars aspects Venus (7th, mutual)

def test_jupiter_special_5th_aspect():
    # A's Jupiter in Aries(0) aspects B's planet in Leo(4): distance 5 -> Jupiter's 5th aspect.
    a = _pf("Jupiter", 0); b = _pf("Moon", 4)
    res = cross_aspects(a, b)
    assert any(x["from"] == "Jupiter" and x["to"] == "Moon" and x["type"] == "aspect" for x in res)
    # but the reverse (Moon -> Jupiter, distance 9) is NOT a Moon aspect
    assert not any(x["from"] == "Moon" and x["to"] == "Jupiter" for x in res)

def test_conjunction_same_sign():
    a = _pf("Venus", 3); b = _pf("Mars", 3)
    res = cross_aspects(a, b)
    assert any(x["type"] == "conjunction" and {x["from"], x["to"]} == {"Venus", "Mars"} for x in res)

def test_benefic_aspect_supportive_malefic_challenging():
    a = _pf("Jupiter", 0); b = _pf("Moon", 6)   # Jupiter (benefic) -> Moon, 7th
    assert any(x["from"] == "Jupiter" and x["effect"] == "supportive" for x in cross_aspects(a, b))
    a2 = _pf("Saturn", 0); b2 = _pf("Moon", 6)  # Saturn (malefic) -> Moon, 7th
    assert any(x["from"] == "Saturn" and x["effect"] == "challenging" for x in cross_aspects(a2, b2))
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement** in `synastry.py`. Add near the overlay helpers:

```python
# Vedic graha-drishti angles (1-based, 1 = same sign). Every planet aspects the 7th; Mars also
# the 4th & 8th, Jupiter the 5th & 9th, Saturn the 3rd & 10th. Rahu/Ketu: 5th, 7th, 9th (common).
ASPECT_ANGLES = {
    "Mars": {4, 7, 8}, "Jupiter": {5, 7, 9}, "Saturn": {3, 7, 10},
    "Rahu": {5, 7, 9}, "Ketu": {5, 7, 9},
}
DEFAULT_ASPECT = {7}
# Romantic/relationship-salient planets, used only to flag a higher-signal note.
_AFFECTION = {"Venus", "Moon"}


def _aspect_effect(from_planet, weight_strength):
    """benefic caster -> supportive, malefic -> challenging; strength scales the weight."""
    nature = ("benefic" if from_planet in BENEFIC_PLANETS
              else "malefic" if from_planet in MALEFIC_PLANETS else "neutral")
    effect = "supportive" if nature == "benefic" else "challenging" if nature == "malefic" else "neutral"
    w = {"strong": 1.5, "adequate": 1.0, "weak": 0.5}.get(weight_strength, 1.0)
    return nature, effect, round(w if effect != "neutral" else 0.0, 2)


def _cross_one_direction(facts_from, owner, facts_to, out):
    for pf, ff in facts_from.items():
        ia = ff.get("sign_idx", -1)
        if ia < 0:
            continue
        angles = ASPECT_ANGLES.get(pf, DEFAULT_ASPECT)
        for pt, ft in facts_to.items():
            ib = ft.get("sign_idx", -1)
            if ib < 0:
                continue
            dist = ((ib - ia) % 12) + 1
            if dist == 1:
                continue  # conjunction handled once, separately
            if dist in angles:
                nature, effect, weight = _aspect_effect(pf, ff.get("strength"))
                note = f"{owner}'s {pf} aspects their {pt}"
                if pf == "Saturn" and pt in _AFFECTION:
                    note = f"{owner}'s Saturn restrains their {pt} — can feel heavy in affection"
                elif pf in ("Jupiter", "Venus") and pt in _AFFECTION:
                    note = f"{owner}'s {pf} warms their {pt} — affection and ease"
                out.append({"from": pf, "from_owner": owner, "to": pt, "type": "aspect",
                            "dignity": ff.get("dignity"), "strength": ff.get("strength"),
                            "nature": nature, "effect": effect, "weight": weight, "note": note})


def cross_aspects(facts_a, facts_b):
    """All planet->planet graha-drishti between the two charts, both directions, plus
    same-sign conjunctions (listed once). facts_* are adapter planet-fact dicts (need sign_idx,
    dignity, strength)."""
    out = []
    _cross_one_direction(facts_a, "A", facts_b, out)
    _cross_one_direction(facts_b, "B", facts_a, out)
    # Conjunctions (same sign) — list each unordered pair once.
    seen = set()
    for pa, fa in facts_a.items():
        for pb, fb in facts_b.items():
            if fa.get("sign_idx", -2) == fb.get("sign_idx", -1):
                key = tuple(sorted((f"A:{pa}", f"B:{pb}")))
                if key in seen:
                    continue
                seen.add(key)
                na = pa in BENEFIC_PLANETS or pb in BENEFIC_PLANETS
                ma = pa in MALEFIC_PLANETS or pb in MALEFIC_PLANETS
                effect = "challenging" if ma and not na else "supportive" if na and not ma else "neutral"
                out.append({"from": pa, "from_owner": "A", "to": pb, "type": "conjunction",
                            "nature": "mixed", "effect": effect, "weight": 1.0 if effect != "neutral" else 0.0,
                            "note": f"{pa} and {pb} sit together — fused energies"})
    return out
```

- [ ] **Step 4: Run, confirm PASS** — `.venv-test/bin/python -m pytest tests/python/test_synastry_kootas.py -k "aspect or conjunction" -v`.

- [ ] **Step 5: Commit** — `feat: planet-to-planet cross-aspects for synastry`.

---

### Task 3: Dignity/strength-weighted overlays

**Files:** Modify `synastry.py`; Test `tests/python/test_synastry_kootas.py`.

The current `compute_house_overlays(chart_a, chart_b)` reads raw JSON and ignores the overlaying planet's condition. Add an optional `facts` arg (the source planet facts from the adapter) so each overlay carries the planet's dignity/strength and a scaled weight.

- [ ] **Step 1: Write failing tests:**

```python
from synastry import compute_house_overlays

def test_overlay_carries_strength_when_facts_given():
    # minimal charts: B has Jupiter in the sign that is A's 7th house.
    chart_a = {"d1Chart": {"houses": [{"number": n, "sign": s, "occupants": []}
               for n, s in enumerate(["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra",
                                       "Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"], 1)]}}
    chart_b = {"d1Chart": {"houses": [{"number": 1, "sign": "Aries",
               "occupants": [{"celestialBody": "Jupiter", "sign": "Libra"}]}]}}
    facts_b = {"Jupiter": {"dignity": "exalted", "strength": "strong"}}
    ov = compute_house_overlays(chart_a, chart_b, facts_b)
    j = next(o for o in ov if o["planet"] == "Jupiter")
    assert j["falls_in_house"] == 7
    assert j["strength"] == "strong" and j["dignity"] == "exalted"
    assert j["weight"] >= 1.5  # strong benefic on the 7th weighs more

def test_overlay_without_facts_still_works():
    # back-compat: no facts arg -> no strength/dignity, weight defaults.
    chart_a = {"d1Chart": {"houses": [{"number": 1, "sign": "Aries", "occupants": []}]}}
    chart_b = {"d1Chart": {"houses": [{"number": 1, "sign": "Aries",
               "occupants": [{"celestialBody": "Mars", "sign": "Aries"}]}]}}
    ov = compute_house_overlays(chart_a, chart_b)
    assert ov and ov[0]["planet"] == "Mars"
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement** — change the signature to `compute_house_overlays(chart_a, chart_b, facts_b=None)`. Inside the occupant loop, after `nature, effect, note = _classify_overlay(...)`, look up the planet's fact and add fields:

```python
            f = (facts_b or {}).get(planet, {})
            strength = f.get("strength")
            base = 1.5 if effect in ("supportive", "challenging") else 0.0
            weight = round(base * {"strong": 1.5, "adequate": 1.0, "weak": 0.5}.get(strength, 1.0), 2)
            overlays.append({
                "planet": planet, "falls_in_house": house_in_a,
                "house_meaning": HOUSE_MEANING.get(house_in_a, ""), "sign": sign,
                "dignity": f.get("dignity"), "strength": strength,
                "nature": nature, "effect": effect, "weight": weight, "note": note,
            })
```

(Keep existing keys; `dignity`/`strength`/`weight` are additive. The `test_synastry_returns_guna_milan_and_overlays` test stays green.)

- [ ] **Step 4: Run, confirm PASS.**

- [ ] **Step 5: Commit** — `feat: dignity/strength-weighted house overlays`.

---

### Task 4: 7th-lord & karaka relationship read

**Files:** Modify `synastry.py`; Test `tests/python/test_synastry_kootas.py`.

For each person summarise the marriage-significant factors: the 7th-house lord's strength + where it sits, and the love karaka Venus (and Jupiter, the husband karaka) strength.

- [ ] **Step 1: Write failing tests:**

```python
from synastry import marriage_factors

def test_marriage_factors_reports_seventh_lord_and_karakas():
    facts = {
        "Venus": {"house": 2, "dignity": "own", "strength": "strong"},
        "Jupiter": {"house": 5, "dignity": "neutral", "strength": "adequate"},
        "Saturn": {"house": 7, "dignity": "neutral", "strength": "weak"},
    }
    lords = {7: "Saturn"}
    mf = marriage_factors(facts, lords)
    assert mf["seventh_lord"] == "Saturn"
    assert mf["seventh_lord_strength"] == "weak"
    assert mf["venus_strength"] == "strong"
    assert mf["jupiter_strength"] == "adequate"
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement:**

```python
def marriage_factors(facts, lords):
    """Relationship-significant condition for one chart: the 7th lord and the love karakas."""
    l7 = lords.get(7)
    l7f = facts.get(l7, {}) if l7 else {}
    venus = facts.get("Venus", {})
    jup = facts.get("Jupiter", {})
    return {
        "seventh_lord": l7,
        "seventh_lord_strength": l7f.get("strength"),
        "seventh_lord_house": l7f.get("house"),
        "venus_strength": venus.get("strength"),
        "venus_dignity": venus.get("dignity"),
        "jupiter_strength": jup.get("strength"),
        "summary": (
            f"7th lord {l7 or '—'} is {l7f.get('strength','unknown')}; "
            f"Venus is {venus.get('strength','unknown')}, Jupiter {jup.get('strength','unknown')}"
        ),
    }
```

- [ ] **Step 4: Run, confirm PASS.**

- [ ] **Step 5: Commit** — `feat: 7th-lord and karaka marriage factors`.

---

### Task 5: Dasha-period overlap

**Files:** Modify `synastry.py`; Test `tests/python/test_synastry_kootas.py`.

Compare the two people's current Mahadasha lords and their natural relationship.

- [ ] **Step 1: Write failing tests:**

```python
from synastry import dasha_overlap

def test_dasha_overlap_relation():
    assert dasha_overlap("Sun", "Jupiter")["relation"] == "friend"
    assert dasha_overlap("Sun", "Saturn")["relation"] == "enemy"
    assert dasha_overlap(None, "Saturn")["relation"] == "unknown"
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement** (imports `planet_relation` from `relationships`):

```python
from relationships import planet_relation  # add to the imports at top of synastry.py

def dasha_overlap(maha_a, maha_b):
    """Compatibility of the two people's current Mahadasha lords."""
    if not maha_a or not maha_b:
        return {"a_maha": maha_a, "b_maha": maha_b, "relation": "unknown",
                "note": "current period unavailable for one or both"}
    rel = planet_relation(maha_a, maha_b)
    note = {
        "friend": "Both are running periods whose lords are natural friends — easy timing alignment.",
        "neutral": "Their current period lords are neutral to each other — neither helps nor hinders.",
        "enemy": "Their current period lords are natural enemies — timing/priorities may clash now.",
    }[rel]
    return {"a_maha": maha_a, "b_maha": maha_b, "relation": rel, "note": note}
```

- [ ] **Step 4: Run, confirm PASS.**

- [ ] **Step 5: Commit** — `feat: current-dasha-period compatibility`.

---

### Task 6: Aggregate into `compute_synastry` + ranked digest

**Files:** Modify `synastry.py`; Test `tests/python/test_synastry_kootas.py` + `tests/python/test_numerology_synastry.py`.

- [ ] **Step 1: Write failing tests:**

```python
from synastry import compute_synastry
from chart import compute_chart

def test_compute_synastry_has_deep_layers():
    a = compute_chart("A", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")
    b = compute_chart("B", "1998-07-11", "19:10", 27.1767, 78.0081, 5.5, "Agra")
    s = compute_synastry(a, b)
    assert "cross_aspects" in s and isinstance(s["cross_aspects"], list)
    assert "marriage_factors" in s and set(s["marriage_factors"]) == {"a", "b"}
    assert "dasha_overlap" in s and "relation" in s["dasha_overlap"]
    assert "top_supportive" in s and "top_challenging" in s
    # digest items are capped
    assert len(s["top_supportive"]) <= 5 and len(s["top_challenging"]) <= 5
    # existing keys preserved
    assert "guna_milan" in s and "overlay_summary" in s
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement** — rewrite `compute_synastry` to build adapter facts once per chart and assemble the deep layers. Import at top: `from adapter import chart_facts`.

```python
def _digest(items, effect):
    """Top weighted items of one effect, as short strings, highest weight first."""
    picked = sorted((i for i in items if i.get("effect") == effect),
                    key=lambda i: i.get("weight", 0), reverse=True)
    return [i["note"] for i in picked[:5]]


def compute_synastry(chart_a_json, chart_b_json, gender_a="", gender_b=""):
    nak_a, _, sign_a = _moon_nakshatra(chart_a_json)
    nak_b, _, sign_b = _moon_nakshatra(chart_b_json)

    fa = chart_facts(chart_a_json)   # {lagna, lords, planets(with strength), dasha}
    fb = chart_facts(chart_b_json)
    planets_a, planets_b = fa["planets"], fb["planets"]

    a_in_b = compute_house_overlays(chart_b_json, chart_a_json, planets_a)  # A's planets in B's houses
    b_in_a = compute_house_overlays(chart_a_json, chart_b_json, planets_b)
    crosses = cross_aspects(planets_a, planets_b)

    all_items = a_in_b + b_in_a + crosses
    return {
        "guna_milan": compute_guna_milan(nak_a, gender_a, nak_b, gender_b, sign_a, sign_b),
        "a_planets_in_b_houses": a_in_b,
        "b_planets_in_a_houses": b_in_a,
        "cross_aspects": crosses,
        "marriage_factors": {"a": marriage_factors(planets_a, fa["lords"]),
                             "b": marriage_factors(planets_b, fb["lords"])},
        "dasha_overlap": dasha_overlap(fa["dasha"].get("maha"), fb["dasha"].get("maha")),
        "overlay_summary": _overlay_tally(a_in_b, b_in_a, crosses),
        "top_supportive": _digest(all_items, "supportive"),
        "top_challenging": _digest(all_items, "challenging"),
    }
```

(`_overlay_tally` already accepts `*overlay_lists`; passing `crosses` too folds cross-aspects into the supportive/challenging/lean tally. Cross-aspect and overlay items both carry `effect`, so this works unchanged.)

- [ ] **Step 4: Run** — `.venv-test/bin/python -m pytest tests/python/test_synastry_kootas.py tests/python/test_numerology_synastry.py -v` → all pass (existing synastry test `test_synastry_returns_guna_milan_and_overlays` still green).

- [ ] **Step 5: Commit** — `feat: aggregate deep synastry (cross-aspects, karakas, dasha, ranked digest)`.

---

### Task 7: Surface in the tool + Match-tab formatter (within the 6000-char cap)

**Files:** Modify `src/lib/llm/tools.js`, `src/lib/prompts/formatters.js`.

- [ ] **Step 1: Update `match_profiles`** in `tools.js` to return the deep digest compactly (the tool result is truncated at 6000 chars, so summarise — do NOT dump the full cross-aspect list):

```javascript
      const s = await computeSynastry(a.chart, b.chart, a.gender, b.gender)
      const mf = s.marriage_factors ?? {}
      return {
        between: [a.name, b.name],
        guna_milan: { total: s.guna_milan.total, max: 36, verdict: s.guna_milan.verdict, breakdown: s.guna_milan.breakdown },
        overlay_summary: s.overlay_summary,
        top_supportive: (s.top_supportive ?? []).slice(0, 5),
        top_challenging: (s.top_challenging ?? []).slice(0, 5),
        marriage_factors: {
          [a.name]: mf.a?.summary,
          [b.name]: mf.b?.summary,
        },
        dasha: s.dasha_overlap?.note,
      }
```

Update the tool `description` to mention it now includes planet-to-planet cross-aspects, dignity-weighted strengths/strains, the 7th-lord/karaka read, and current-period compatibility.

- [ ] **Step 2: Update `formatSynastryContext`** in `formatters.js` to surface the deep layers for the Match tab (data only — the output shape is governed by soul.md). After the existing overlay sections, append:

```javascript
  const supportive = (synastryData.top_supportive ?? []).map(s => `- ${s}`).join('\n')
  const challenging = (synastryData.top_challenging ?? []).map(s => `- ${s}`).join('\n')
  const mf = synastryData.marriage_factors ?? {}
  const dasha = synastryData.dasha_overlap?.note ?? ''
```

and include these blocks in the returned string:
```
### Strongest supportive factors
${supportive || '—'}

### Strongest strains
${challenging || '—'}

### Marriage significators
${profileA.name}: ${mf.a?.summary ?? '—'}
${profileB.name}: ${mf.b?.summary ?? '—'}

### Current period
${dasha}
```

Keep the existing Guna Milan + overlay sections. The existing `formatters.test.js` asserts only the Guna Milan/overlay data, which is unchanged — confirm it stays green; it must not throw when `top_supportive`/`marriage_factors`/`dasha_overlap` are absent (use the `?? []`/`?? '—'` guards as shown).

- [ ] **Step 3: Verify** — `npx vitest run` (formatters test green), `npm run lint`, `npm run build`.

- [ ] **Step 4: Commit** — `feat: surface deep synastry in match tool + Match tab`.

---

### Task 8: Final integration verification

- [ ] **Step 1:** `.venv-test/bin/python -m pytest tests/python -v` → all pass.
- [ ] **Step 2:** `npx vitest run` → all pass.
- [ ] **Step 3:** `npm run lint` → 0 errors, ≤9 warnings.
- [ ] **Step 4:** `npm run build` → success.
- [ ] **Step 5:** Manual sanity in a Python REPL: `compute_synastry(sarthak, tanya)` returns non-empty `cross_aspects`, `marriage_factors.a/.b`, a `dasha_overlap.relation`, and ≤5-item `top_supportive`/`top_challenging`. Spot-check the cross-aspect notes read sensibly.

---

## Self-Review

**Spec coverage:** planet↔planet cross-aspects (Task 2) · dignity/strength-weighted overlays (Task 3) · 7th-lord + Venus/Jupiter karaka read (Task 4) · current-dasha compatibility (Task 5) · ranked supportive/challenging digest + aggregation (Task 6) · surfaced under the char cap (Task 7). Friendship matrix dedup (Task 1).

**Placeholder scan:** all new functions given in full. Reference data (the Naisargika matrix) is copied verbatim from the existing numerology source.

**Type consistency:** `cross_aspects(facts_a, facts_b)`, `compute_house_overlays(chart_a, chart_b, facts_b=None)`, `marriage_factors(facts, lords)`, `dasha_overlap(maha_a, maha_b)`, `_digest(items, effect)` — signatures consistent with the call sites in `compute_synastry`. `chart_facts(chart)` returns `{lagna, lords, planets, dasha}` and `dasha` has a `maha` key (verified against adapter). Cross-aspect and overlay items both carry `effect`/`weight`/`note`, so `_overlay_tally` and `_digest` treat them uniformly. Existing synastry/numerology tests stay green (all additions are additive; `compute_house_overlays`' new `facts_b` arg defaults to `None`).

**Risk notes:** Cross-aspect interpretation is rule-based (benefic→supportive, malefic→challenging, scaled by strength) — no free-form interpretation, conserving the never-hallucinate rule. Rahu/Ketu given the common 5/7/9 drishti (documented). The Naisargika move touches deployed numerology — covered by keeping its tests green and behaviour identical. Tool output is explicitly capped to 5+5 digest items + short summaries to stay under 6000 chars.
