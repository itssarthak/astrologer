# P1 Completion Plan — Doshas→8, Numerology Expansion, Reading Procedure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish P1 parity — expand doshas from 5 to 8, expand numerology (driver number, planet rulers, name-in-use, compound/Cheiro, pair compatibility), and add the reading-procedure interpretation layer that orchestrates the now-enriched data.

**Architecture:** Three independent parts in disjoint files. Part A edits `doshas.py` (+ tests). Part B edits `numerology.py`, its JS wrapper/worker, and the `compute_numerology` tool (+ tests). Part C edits `soul.md` (interpretation methodology, tool-agnostic — shared by tool and no-tool paths) and `useAgent.js`'s `TOOL_GUIDANCE` (tool-selection for the agent path only). Implement Part A, then B, then C (they touch different files; sequencing avoids any shared-file races and keeps reviews focused).

**Tech Stack:** Pure Python in the Pyodide worker; pytest (`.venv-test/bin/python -m pytest`); JS via `npx vitest run`; `npm run lint` (0 errors / 9 baseline warnings); `npm run build`. Reference fixtures `sarthak_chart`/`tanya_chart` in `tests/python/conftest.py`.

**Design decisions (locked):**
- 3 new doshas = **Kalathra** (natural malefic in the 7th house), **Shrapit** (Saturn conjunct Rahu), **Shakata** (Moon in 6/8/12 from Jupiter, cancelled if Jupiter is in a kendra). Ghata was dropped: its Ghata-Chakra rashi→nakshatra table varies across sources and would risk hallucinated output, contrary to soul.md's hard rule.
- Manglik gains two classically-grounded refinements that only *reduce* false positives or *annotate*: a "Jupiter aspects Mars" cancellation (data-safe — uses pre-computed aspects when present) and a `severity` field (full for houses 1/4/7/8, partial for 2/12).
- Numerology reference tables (Cheiro compound meanings 10–52; Naisargika planetary friendship) are included verbatim in this plan so the implementer copies them, never invents them.

---

## Part A — Doshas → 8

**Files:** Modify `src/lib/pyodide/scripts/doshas.py`; Test `tests/python/test_doshas_logic.py`.

### Task A1: Capture aspects in the planet map (enables Manglik Jupiter-aspect cancellation)

- [ ] **Step 1: Implement** — in `compute_doshas`, change the planet-capture loop to also record received aspects (safe when absent — hand-built test charts have no `aspects` key):

```python
    planets = {}
    for h in chart_json["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            planets[occ["celestialBody"]] = {
                "house": h["number"],
                "sign": occ["sign"],
                "nakshatra": occ.get("nakshatra", ""),
                "aspects_receives": list((occ.get("aspects") or {}).get("receives", []) or []),
            }
```

- [ ] **Step 2: Run the existing dosha suite to confirm no regression**

Run: `.venv-test/bin/python -m pytest tests/python/test_doshas_logic.py tests/python/test_yogas_doshas.py -v`
Expected: all PASS (the new field is additive).

### Task A2: Manglik refinements (Jupiter-aspect cancellation + severity)

- [ ] **Step 1: Write failing tests** — add to `tests/python/test_doshas_logic.py`:

```python
def test_manglik_cancelled_when_jupiter_aspects_mars():
    c = chart({"Mars": 7}, signs={"Mars": "Gemini"})
    # inject a received aspect from Jupiter onto Mars (occupant in H7)
    for house in c["d1Chart"]["houses"]:
        for occ in house["occupants"]:
            if occ["celestialBody"] == "Mars":
                occ["aspects"] = {"receives": [{"from_planet": "Jupiter", "aspect_type": "7"}]}
    d = compute_doshas(c)
    assert d["manglik"]["present"] is False
    assert d["manglik"]["cancelled"] is True
    assert "Jupiter aspects Mars" in d["manglik"]["cancellation_reasons"]


def test_manglik_severity_full_in_house_7():
    d = compute_doshas(chart({"Mars": 7}, signs={"Mars": "Gemini"}))
    assert d["manglik"]["present"] is True
    assert d["manglik"]["severity"] == "full"


def test_manglik_severity_partial_in_house_12():
    d = compute_doshas(chart({"Mars": 12}, signs={"Mars": "Gemini"}))
    assert d["manglik"]["severity"] == "partial"
```

