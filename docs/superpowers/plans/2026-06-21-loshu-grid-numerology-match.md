# Lo Shu Grid + Numerology Matchmaking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Lo Shu grid to the Numbers tab and a separate numerology-compatibility panel to the Match tab, wiring compute → agent → UI per `CLAUDE.md`.

**Architecture:** All new computation lives in the existing `numerology.py` Pyodide script (no new script file, so no `worker.js`/`vite.config.js` script-list changes). The grid is the authentic Lo Shu magic square (4-9-2 / 3-5-7 / 8-1-6); meanings are grounded in the planet rulers already in `numerology.py` and the NAISARGIKA friendship table already in `relationships.py`. A new `numerology_match` tool (two people) is kept separate from the existing `numerology_compatibility` primitive (two numbers). Existing profiles gain the grid via the existing engine-version migration path.

**Tech Stack:** Python (Pyodide), React (Vite), Vitest, Playwright. Test runners: `.venv-test/bin/python -m pytest tests/python`, `npx vitest run`, `npx playwright test`. Gates: `npm run lint`, `npm run build`.

**Sourcing discipline (governing rule):** one convention only; line geometry is magic-square fact; interpretive phrases summarise planet rulers (no imported pop-numerology prose); the match score is always labelled "indicative, non-classical" and never blended into Guna Milan.

**Reference spec:** `docs/superpowers/specs/2026-06-21-loshu-grid-numerology-match-design.md`

---

## Task 1: Kua number compute (Python)

**Files:**
- Modify: `src/lib/pyodide/scripts/numerology.py`
- Test: `tests/python/test_loshu.py` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/python/test_loshu.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from numerology import compute_kua


def test_kua_male_1996():
    # 1+9+9+6 = 25 -> 7; male = 10 - 7 = 3
    assert compute_kua(1996, "male") == 3


def test_kua_female_1996():
    # female = 5 + 7 = 12 -> 3
    assert compute_kua(1996, "female") == 3


def test_kua_male_five_maps_to_two():
    # 1994 -> 1+9+9+4 = 23 -> 5; male = 10 - 5 = 5 -> 2
    assert compute_kua(1994, "male") == 2


def test_kua_female_five_maps_to_eight():
    # year root 9 -> female 5+9 = 14 -> 5 -> 8 (e.g. 1980: 1+9+8+0=18->9)
    assert compute_kua(1980, "female") == 8


def test_kua_none_for_other_or_blank():
    assert compute_kua(1996, "other") is None
    assert compute_kua(1996, "") is None
    assert compute_kua(1996, None) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_loshu.py -v`
Expected: FAIL with `ImportError: cannot import name 'compute_kua'`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/pyodide/scripts/numerology.py`, after `_with_ruler` (around line 33), add:

```python
def compute_kua(year, gender):
    """Eight Mansions (Ba Zhai) Kua number, 1-9. Returns None unless gender is male/female
    (the classical formula is only defined for those two)."""
    g = (gender or "").lower()
    if g not in ("male", "female"):
        return None
    s = _reduce(sum(int(d) for d in str(year)), keep_master=False)
    if g == "male":
        k = 10 - s
        return 2 if k == 5 else k
    k = _reduce(5 + s, keep_master=False)
    return 8 if k == 5 else k
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_loshu.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/numerology.py tests/python/test_loshu.py
git commit -m "feat(numerology): add Kua number compute"
```

---

## Task 2: Lo Shu grid compute (Python)

**Files:**
- Modify: `src/lib/pyodide/scripts/numerology.py`
- Test: `tests/python/test_loshu.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/python/test_loshu.py`:

```python
from numerology import compute_loshu_grid


def test_loshu_counts_skip_zero_and_include_driver_conductor():
    # 1996-11-22: DOB digits (no 0s) = 1,9,9,6,1,1,2,2 ; mulank=4 (22->4); bhagyank=life_path
    # life_path = 1+9+9+6+1+1+2+2 = 31 -> 4 ; kua omitted (no gender)
    g = compute_loshu_grid("1996-11-22")
    assert set(g["counts"].keys()) == {str(n) for n in range(1, 10)}   # only 1-9, never 0
    assert g["counts"]["1"] == 3       # three 1s in the date
    assert g["counts"]["9"] == 2
    assert g["counts"]["4"] == 2       # mulank(4) + bhagyank(4)
    assert g["kua"] is None
    assert g["kua_note"]


def test_loshu_missing_and_repeated():
    g = compute_loshu_grid("1996-11-22")
    assert 5 in g["missing"]           # no 5 placed
    assert 9 in g["repeated"]          # appears twice


def test_loshu_lines_and_arrows_present():
    g = compute_loshu_grid("1996-11-22")
    names = {l["name"] for l in g["lines"]}
    assert "Mental plane (4-9-2)" in names
    assert "Will (9-5-1)" in names
    # every line carries cells, a state, and a meaning
    for l in g["lines"]:
        assert l["state"] in ("full", "partial", "absent")
        assert l["meaning"]
    assert isinstance(g["arrows_strength"], list)
    assert isinstance(g["arrows_weakness"], list)


def test_loshu_kua_placed_when_gender_given():
    # 1996 male kua = 3; that adds an extra 3 to the grid
    no_g = compute_loshu_grid("1996-11-22")
    male = compute_loshu_grid("1996-11-22", "male")
    assert male["kua"] == 3
    assert male["counts"]["3"] == no_g["counts"]["3"] + 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_loshu.py -v`