- [ ] **Step 2: Run, confirm FAIL**

Run: `.venv-test/bin/python -m pytest tests/python/test_doshas_logic.py -k manglik -v`
Expected: FAIL (no `severity`; Jupiter aspect not yet a cancellation).

- [ ] **Step 3: Implement** — inside the `if mars:` block, after the node-conjunction loop and before `cancelled = bool(cancellations)`, add:

```python
        # Jupiter aspecting Mars neutralises the dosha (benefic guard by aspect).
        if any(a.get("from_planet") == "Jupiter" for a in mars.get("aspects_receives", [])):
            cancellations.append("Jupiter aspects Mars")
```

Then, after `cancelled = bool(cancellations)`, compute severity and add it to the `doshas["manglik"]` dict:

```python
        severity = ("full" if mars["house"] in {1, 4, 7, 8}
                    else "partial" if mars["house"] in {2, 12} else None)
```

Add `"severity": severity,` as a key in the existing `doshas["manglik"] = { ... }` literal.

- [ ] **Step 4: Run, confirm PASS** — `.venv-test/bin/python -m pytest tests/python/test_doshas_logic.py -k manglik -v`

### Task A3: Three new doshas (Kalathra, Shrapit, Shakata)

- [ ] **Step 1: Write failing tests** — add to `tests/python/test_doshas_logic.py`:

```python
def test_kalathra_present_when_malefic_in_7th():
    d = compute_doshas(chart({"Saturn": 7}))
    assert d["kalathra"]["present"] is True
    assert "Saturn" in d["kalathra"]["afflictors"]


def test_kalathra_absent_when_no_malefic_in_7th():
    d = compute_doshas(chart({"Saturn": 3, "Mars": 10}))
    assert d["kalathra"]["present"] is False


def test_shrapit_present_when_saturn_conjunct_rahu():
    d = compute_doshas(chart({"Saturn": 8, "Rahu": 8, "Ketu": 2}))
    assert d["shrapit"]["present"] is True


def test_shrapit_absent_when_saturn_not_with_rahu():
    d = compute_doshas(chart({"Saturn": 3, "Rahu": 8, "Ketu": 2}))
    assert d["shrapit"]["present"] is False


def test_shakata_present_moon_6_8_12_from_jupiter():
    # Jupiter H1, Moon H6 -> 6th from Jupiter; Jupiter NOT in a kendra-from-lagna? H1 IS a kendra,
    # so this would cancel. Put Jupiter in H3 (non-kendra), Moon in H8 -> 6th from Jupiter.
    d = compute_doshas(chart({"Jupiter": 3, "Moon": 8}))
    assert d["shakata"]["present"] is True


def test_shakata_cancelled_when_jupiter_in_kendra():
    # Jupiter H1 (kendra), Moon H6 -> 6th from Jupiter, but cancelled.
    d = compute_doshas(chart({"Jupiter": 1, "Moon": 6}))
    assert d["shakata"]["present"] is False
    assert d["shakata"]["cancelled"] is True
```

- [ ] **Step 2: Run, confirm FAIL** — `.venv-test/bin/python -m pytest tests/python/test_doshas_logic.py -k "kalathra or shrapit or shakata" -v`

- [ ] **Step 3: Implement** — in `compute_doshas`, after the Ganda Moola block and before `return doshas`, add the three doshas. `jup`, `moon`, `rahu`, `sun` are already assigned earlier in the function; reuse them. Add `sat = planets.get("Saturn")`:

```python
    # --- Kalathra Dosha: a natural malefic occupies the 7th house (marriage) ---
    MALEFICS = ("Mars", "Saturn", "Sun", "Rahu", "Ketu")
    afflictors = [p for p in MALEFICS if planets.get(p) and planets[p]["house"] == 7]
    present = bool(afflictors)
    doshas["kalathra"] = {
        "present": present,
        "afflictors": afflictors,
        "text": (f"Kalathra Dosha — {', '.join(afflictors)} stress the marriage area"
                 if present else "No Kalathra Dosha"),
    }

    # --- Shrapit Dosha: Saturn conjunct Rahu ---
    sat = planets.get("Saturn")
    if sat and rahu:
        present = sat["house"] == rahu["house"]
        harsh = present and sat["house"] in {6, 8, 12}
        doshas["shrapit"] = {
            "present": present,
            "text": (("Shrapit Dosha — Saturn conjunct Rahu"
                      + (" in a difficult house" if harsh else ""))
                     if present else "No Shrapit Dosha"),
        }

    # --- Shakata Dosha: Moon in the 6th/8th/12th from Jupiter (cancelled if Jupiter is in a kendra) ---
    if jup and moon:
        dist = ((moon["house"] - jup["house"]) % 12) + 1
        present = dist in {6, 8, 12}
        cancelled = present and jup["house"] in {1, 4, 7, 10}
        doshas["shakata"] = {
            "present": present and not cancelled,
            "cancelled": cancelled,
            "text": ("Shakata Dosha — fluctuating fortunes, effort that doesn't always stick"
                     if (present and not cancelled)
                     else "Shakata Dosha present but cancelled (Jupiter well-placed)" if present
                     else "No Shakata Dosha"),
        }
```

- [ ] **Step 4: Run the full dosha + integration suite** — `.venv-test/bin/python -m pytest tests/python/test_doshas_logic.py tests/python/test_yogas_doshas.py -v` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/doshas.py tests/python/test_doshas_logic.py
git commit -m "feat: expand doshas to 8 (Kalathra, Shrapit, Shakata) + Manglik refinements

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> Note: doshas are computed at chart-save time, so existing saved profiles surface the new doshas only after a recompute; new charts get them immediately. This matches the existing P0 behaviour and needs no migration.

---

## Part B — Numerology Expansion

**Files:** Modify `src/lib/pyodide/scripts/numerology.py`, `src/lib/pyodide/index.js`, `src/lib/llm/tools.js`; Test `tests/python/test_numerology_synastry.py`.

### Task B1: Driver number, planet rulers, bhagyank alias, name-in-use

- [ ] **Step 1: Write failing tests** — add to `tests/python/test_numerology_synastry.py`:

```python
def test_numerology_mulank_and_rulers():
    r = compute_numerology("Sarthak Chhabra", "1996-11-22")
    assert r["mulank"]["number"] == 4          # 22 -> 2+2 = 4
    assert r["mulank"]["ruler"] == "Rahu"      # 4 is ruled by Rahu
    assert r["bhagyank"]["number"] == r["life_path"]
    assert r["bhagyank"]["ruler"] in ("Sun","Moon","Jupiter","Rahu","Mercury","Venus","Ketu","Saturn","Mars")


def test_numerology_name_in_use_present_when_passed():
    r = compute_numerology("Sarthak Chhabra", "1996-11-22", name_in_use="Sarthak")
    assert "name_in_use" in r
    assert "chaldean" in r["name_in_use"]["destiny"]


def test_numerology_name_in_use_absent_when_not_passed():
    r = compute_numerology("Sarthak Chhabra", "1996-11-22")
    assert r.get("name_in_use") is None
```

- [ ] **Step 2: Run, confirm FAIL** — `.venv-test/bin/python -m pytest tests/python/test_numerology_synastry.py -k "mulank or name_in_use" -v`