Expected: FAIL with `ImportError: cannot import name 'compute_loshu_grid'`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/pyodide/scripts/numerology.py`, after `compute_kua`, add the line tables and grid function:

```python
# Lines through the Lo Shu magic square (4-9-2 / 3-5-7 / 8-1-6): rows (planes), columns,
# diagonals. Geometry is magic-square fact; the meaning summarises the cells' planet rulers
# (PLANET_RULER) — not imported pop-numerology prose.
LOSHU_LINES = [
    ("Mental plane (4-9-2)",    [4, 9, 2]),
    ("Emotional plane (3-5-7)", [3, 5, 7]),
    ("Practical plane (8-1-6)", [8, 1, 6]),
    ("Thought (4-3-8)",         [4, 3, 8]),
    ("Will (9-5-1)",            [9, 5, 1]),
    ("Action (2-7-6)",          [2, 7, 6]),
    ("Diagonal 4-5-6",          [4, 5, 6]),
    ("Diagonal 2-5-8",          [2, 5, 8]),
]

LOSHU_LINE_MEANING = {
    "Mental plane (4-9-2)":    "thinking, drive and imagination (Rahu-Mars-Moon).",
    "Emotional plane (3-5-7)": "wisdom, balance and detachment (Jupiter-Mercury-Ketu).",
    "Practical plane (8-1-6)": "method, identity and comfort (Saturn-Sun-Venus).",
    "Thought (4-3-8)":         "planning and discipline (Rahu-Jupiter-Saturn).",
    "Will (9-5-1)":            "determination, intellect and identity (Mars-Mercury-Sun).",
    "Action (2-7-6)":          "instinct, detachment and harmony (Moon-Ketu-Venus).",
    "Diagonal 4-5-6":          "grounded, steady balance (Rahu-Mercury-Venus).",
    "Diagonal 2-5-8":          "emotional resilience (Moon-Mercury-Saturn).",
}


def compute_loshu_grid(dob, gender=None):
    """3x3 Lo Shu grid populated from DOB digits + mulank + bhagyank + kua. 0 is never placed."""
    parts = dob.split('-')
    mulank = _reduce(int(parts[2]), keep_master=False)
    bhagyank = _reduce(sum(int(d) for d in dob if d.isdigit()), keep_master=False)
    kua = compute_kua(int(parts[0]), gender)

    placed = [int(d) for d in dob if d.isdigit() and d != '0']
    placed += [mulank, bhagyank]
    if kua:
        placed.append(kua)
    placed = [n for n in placed if 1 <= n <= 9]

    counts = {str(n): placed.count(n) for n in range(1, 10)}
    missing = [n for n in range(1, 10) if counts[str(n)] == 0]
    repeated = [n for n in range(1, 10) if counts[str(n)] >= 2]

    lines = []
    for label, cells in LOSHU_LINES:
        present = sum(1 for c in cells if counts[str(c)] > 0)
        state = "full" if present == 3 else ("absent" if present == 0 else "partial")
        lines.append({"name": label, "cells": cells, "state": state,
                      "meaning": LOSHU_LINE_MEANING[label]})

    return {
        "counts": counts,
        "missing": missing,
        "repeated": repeated,
        "kua": kua,
        "kua_note": None if kua else "Kua omitted (requires male/female).",
        "lines": lines,
        "arrows_strength": [l["name"] for l in lines if l["state"] == "full"],
        "arrows_weakness": [l["name"] for l in lines if l["state"] == "absent"],
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_loshu.py -v`
Expected: PASS (all loshu tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/numerology.py tests/python/test_loshu.py
git commit -m "feat(numerology): add Lo Shu grid compute with planes and arrows"
```

---

## Task 3: Wire grid + gender into `compute_numerology` (Python)

**Files:**
- Modify: `src/lib/pyodide/scripts/numerology.py:132-184`
- Test: `tests/python/test_numerology_synastry.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/python/test_numerology_synastry.py`:

```python
def test_numerology_includes_loshu_grid():
    r = compute_numerology("Sarthak Chhabra", "1996-11-22")
    assert "loshu" in r
    assert set(r["loshu"]["counts"].keys()) == {str(n) for n in range(1, 10)}
    assert r["loshu"]["kua"] is None          # no gender passed


def test_numerology_gender_drives_kua():
    r = compute_numerology("Sarthak Chhabra", "1996-11-22", gender="male")
    assert r["loshu"]["kua"] == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_numerology_synastry.py -k loshu_or_gender -v` (or run the file)
Expected: FAIL — `KeyError: 'loshu'` / `compute_numerology() got an unexpected keyword argument 'gender'`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/pyodide/scripts/numerology.py`, change the signature and add the `loshu` key. Replace the `def compute_numerology(...)` line and the `return {...}` block:

```python
def compute_numerology(full_name, dob, gender=None, name_in_use=None):
    """
    full_name: str (birth certificate name)
    dob: 'YYYY-MM-DD'
    gender: 'male' | 'female' | 'other' | None (drives the Lo Shu Kua number)
    name_in_use: str | None (everyday name, if different from the birth name)
    """
```

(keep the existing body unchanged) and in the returned dict add `"loshu"` before `"name_in_use"`:

```python
        "name_compound": name_compound,
        "loshu": compute_loshu_grid(dob, gender),
        "name_in_use": (_name_numbers(name_in_use) if name_in_use else None),
    }