- [ ] **Step 3: Implement** — in `numerology.py`, add the ruler map near the top constants:

```python
# Chaldean number -> ruling planet.
PLANET_RULER = {1: "Sun", 2: "Moon", 3: "Jupiter", 4: "Rahu",
                5: "Mercury", 6: "Venus", 7: "Ketu", 8: "Saturn", 9: "Mars"}


def _with_ruler(n):
    """A single-digit (1-9) number annotated with its ruling planet."""
    return {"number": n, "ruler": PLANET_RULER.get(n)}
```

Change the signature and add the new fields:

```python
def compute_numerology(full_name, dob, name_in_use=None):
    ...
    # Life Path / Bhagyank (Destiny number): reduce all digits in DOB.
    dob_digits = [int(d) for d in dob if d.isdigit()]
    life_path = _reduce(sum(dob_digits))

    # Mulank (Driver / Psychic number): the day of birth reduced to 1-9 (no master numbers).
    parts = dob.split('-')
    mulank = _reduce(int(parts[2]), keep_master=False)
    ...
```

Add to the returned dict:

```python
        "mulank": _with_ruler(mulank),
        "bhagyank": _with_ruler(life_path if life_path <= 9 else _reduce(life_path, keep_master=False)),
        "name_in_use": (_name_numbers(name_in_use) if name_in_use else None),
```

(Keep the existing `"life_path"`, `"destiny"`, `"soul_urge"`, `"personality"`, `"personal_year"` keys unchanged — `bhagyank` is an annotated alias of the life path, reduced to 1-9 for its ruler.)

Add a helper that factors the existing destiny/soul_urge/personality computation so it can be reused for the in-use name:

```python
def _name_numbers(name):
    """Destiny/soul-urge/personality for one name, both systems."""
    return {
        "destiny": {"chaldean": _reduce(_name_sum(name, CHALDEAN)),
                    "pythagorean": _reduce(_name_sum(name, PYTHAGOREAN))},
        "soul_urge": {"chaldean": _reduce(_name_sum(name, CHALDEAN, VOWELS)),
                      "pythagorean": _reduce(_name_sum(name, PYTHAGOREAN, VOWELS))},
        "personality": {"chaldean": _reduce(_name_sum(name, CHALDEAN, CONSONANTS)),
                        "pythagorean": _reduce(_name_sum(name, PYTHAGOREAN, CONSONANTS))},
    }
```

Refactor the existing `destiny`/`soul_urge`/`personality` block in `compute_numerology` to use `_name_numbers(full_name)` (spread its keys into the result) so the logic is DRY — the top-level keys `destiny`/`soul_urge`/`personality` must keep their existing shape and values.

- [ ] **Step 4: Run, confirm PASS** — `.venv-test/bin/python -m pytest tests/python/test_numerology_synastry.py -k "mulank or name_in_use or has_all_keys or destiny" -v`

### Task B2: Compound number + Cheiro meaning

- [ ] **Step 1: Write failing tests** — add to `tests/python/test_numerology_synastry.py`:

```python
def test_numerology_compound_number_structure():
    r = compute_numerology("Sarthak Chhabra", "1996-11-22")
    cn = r["name_compound"]
    assert "raw" in cn and "compound" in cn and "single" in cn
    assert cn["single"] == r["destiny"]["chaldean"]
    # compound is the 2-digit predecessor of the single (or the raw if already single)
    assert isinstance(cn["compound"], int)


def test_cheiro_meaning_lookup_for_known_compound():
    from numerology import CHEIRO_COMPOUND, _compound_and_single
    compound, single = _compound_and_single(23)
    assert compound == 23 and single == 5
    assert CHEIRO_COMPOUND[23].startswith("Royal Star of the Lion")
```

- [ ] **Step 2: Run, confirm FAIL** — `.venv-test/bin/python -m pytest tests/python/test_numerology_synastry.py -k "compound or cheiro" -v`

- [ ] **Step 3: Implement** — add to `numerology.py`. First the reducer that exposes the compound:

```python
def _compound_and_single(total):
    """Return (compound, single): `single` is the fully reduced 1-9 (or master) value;
    `compound` is the last >9 value in the reduction chain (Cheiro's compound number),
    or `total` itself when total is already a single digit."""
    n = total
    prev = total
    while n > 9 and n not in MASTER:
        prev = n
        n = sum(int(d) for d in str(n))
    return (prev if total > 9 else total), n
```

Then the Cheiro compound-meaning table (copy VERBATIM — these are Cheiro's published meanings; do not paraphrase or invent missing rows):

```python
# Cheiro's compound-number meanings (10-52). Numbers above 52 reduce back into this range.
CHEIRO_COMPOUND = {
    10: "The Wheel of Fortune — honour, faith and self-confidence; rise and fall by one's own plans.",
    11: "A warning of hidden dangers, trials and treachery from others; needs caution.",
    12: "The sacrifice — the victim; warns of being deceived by others; suffering through plans.",
    13: "Upheaval and change; warns of the unknown; power that must be used well or brings destruction.",
    14: "Movement, travel and dealings with the public; risk from speculation and natural forces.",
    15: "Magic and personal magnetism; favours getting money and gifts; can be used for good or low ends.",
    16: "The shattered tower; warns of accidents and defeat of plans; must guard against them.",
    17: "The Star of the Magi — spiritual rising above trials; immortality of name; highly fortunate.",
    18: "Materialism striving to destroy the spiritual; bitter quarrels, treachery and deception.",
    19: "The Prince of Heaven — success, honour and happiness; one of the most fortunate numbers.",
    20: "The Awakening — a call to action for a great purpose; judgement; delays but ultimate success.",
    21: "The Crown — advancement, honour and elevation in life; victory after a long struggle.",
    22: "Caution and illusion; a good person living in a fool's paradise; warns to beware of false judgement.",
    23: "Royal Star of the Lion — success, help from superiors and protection; very fortunate.",
    24: "Gain through love and the help of those of rank; fortunate in money and partnerships.",
    25: "Strength gained through experience and hard lessons; success in the latter part of life.",
    26: "Grave warnings of disaster through bad partnerships and speculation; loss through others.",
    27: "The Sceptre — authority, command and reward from creative intellect; act on your own judgement.",
    28: "Promise of great success that is not lasting; contradictions; loss through trust and lawsuits.",
    29: "Uncertainties, treachery and deception by others; grief and betrayal; trials and unexpected dangers.",
    30: "Thoughtful deduction and mental superiority over others; neither fortunate nor unfortunate — by choice.",
    31: "Like 30 — self-contained, lonely and isolated from one's fellows; not fortunate materially.",
    32: "Magic power like 14 and 23; fortunate if one holds to one's own judgement against the crowd.",
    33: "Same as 24 — gain through love and influential help; fortunate in partnerships.",
    34: "Same as 25 — strength through experience.",
    35: "Same as 26 — warnings through partnerships and speculation.",
    36: "Same as 27 — authority and reward through intellect.",
    37: "Good and fortunate friendships and partnerships, especially in love and the opposite sex.",
    38: "Same as 29 — uncertainties and treachery from others.",
    39: "Same as 30 — mental superiority by choice.",
    40: "Same as 31 — isolation and detachment.",
    41: "Same as 32 — magic power held by independent judgement.",
    42: "Same as 24 and 33 — gain through love and influence.",
    43: "An unfortunate number of revolution, upheaval and strife; warns of failure of ambitions.",
    44: "Same as 26 — warnings through partnerships and speculation.",
    45: "Same as 27 — authority and reward through intellect.",
    46: "Same as 37 — fortunate friendships and partnerships.",
    47: "Same as 29 — uncertainties and treachery.",
    48: "Same as 30 — mental superiority by choice.",
    49: "Same as 31 — isolation.",
    50: "Same as 32 — magic power by independent judgement.",
    51: "The Warrior — sudden advancement and power; great for those in military or leadership; danger to foes.",
    52: "Same as 43 — revolution and strife.",
}
```

In `compute_numerology`, compute the compound off the Chaldean full-name total and add it to the result:

```python
    name_total = _name_sum(full_name, CHALDEAN)
    _compound, _single = _compound_and_single(name_total)
    name_compound = {
        "raw": name_total,
        "compound": _compound,
        "single": _single,
        "meaning": CHEIRO_COMPOUND.get(_compound),
    }
```

Add `"name_compound": name_compound,` to the returned dict. (`_single` will equal `destiny["chaldean"]` since both reduce the same total — the test asserts this.)

- [ ] **Step 4: Run, confirm PASS** — `.venv-test/bin/python -m pytest tests/python/test_numerology_synastry.py -k "compound or cheiro" -v`

### Task B3: Pair compatibility via Naisargika (natural) planetary friendship

- [ ] **Step 1: Write failing tests** — add to `tests/python/test_numerology_synastry.py`:

```python
def test_number_compatibility_friends_and_enemies():
    from numerology import compute_number_compatibility
    # 1 (Sun) and 3 (Jupiter) are natural friends.
    r = compute_number_compatibility(1, 3)
    assert r["relation"] == "friend"
    # 1 (Sun) and 8 (Saturn) are natural enemies.
    assert compute_number_compatibility(1, 8)["relation"] == "enemy"
    # symmetric in label severity: enemy/friend determined per the matrix both ways
    assert compute_number_compatibility(3, 1)["relation"] == "friend"


def test_number_compatibility_json_roundtrips():
    import json as _json
    from numerology import compute_number_compatibility_json
    parsed = _json.loads(compute_number_compatibility_json(2, 6))
    assert parsed["a"] == 2 and parsed["b"] == 6
    assert parsed["relation"] in ("friend", "neutral", "enemy")
```

- [ ] **Step 2: Run, confirm FAIL** — `.venv-test/bin/python -m pytest tests/python/test_numerology_synastry.py -k "compatibility" -v`

- [ ] **Step 3: Implement** — add to `numerology.py` the canonical Naisargika (natural) planetary-relationship matrix (BPHS — fixed reference; copy verbatim). Rahu is treated like Saturn and Ketu like Mars per common convention (documented):

```python
# Naisargika (natural) planetary friendships (BPHS). 'friend'/'enemy'/'neutral' only.
# Rahu follows Saturn's set and Ketu follows Mars's set (standard convention).
_NAISARGIKA = {
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


def _planet_relation(p_a, p_b):
    """friend | enemy | neutral between two planets (max severity of the two directions:
    enemy dominates, then friend, else neutral)."""
    a = _NAISARGIKA.get(p_a, {})
    b = _NAISARGIKA.get(p_b, {})
    if p_b in a.get("enemy", set()) or p_a in b.get("enemy", set()):
        return "enemy"
    if p_b in a.get("friend", set()) or p_a in b.get("friend", set()):
        return "friend"
    return "neutral"


def compute_number_compatibility(a, b):
    """Compatibility between two numerology numbers (1-9) via their ruling planets."""
    pa, pb = PLANET_RULER.get(a), PLANET_RULER.get(b)
    relation = _planet_relation(pa, pb) if pa and pb else "neutral"
    return {"a": a, "b": b, "rulers": [pa, pb], "relation": relation}


def compute_number_compatibility_json(a, b):
    return json.dumps(compute_number_compatibility(int(a), int(b)))
```

- [ ] **Step 4: Run, confirm PASS** — `.venv-test/bin/python -m pytest tests/python/test_numerology_synastry.py -k "compatibility" -v`

### Task B4: Wire name-in-use through the JS tool surface

- [ ] **Step 1: Update the JS wrapper** — `src/lib/pyodide/index.js`, change `computeNumerology`:

```javascript
export async function computeNumerology(fullName, dob, nameInUse = null) {
  return compute('computeNumerology', [fullName, dob, nameInUse])
}
```

- [ ] **Step 2: Update the tool** — `src/lib/llm/tools.js`, the `compute_numerology` tool: add an optional `name_in_use` parameter and pass it through:

```javascript
    parameters: {
      type: 'object',
      properties: {
        full_name: { type: 'string', description: 'Full birth name.' },
        dob: { type: 'string', description: 'Date of birth, YYYY-MM-DD.' },
        name_in_use: { type: 'string', description: 'The name the person actually goes by, if different from the birth name. Optional.' },
      },
      required: ['full_name', 'dob'],
    },
    async execute({ full_name, dob, name_in_use }) {
      return computeNumerology(full_name, dob, name_in_use ?? null)
    },
```

Also update the tool `description` to mention it now returns the driver (mulank) and destiny (bhagyank) numbers with their ruling planets, the compound name number with its Cheiro meaning, and supports an optional everyday name.

- [ ] **Step 3: Verify the Python entry point accepts 3 args** — `compute_numerology_json` currently is `def compute_numerology_json(full_name, dob)`. Update it to:

```python
def compute_numerology_json(full_name, dob, name_in_use=None):
    return json.dumps(compute_numerology(full_name, dob, name_in_use))
```

(The worker calls `pyodide.globals.get(pyFn)(...args)` with the JS args array, so the 3rd arg flows through. Passing `null` from JS arrives as Python `None`.)

- [ ] **Step 4: Run JS + Python suites**

Run: `.venv-test/bin/python -m pytest tests/python/test_numerology_synastry.py -v` → all PASS.
Run: `npx vitest run` → all PASS (no numerology JS unit tests exist, but confirm nothing regressed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/numerology.py src/lib/pyodide/index.js src/lib/llm/tools.js tests/python/test_numerology_synastry.py
git commit -m "feat: expand numerology (mulank, planet rulers, name-in-use, compound/Cheiro, compatibility)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Part C — Reading-Procedure Layer

**Files:** Modify `src/assets/soul.md` (interpretation methodology — tool-agnostic, shared by all tabs) and `src/hooks/useAgent.js` (`TOOL_GUIDANCE` — tool-selection for the agent/Chat tab only).

### Task C1: Interpretation methodology in soul.md

- [ ] **Step 1: Add a methodology section** — append a new `## How to read a chart` section to `src/assets/soul.md` (after the `## Behaviour` section, before `## Hard rules`). It must stay tool-agnostic (the Today/Chart/Numbers/Match tabs receive data pre-computed; the Chat tab fetches via tools) and obey the existing no-jargon Tone rules. Use exactly this content:

```markdown
## How to read a chart
Work from a clear priority order, then synthesise — never dump placements.
1. **Foundation:** the ascendant and its ruling planet's condition (strength, dignity, where it sits) — this sets the life's overall tone.
2. **Mind & emotions:** the Moon's condition and what supports or pressures it.
3. **Timing:** the current running period chain (the dasha sequence supplied/fetched). Read the active periods' planets *as conditioned by the chart* — a strong period-lord delivers its good results, a weak or afflicted one struggles. Tie predictions to this, with absolute dates.
4. **The question's house:** for a specific topic, weigh that life-area's ruling planet and its natural significator — career (10th), marriage (7th), money (2nd/11th), etc.
5. **Modifiers:** strong yogas amplify themes; an *active* dosha qualifies them. Mention a yoga or dosha only when it is present in the computed data, and translate it into a plain-language life effect plus one practical thing to do — never name it.
6. **Confirm with the divisional chart** when the topic has one (marriage → Navamsa, career → Dasamsa): use it to confirm or temper the main reading, not as a separate report.

Then **synthesise into 2–4 themes**, strongest first. Weigh by strength and dignity: lead with what is strong and well-placed; flag what is weak honestly. When chart factors genuinely conflict, say so plainly rather than forcing a verdict. For numerology questions, lead with the driver and destiny numbers and their meaning; use the compound/Cheiro reading only as supporting colour.
```

- [ ] **Step 2: Verify the build still inlines soul.md** — `npm run build` succeeds (soul.md is imported `?raw`).

- [ ] **Step 3: Sanity-check the placeholder fill still works** — run the existing JS suite: `npx vitest run`. (If a prompt-building test exists it must still pass; the new section contains no `{{...}}` tokens.)

### Task C2: Tool-selection guidance for the agent

- [ ] **Step 1: Extend `TOOL_GUIDANCE`** in `src/hooks/useAgent.js` — add a short "running a reading" note after the bullet list, before the closing backtick:

```javascript
For a full reading, call get_chart first (placements with strength, the running dasha chain,
active yogas and doshas), then get_divisional for the relevant varga on marriage (d9) or career
(d10) questions. Use compute_numerology when the question is about name/number or you want a
numerology cross-read. Don't call tools you don't need; one get_chart usually grounds a reading.
```

- [ ] **Step 2: Run the JS suite + build** — `npx vitest run` → PASS; `npm run build` → success.

- [ ] **Step 3: Commit**

```bash
git add src/assets/soul.md src/hooks/useAgent.js
git commit -m "feat: add reading-procedure layer (interpretation methodology + tool-selection guidance)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Part D — Final Integration Verification

- [ ] **Step 1:** Full Python suite — `.venv-test/bin/python -m pytest tests/python -v` → all PASS.
- [ ] **Step 2:** JS suite — `npx vitest run` → all PASS.
- [ ] **Step 3:** Lint — `npm run lint` → 0 errors, ≤9 warnings.
- [ ] **Step 4:** Build — `npm run build` → success.
- [ ] **Step 5:** Quick manual sanity (optional) — in a Python REPL, `compute_doshas` on `sarthak_chart` returns the 3 new keys; `compute_numerology("Sarthak Chhabra","1996-11-22","Sarthak")` returns `mulank`, `bhagyank`, `name_compound`, `name_in_use`.

---

## Self-Review

**Spec coverage:** Doshas→8 (Part A: Kalathra/Shrapit/Shakata + Manglik refinements). Numerology expansion (Part B: mulank/driver + planet rulers B1; compound + Cheiro B2; pair compatibility B3; name-in-use wired through JS B4). Reading procedure (Part C: methodology in soul.md C1; tool-selection in useAgent C2). All P1 backlog items covered.

**Placeholder scan:** All code and reference tables are inline and complete. The Cheiro table (10–52) and the Naisargika matrix are given verbatim so the implementer copies, never invents — directly serving the never-hallucinate rule.

**Type consistency:** `compute_numerology(full_name, dob, name_in_use=None)` matches the JS wrapper `computeNumerology(fullName, dob, nameInUse=null)` and `compute_numerology_json(full_name, dob, name_in_use=None)`. `_name_numbers(name)`, `_with_ruler(n)`, `_compound_and_single(total)`, `compute_number_compatibility(a, b)`, `_planet_relation(p_a, p_b)` signatures are consistent between definition and call sites. Returned keys: existing (`life_path`, `destiny`, `soul_urge`, `personality`, `personal_year`) preserved; new (`mulank`, `bhagyank`, `name_in_use`, `name_compound`). Dosha keys added: `kalathra`, `shrapit`, `shakata`; `manglik` gains `severity` and may gain a `"Jupiter aspects Mars"` cancellation reason.

**Scope notes:** Ghata deliberately replaced by Shakata (sourcing ambiguity). Number compatibility derives from the fixed BPHS natural-friendship matrix rather than a source-variable numerology table. These choices favour correctness over checklist literalism and are flagged to the user.