```

Then update the JSON wrapper at the bottom of the file:

```python
def compute_numerology_json(full_name, dob, gender=None, name_in_use=None):
    return json.dumps(compute_numerology(full_name, dob, gender, name_in_use))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv-test/bin/python -m pytest tests/python/test_numerology_synastry.py -v`
Expected: PASS — existing numerology tests still green (they call `compute_numerology` with positional name/dob and keyword `name_in_use`, both still valid), plus the two new tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/numerology.py tests/python/test_numerology_synastry.py
git commit -m "feat(numerology): surface Lo Shu grid and gender-driven Kua in compute_numerology"
```

---

## Task 4: Numerology match compute (Python)

**Files:**
- Modify: `src/lib/pyodide/scripts/numerology.py`
- Test: `tests/python/test_numerology_match.py` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/python/test_numerology_match.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from numerology import compute_numerology_match


def test_match_structure_and_scores():
    m = compute_numerology_match("Sarthak Chhabra", "1996-11-22", "male",
                                 "Alice Smith", "1990-06-15", "female")
    assert m["between"] == ["Sarthak Chhabra", "Alice Smith"]
    for block in ("core", "driver_conductor", "grid"):
        assert 0 <= m[block]["score"] <= 10
        assert m[block]["rating"] in ("Harmonious", "Mixed", "Challenging")
    assert 0 <= m["indicative_score"] <= 10
    assert m["indicative_label"] == "indicative, non-classical"
    assert m["summary_rating"] in ("Harmonious", "Mixed", "Challenging")


def test_match_core_pairs_use_relations():
    m = compute_numerology_match("Sarthak Chhabra", "1996-11-22", "male",
                                 "Alice Smith", "1990-06-15", "female")
    for key in ("mulank", "bhagyank", "life_path"):
        pair = m["core"]["pairs"][key]
        assert pair["relation"] in ("friend", "neutral", "enemy")


def test_match_is_deterministic():
    args = ("A B", "1996-11-22", "male", "C D", "1990-06-15", "female")
    assert compute_numerology_match(*args) == compute_numerology_match(*args)


def test_match_driver_conductor_is_cross_paired():
    m = compute_numerology_match("A B", "1996-11-22", "male", "C D", "1990-06-15", "female")
    dc = m["driver_conductor"]
    assert set(dc["a_driver_vs_b_conductor"].keys()) == {"a", "b", "relation"}
    assert set(dc["b_driver_vs_a_conductor"].keys()) == {"a", "b", "relation"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_numerology_match.py -v`
Expected: FAIL with `ImportError: cannot import name 'compute_numerology_match'`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/pyodide/scripts/numerology.py`, after `compute_number_compatibility_json` (around line 129), add:

```python
def _num_rating(score10):
    return "Harmonious" if score10 >= 7 else ("Mixed" if score10 >= 4 else "Challenging")


def _rel_points(pa, pb):
    rel = planet_relation(pa, pb) if pa and pb else "neutral"
    return {"friend": 2, "neutral": 1, "enemy": 0}[rel], rel


def _ruler_of(n):
    return PLANET_RULER.get(n if n <= 9 else _reduce(n, keep_master=False))


def compute_numerology_match(name_a, dob_a, gender_a, name_b, dob_b, gender_b):
    """Indicative (non-classical) numerology compatibility between two people, via the
    ruling-planet NAISARGIKA friendship table and Lo Shu grid complementarity."""
    na = compute_numerology(name_a, dob_a, gender_a)
    nb = compute_numerology(name_b, dob_b, gender_b)

    # Core: like-for-like driver / conductor / life-path via ruling planets.
    core_pairs, core_pts = {}, 0
    for key, a_num, b_num in (
        ("mulank",    na["mulank"]["number"],   nb["mulank"]["number"]),
        ("bhagyank",  na["bhagyank"]["number"], nb["bhagyank"]["number"]),
        ("life_path", na["life_path"],          nb["life_path"]),
    ):
        pts, rel = _rel_points(_ruler_of(a_num), _ruler_of(b_num))
        core_pts += pts
        core_pairs[key] = {"a": a_num, "b": b_num, "relation": rel}
    core_score = round(core_pts / 6 * 10)

    # Driver-conductor: CROSS pairing (A driver vs B conductor, and vice-versa).
    a_drv, a_con = na["mulank"]["number"], na["bhagyank"]["number"]
    b_drv, b_con = nb["mulank"]["number"], nb["bhagyank"]["number"]
    p1, r1 = _rel_points(_ruler_of(a_drv), _ruler_of(b_con))
    p2, r2 = _rel_points(_ruler_of(b_drv), _ruler_of(a_con))
    dc_score = round((p1 + p2) / 4 * 10)

    # Grid complementarity: numbers one partner is missing that the other supplies.
    ga, gb = na["loshu"], nb["loshu"]
    a_filled = [n for n in ga["missing"] if n not in gb["missing"]]
    b_filled = [n for n in gb["missing"] if n not in ga["missing"]]
    shared = [n for n in ga["repeated"] if n in gb["repeated"]]
    total_missing = len(ga["missing"]) + len(gb["missing"])
    grid_score = round((len(a_filled) + len(b_filled)) / total_missing * 10) if total_missing else 5

    overall = round((core_score + dc_score + grid_score) / 3)
    return {
        "between": [name_a, name_b],
        "core": {"pairs": core_pairs, "score": core_score, "rating": _num_rating(core_score)},
        "driver_conductor": {
            "a_driver_vs_b_conductor": {"a": a_drv, "b": b_con, "relation": r1},
            "b_driver_vs_a_conductor": {"a": b_drv, "b": a_con, "relation": r2},
            "score": dc_score, "rating": _num_rating(dc_score),
        },
        "grid": {
            "a_missing_filled_by_b": a_filled,
            "b_missing_filled_by_a": b_filled,
            "shared_strengths": shared,
            "score": grid_score, "rating": _num_rating(grid_score),
        },
        "indicative_score": overall,
        "indicative_label": "indicative, non-classical",
        "summary_rating": _num_rating(overall),
    }


def compute_numerology_match_json(name_a, dob_a, gender_a, name_b, dob_b, gender_b):
    return json.dumps(compute_numerology_match(name_a, dob_a, gender_a, name_b, dob_b, gender_b))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_numerology_match.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Run the full Python suite to confirm no regressions**

Run: `.venv-test/bin/python -m pytest tests/python -q`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pyodide/scripts/numerology.py tests/python/test_numerology_match.py
git commit -m "feat(numerology): add indicative numerology match compute"
```

---

## Task 5: Expose match through the Pyodide worker bridge (JS)

**Files:**
- Modify: `src/lib/pyodide/worker.js:21` (PY_FN map) and `:99` (Python import line)
- Modify: `src/lib/pyodide/index.js:76-82`
- Modify: `src/hooks/usePyodide.js:5,71`

- [ ] **Step 1: Add the worker entry point mapping**

In `src/lib/pyodide/worker.js`, in the `PY_FN` object (after the `computeNumberCompatibility` line), add:

```js
  computeNumerologyMatch: 'compute_numerology_match_json',
```

And on the Python import line (currently `from numerology import compute_numerology_json, compute_number_compatibility_json`), extend it to:

```python
from numerology import compute_numerology_json, compute_number_compatibility_json, compute_numerology_match_json
```

- [ ] **Step 2: Add the JS index wrappers**

In `src/lib/pyodide/index.js`, replace the `computeNumerology` wrapper and add `computeNumerologyMatch`:

```js
export async function computeNumerology(fullName, dob, gender = null, nameInUse = null) {
  return compute('computeNumerology', [fullName, dob, gender, nameInUse])
}

export async function computeNumberCompatibility(a, b) {
  return compute('computeNumberCompatibility', [a, b])
}

export async function computeNumerologyMatch(nameA, dobA, genderA, nameB, dobB, genderB) {
  return compute('computeNumerologyMatch', [nameA, dobA, genderA ?? '', nameB, dobB, genderB ?? ''])
}
```

- [ ] **Step 3: Expose it on the Pyodide context**

In `src/hooks/usePyodide.js`, add `computeNumerologyMatch` to the import block (line ~5, alongside `computeNumerology, computeSynastry`) and to the returned object (line ~71, after `computeNumerology,`):

```js
// import block
  computeNumerology, computeNumerologyMatch, computeSynastry,
```
```js
// returned object
    computeNumerology,
    computeNumerologyMatch,
```

- [ ] **Step 4: Verify the build resolves the new exports**

Run: `npm run build`
Expected: build succeeds (no unresolved import errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/worker.js src/lib/pyodide/index.js src/hooks/usePyodide.js
git commit -m "feat(pyodide): bridge computeNumerologyMatch and gender-aware computeNumerology"
```

---

## Task 6: Add the `numerology_match` agent tool + label (JS)

**Files:**
- Modify: `src/lib/llm/tools.js:5` (import), `:317-347` (tools)
- Modify: `src/lib/llm/toolLabels.js:17`
- Test: `tests/lib/llm/toolLabels.test.js` (already asserts every tool has a label — run it)

- [ ] **Step 1: Write/confirm the failing test**

The existing `tests/lib/llm/toolLabels.test.js` asserts every registered tool has a label. Add the tool first (next step) so the test fails, proving the label gate works.

- [ ] **Step 2: Add the import and the tool**

In `src/lib/llm/tools.js`, extend the pyodide import (line 5) to include `computeNumerologyMatch`:

```js
import { computeChart, computeTransit, computeSynastry, computeNumerology, computeNumberCompatibility, computeNumerologyMatch, computeChartFacts, computeVarshaphal } from '../pyodide/index'
```

Update the existing `compute_numerology` tool to accept and pass `gender` (so its output carries `loshu`). Replace its `parameters` and `execute`:

```js
    parameters: {
      type: 'object',
      properties: {
        full_name: { type: 'string', description: 'Full birth name.' },
        dob: { type: 'string', description: 'Date of birth, YYYY-MM-DD.' },
        gender: { type: 'string', description: "'male', 'female', or 'other'. Drives the Lo Shu Kua number (omitted for 'other'/unknown). Optional." },
        name_in_use: { type: 'string', description: 'The name the person actually goes by, if different from the birth name. Optional.' },
      },
      required: ['full_name', 'dob'],
    },
    async execute({ full_name, dob, gender, name_in_use }) {
      return computeNumerology(full_name, dob, gender ?? null, name_in_use ?? null)
    },
```

Then add a new tool object immediately after the `numerology_compatibility` tool (after line 347):

```js
  {
    name: 'numerology_match',
    description: "Indicative (non-classical) numerology compatibility between two people. Compares their driver (mulank), conductor (bhagyank), and life-path numbers by ruling-planet friendship, a cross-paired driver-conductor read, and Lo Shu grid complementarity (which numbers one partner is missing that the other supplies). Returns per-dimension ratings and an indicative score out of 10. This is separate from and never replaces the classical 36-point Guna Milan.",
    parameters: {
      type: 'object',
      properties: {
        full_name_a: { type: 'string', description: 'First person full birth name.' },
        dob_a: { type: 'string', description: 'First person date of birth, YYYY-MM-DD.' },
        gender_a: { type: 'string', description: "First person: 'male', 'female', or 'other'. Optional." },
        full_name_b: { type: 'string', description: 'Second person full birth name.' },
        dob_b: { type: 'string', description: 'Second person date of birth, YYYY-MM-DD.' },
        gender_b: { type: 'string', description: "Second person: 'male', 'female', or 'other'. Optional." },
      },
      required: ['full_name_a', 'dob_a', 'full_name_b', 'dob_b'],
    },
    async execute({ full_name_a, dob_a, gender_a, full_name_b, dob_b, gender_b }) {
      return computeNumerologyMatch(full_name_a, dob_a, gender_a ?? '', full_name_b, dob_b, gender_b ?? '')
    },
  },
```

- [ ] **Step 3: Run the label test to verify it fails**

Run: `npx vitest run tests/lib/llm/toolLabels.test.js`
Expected: FAIL — `missing label for numerology_match`.

- [ ] **Step 4: Add the label**

In `src/lib/llm/toolLabels.js`, after the `numerology_compatibility` line, add:

```js
  numerology_match:   { active: 'Matching the numbers',     past: 'Matched the numbers' },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/lib/llm/toolLabels.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/llm/tools.js src/lib/llm/toolLabels.js
git commit -m "feat(agent): numerology_match tool + gender-aware compute_numerology"
```

---

## Task 7: Surface the grid + match in the agent context (JS)

**Files:**
- Modify: `src/lib/prompts/formatters.js:81-89`
- Test: `tests/lib/prompts/formatters.test.js` (create if absent; otherwise append)

- [ ] **Step 1: Write the failing test**

Create or append to `tests/lib/prompts/formatters.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { formatNumerologyContext, formatNumerologyMatchContext } from '../../../src/lib/prompts/formatters'

const NUM = {
  life_path: 4,
  destiny: { chaldean: 5, pythagorean: 6 },
  soul_urge: { chaldean: 2, pythagorean: 3 },
  personality: { chaldean: 3, pythagorean: 3 },
  personal_year: 8,
  loshu: { counts: { '1': 3, '9': 2 }, missing: [5, 7], repeated: [1, 9], kua: 3, kua_note: null,
           arrows_strength: ['Will (9-5-1)'], arrows_weakness: ['Action (2-7-6)'] },
}

describe('formatNumerologyContext', () => {
  it('includes the Lo Shu grid summary', () => {
    const out = formatNumerologyContext(NUM)
    expect(out).toContain('Lo Shu')
    expect(out).toContain('Missing: 5, 7')
    expect(out).toContain('Will (9-5-1)')
  })
})

describe('formatNumerologyMatchContext', () => {
  it('renders the indicative score and per-dimension ratings', () => {
    const m = { between: ['A', 'B'], indicative_score: 7, indicative_label: 'indicative, non-classical',
      summary_rating: 'Harmonious',
      core: { rating: 'Harmonious', score: 8 }, driver_conductor: { rating: 'Mixed', score: 5 },
      grid: { rating: 'Mixed', score: 6, a_missing_filled_by_b: [5], b_missing_filled_by_a: [2], shared_strengths: [9] } }
    const out = formatNumerologyMatchContext(m)
    expect(out).toContain('indicative, non-classical')
    expect(out).toContain('7/10')
    expect(out).toContain('Harmonious')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/prompts/formatters.test.js`
Expected: FAIL — `formatNumerologyMatchContext is not a function` and missing "Lo Shu" text.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/prompts/formatters.js`, replace `formatNumerologyContext` (lines 81-89) with a version that appends the grid, and add the match formatter:

```js
export function formatNumerologyContext(numerology) {
  const base = `## Computed Numerology Profile (Chaldean primary)

Life Path: ${numerology.life_path}
Destiny: Chaldean ${numerology.destiny.chaldean} / Pythagorean ${numerology.destiny.pythagorean}
Soul Urge: Chaldean ${numerology.soul_urge.chaldean} / Pythagorean ${numerology.soul_urge.pythagorean}
Personality: Chaldean ${numerology.personality.chaldean} / Pythagorean ${numerology.personality.pythagorean}
Personal Year: ${numerology.personal_year}`

  const g = numerology.loshu
  if (!g) return base
  const kua = g.kua != null ? `Kua: ${g.kua}` : (g.kua_note ?? 'Kua: —')
  return `${base}

### Lo Shu Grid
Missing: ${g.missing.join(', ') || 'none'}
Repeated (strong): ${g.repeated.join(', ') || 'none'}
${kua}
Arrows of strength: ${g.arrows_strength.join('; ') || 'none'}
Arrows of weakness: ${g.arrows_weakness.join('; ') || 'none'}`
}

export function formatNumerologyMatchContext(m) {
  const fill = arr => (arr && arr.length ? arr.join(', ') : 'none')
  return `## Numerology Compatibility (${m.indicative_label})
Between ${m.between[0]} and ${m.between[1]}
Indicative score: ${m.indicative_score}/10 — ${m.summary_rating}
Core numbers: ${m.core.rating} (${m.core.score}/10)
Driver-Conductor (cross): ${m.driver_conductor.rating} (${m.driver_conductor.score}/10)
Grid complementarity: ${m.grid.rating} (${m.grid.score}/10) — ${m.between[1]} supplies ${fill(m.grid.a_missing_filled_by_b)}; ${m.between[0]} supplies ${fill(m.grid.b_missing_filled_by_a)}; shared strengths ${fill(m.grid.shared_strengths)}
This is indicative only and does not replace the classical 36-point Guna Milan.`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/prompts/formatters.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompts/formatters.js tests/lib/prompts/formatters.test.js
git commit -m "feat(agent): add Lo Shu grid + numerology-match context formatters"
```

---

## Task 8: Migration — recompute existing profiles with grid + gender (JS)

**Files:**
- Modify: `src/lib/version.js:4`
- Modify: `src/lib/migrateProfile.js:16`
- Modify: `src/components/Sidebar/AddProfileModal.jsx:31`
- Test: `tests/lib/migrateProfile.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/migrateProfile.test.js` (it already imports `recomputeProfile`/`isProfileStale`; mirror its existing mock-compute style):

```js
import { CHART_ENGINE_VERSION } from '../../src/lib/version'

it('passes gender into computeNumerology and stamps the current version', async () => {
  let seenGender = 'NOT_CALLED'
  const compute = {
    computeChart: async () => ({}),
    getYogasAndDoshas: async () => ({ yogas_active: [], doshas: {} }),
    computeNumerology: async (_name, _dob, gender) => { seenGender = gender; return { loshu: {} } },
  }
  const profile = { id: 'p1', name: 'X', dob: '1990-06-15', time: '14:30', lat: 1, lon: 1, gender: 'female', engineVersion: 1 }
  const out = await recomputeProfile(profile, compute)
  expect(seenGender).toBe('female')
  expect(out.engineVersion).toBe(CHART_ENGINE_VERSION)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/migrateProfile.test.js`
Expected: FAIL — `seenGender` is `null` (gender not yet passed).

- [ ] **Step 3: Write minimal implementation**

In `src/lib/version.js`, bump the version so saved profiles re-migrate:

```js
export const CHART_ENGINE_VERSION = 3
```

In `src/lib/migrateProfile.js`, line 16, pass gender:

```js
  const numerology = await compute.computeNumerology(profile.name, profile.dob, profile.gender ?? null, profile.name_in_use ?? null)
```

In `src/components/Sidebar/AddProfileModal.jsx`, line 31, pass gender for new profiles:

```js
      const numerology = await computeNumerology(formData.name, formData.dob, formData.gender ?? null, formData.name_in_use ?? null)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/migrateProfile.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/version.js src/lib/migrateProfile.js src/components/Sidebar/AddProfileModal.jsx tests/lib/migrateProfile.test.js
git commit -m "feat(storage): re-migrate profiles to add Lo Shu grid + gender-driven numerology"
```

---

## Task 9: Lo Shu grid panel in the Numbers tab (JS/React)

**Files:**
- Create: `src/components/Tabs/LoShuGrid.jsx`
- Modify: `src/components/Tabs/NumbersTab.jsx:38-60`
- Test: `tests/components/LoShuGrid.test.jsx` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/components/LoShuGrid.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoShuGrid from '../../src/components/Tabs/LoShuGrid'

const GRID = {
  counts: { '1': 3, '2': 0, '3': 1, '4': 2, '5': 0, '6': 1, '7': 0, '8': 1, '9': 2 },
  missing: [2, 5, 7], repeated: [1, 4, 9], kua: 3, kua_note: null,
  lines: [
    { name: 'Will (9-5-1)', cells: [9, 5, 1], state: 'partial', meaning: 'determination...' },
    { name: 'Mental plane (4-9-2)', cells: [4, 9, 2], state: 'partial', meaning: 'thinking...' },
  ],
  arrows_strength: [], arrows_weakness: ['Action (2-7-6)'],
}

describe('LoShuGrid', () => {
  it('renders counts, missing, repeated and Kua', () => {
    render(<LoShuGrid grid={GRID} />)
    expect(screen.getByText('Lo Shu Grid')).toBeTruthy()
    expect(screen.getByText(/Missing:/)).toHaveTextContent('2, 5, 7')
    expect(screen.getByText(/Repeated/)).toHaveTextContent('1, 4, 9')
    expect(screen.getByText(/Kua:/)).toHaveTextContent('3')
  })

  it('shows the Kua note when Kua is omitted', () => {
    render(<LoShuGrid grid={{ ...GRID, kua: null, kua_note: 'Kua omitted (requires male/female).' }} />)
    expect(screen.getByText(/Kua omitted/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/LoShuGrid.test.jsx`
Expected: FAIL — cannot resolve `LoShuGrid`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/Tabs/LoShuGrid.jsx` (3×3 driven by the magic-square cell order, fully data-driven from `grid.counts`):

```jsx
// src/components/Tabs/LoShuGrid.jsx
// Renders the populated Lo Shu magic square (4-9-2 / 3-5-7 / 8-1-6). Each cell shows its
// digit repeated by how many times it was placed; empty cells render a muted dot.
const SQUARE = [4, 9, 2, 3, 5, 7, 8, 1, 6]

export default function LoShuGrid({ grid }) {
  if (!grid) return null
  const count = n => grid.counts?.[String(n)] ?? 0
  const join = arr => (arr && arr.length ? arr.join(', ') : '—')

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Lo Shu Grid</p>
      <div className="grid grid-cols-3 gap-1 w-40">
        {SQUARE.map(n => {
          const c = count(n)
          return (
            <div key={n} className="aspect-square bg-surface border border-border rounded-lg flex items-center justify-center text-sm font-semibold text-primary">
              {c > 0 ? String(n).repeat(c) : <span className="text-muted">·</span>}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex flex-col gap-0.5 text-xs text-muted">
        <span>Missing: {join(grid.missing)}</span>
        <span>Repeated (strong): {join(grid.repeated)}</span>
        <span>{grid.kua != null ? `Kua: ${grid.kua}` : (grid.kua_note ?? 'Kua: —')}</span>
        <span>Arrows of strength: {join(grid.arrows_strength)}</span>
        <span>Arrows of weakness: {join(grid.arrows_weakness)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire it into the Numbers tab**

In `src/components/Tabs/NumbersTab.jsx`, add the import near the top (after line 10):

```jsx
import LoShuGrid from './LoShuGrid'
```

Then inside the `{numerology && (...)}` panel, after the closing `</div>` of the `grid grid-cols-2` block (line 58) and before that panel's closing `</div>` (line 59), add:

```jsx
            <LoShuGrid grid={numerology.loshu} />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/components/LoShuGrid.test.jsx`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add src/components/Tabs/LoShuGrid.jsx src/components/Tabs/NumbersTab.jsx tests/components/LoShuGrid.test.jsx
git commit -m "feat(ui): Lo Shu grid panel in the Numbers tab"
```

---

## Task 10: Numerology compatibility panel in the Match tab (JS/React)

**Files:**
- Create: `src/components/Tabs/NumerologyMatchPanel.jsx`
- Modify: `src/components/Tabs/MatchTab.jsx` (state, compute call, render, context)
- Test: `tests/components/NumerologyMatchPanel.test.jsx` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/components/NumerologyMatchPanel.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NumerologyMatchPanel from '../../src/components/Tabs/NumerologyMatchPanel'

const MATCH = {
  between: ['Alice', 'Bob'], indicative_score: 7, indicative_label: 'indicative, non-classical',
  summary_rating: 'Harmonious',
  core: { rating: 'Harmonious', score: 8 },
  driver_conductor: { rating: 'Mixed', score: 5 },
  grid: { rating: 'Mixed', score: 6, a_missing_filled_by_b: [5], b_missing_filled_by_a: [2], shared_strengths: [9] },
}

describe('NumerologyMatchPanel', () => {
  it('renders the indicative score badge and dimension ratings', () => {
    render(<NumerologyMatchPanel match={MATCH} />)
    expect(screen.getByText('Numerology Compatibility')).toBeTruthy()
    expect(screen.getByText(/indicative, non-classical/)).toBeTruthy()
    expect(screen.getByText(/7\/10/)).toBeTruthy()
    expect(screen.getByText(/Harmonious/)).toBeTruthy()
  })

  it('renders nothing when no match is provided', () => {
    const { container } = render(<NumerologyMatchPanel match={null} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/NumerologyMatchPanel.test.jsx`
Expected: FAIL — cannot resolve `NumerologyMatchPanel`.

- [ ] **Step 3: Write the panel component**

Create `src/components/Tabs/NumerologyMatchPanel.jsx`:

```jsx
// src/components/Tabs/NumerologyMatchPanel.jsx
// Indicative (non-classical) numerology compatibility — rendered SEPARATELY from Guna Milan
// and never blended into the 36-point score.
const DIMS = [
  ['core', 'Core numbers'],
  ['driver_conductor', 'Driver–Conductor'],
  ['grid', 'Grid complementarity'],
]

export default function NumerologyMatchPanel({ match }) {
  if (!match) return null
  const fill = arr => (arr && arr.length ? arr.join(', ') : '—')
  return (
    <div className="border-t border-border pt-3 flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-text">Numerology Compatibility</span>
        <span className="text-xs text-muted">{match.indicative_score}/10 · {match.summary_rating}</span>
      </div>
      <span className="text-[10px] uppercase tracking-wide text-muted bg-surface border border-border rounded px-1.5 py-0.5 self-start">
        {match.indicative_label}
      </span>
      <div className="grid grid-cols-1 gap-0.5 mt-1">
        {DIMS.map(([key, label]) => (
          <div key={key} className="flex justify-between text-xs text-muted">
            <span>{label}</span>
            <span>{match[key].rating} ({match[key].score}/10)</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted mt-1">
        {match.between[1]} supplies {fill(match.grid.a_missing_filled_by_b)} · {match.between[0]} supplies {fill(match.grid.b_missing_filled_by_a)} · shared strengths {fill(match.grid.shared_strengths)}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run the component test to verify it passes**

Run: `npx vitest run tests/components/NumerologyMatchPanel.test.jsx`
Expected: PASS (2 passed).

- [ ] **Step 5: Wire compute + render into the Match tab**

In `src/components/Tabs/MatchTab.jsx`:

1. Add imports (after the existing `formatSynastryContext` import at line 7):
```jsx
import { formatNumerologyMatchContext } from '../../lib/prompts/formatters'
import NumerologyMatchPanel from './NumerologyMatchPanel'
```

2. Pull `computeNumerologyMatch` from context (line 61, alongside `computeSynastry`):
```jsx
  const { computeSynastry, computeNumerologyMatch } = useContext(PyodideContext)
```

3. Add state next to `synastryData` (line 64):
```jsx
  const [numerologyMatch, setNumerologyMatch] = useState(null)
```

4. In the match handler, right after the `computeSynastry(...)` call (line 98) compute the numerology match from the two profiles and store it:
```jsx
      const numMatch = await computeNumerologyMatch(
        activeProfile.name, activeProfile.dob, activeProfile.gender ?? '',
        partnerProfile.name, partnerProfile.dob, partnerProfile.gender ?? '')
      setNumerologyMatch(numMatch)
```

5. Where the partner dropdown `onChange` resets `setSynastryData(null)` (around line 161), also reset the numerology match so a stale panel never lingers:
```jsx
      onChange={e => { setPartnerProfileId(e.target.value); setSynastryData(null); setNumerologyMatch(null) }}
```

6. Render the panel inside the `{synastryData && (...)}` card, immediately after the marriage-factors block (after line ~250, before the card's closing `</div>`):
```jsx
            <NumerologyMatchPanel match={numerologyMatch} />
```

7. Fold the numerology match into the chat context so the agent sees what the panel shows. In the `handleSend`/`send` call where `extraContext` is built from `formatSynastryContext` (line 130), append the numerology context:
```jsx
        send({ userMessage, extraContext: (synastryData ? formatSynastryContext(synastryData, activeProfile, partnerProfile) : '') + (numerologyMatch ? '\n\n' + formatNumerologyMatchContext(numerologyMatch) : ''), onChunk }))
```

- [ ] **Step 6: Run the full Vitest suite to confirm no regressions**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/Tabs/NumerologyMatchPanel.jsx src/components/Tabs/MatchTab.jsx tests/components/NumerologyMatchPanel.test.jsx
git commit -m "feat(ui): numerology compatibility panel in the Match tab"
```

---

## Task 11: End-to-end coverage (Playwright)

**Files:**
- Modify: `tests/e2e/match.spec.js`
- Modify: `tests/e2e/numbers.spec.js`

- [ ] **Step 1: Add the Match-tab numerology assertions**

In `tests/e2e/match.spec.js`, the two seeded profiles already carry `dob` (`1990-06-15`) but no `gender`, so the Kua is omitted and the numerology panel still renders. After the existing "Compatibility Read" assertions (before the final body-string checks), add:

```js
  // Indicative numerology panel, separate from Guna Milan
  await expect(page.getByText('Numerology Compatibility')).toBeVisible()
  await expect(page.getByText(/indicative, non-classical/i)).toBeVisible()
```

- [ ] **Step 2: Add the Numbers-tab Lo Shu assertion**

Open `tests/e2e/numbers.spec.js` and read its existing flow (it seeds a profile and opens the Numbers tab). After the assertion that the Numerology Profile panel is visible, add:

```js
  await expect(page.getByText('Lo Shu Grid')).toBeVisible({ timeout: 150_000 })
  await expect(page.getByText(/Missing:/)).toBeVisible()
```

If `tests/e2e/numbers.spec.js` seeds a profile with a precomputed `numerology: {}` (no `loshu`), the lazy migration (Task 8, version bump to 3) recomputes it on load so the grid appears. Confirm the seeded profile includes `dob`, `time`, `lat`, `lon` so `recomputeProfile` can run; if it does not, add them to the seed mirroring `tests/e2e/match.spec.js`'s `base` object.

- [ ] **Step 3: Run the e2e tests**

Run: `npx playwright test tests/e2e/match.spec.js tests/e2e/numbers.spec.js`
Expected: PASS (both specs green; first run loads Pyodide, allow the existing 180s timeout).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/match.spec.js tests/e2e/numbers.spec.js
git commit -m "test(e2e): cover Lo Shu grid and numerology match panels"
```

---

## Task 12: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Python suite**

Run: `.venv-test/bin/python -m pytest tests/python -q`
Expected: all pass.

- [ ] **Step 2: JS unit suite**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: E2E suite**

Run: `npx playwright test`
Expected: all pass.

- [ ] **Step 6: Final confirmation**

Confirm both ends are wired (CLAUDE.md sync rule): the Numbers tab shows the Lo Shu grid AND the agent's numerology context includes it; the Match tab shows the numerology panel AND the agent has the `numerology_match` tool plus the match context. No commit needed if all green.

---

## Notes for the implementer

- **Do not blend** the numerology indicative score into Guna Milan anywhere. They are separate panels and separate context blocks.
- **JSON key types:** `loshu.counts` keys are strings (`"1"`..`"9"`) because Python `json.dumps` stringifies dict keys. The JSX reads them as `counts[String(n)]`; do not assume numeric keys.
- **Signature order matters:** `compute_numerology(full_name, dob, gender=None, name_in_use=None)` — gender is the 3rd positional arg. Every JS caller (`pyodide/index.js`, `tools.js`, `migrateProfile.js`, `AddProfileModal.jsx`) must pass it in that position. Task 5 and Task 8 cover all four callers.
- **No new Python script file** is added, so `worker.js`'s `scripts` array and `vite.config.js`'s `PY_SCRIPTS` need no changes — only the `PY_FN` map and the Python import line in `worker.js`.
```
