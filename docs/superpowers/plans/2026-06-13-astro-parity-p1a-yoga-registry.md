# AskMyAstro Parity — P1a: Yoga Rule Registry (foundation + Mahapurusha/Chandra/Surya batch) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `yogas.py` from a flat list of crude checks into a clean-room **rule registry** that consumes the P0 `adapter` facts (dignity, shadbala strength, graha-drishti aspects, conjuncts), attaches a plain-English `description` to every yoga, and refines/extends the Mahapurusha, Chandra, and Surya yoga families. Surface the descriptions through `get_chart`.

**Architecture:** A `_context(chart_json)` builder (via `adapter`) produces `{planets, lords, lagna_idx}`. Each yoga is a registry entry `{id, name, category, description, detect(ctx)→bool}`. `compute_yogas` runs every rule and returns active ones as `{name, category, description}` — a superset of today's `{name, category}` (back-compatible). Rules are pure functions of `ctx`, unit-tested with hand-built synthetic contexts (deterministic), plus an integration smoke test on the real fixture charts.

**Tech Stack:** Python (Pyodide worker, `jyotishganit` 0.1.3), pytest (`.venv-test`), JS (Vite/Vitest). No backend. Clean-room: PyJHora (AGPL) may be consulted at `/tmp/pyjhora_probe/pyjhora-4.8.7/src/jhora/horoscope/chart/yoga.py` for rule *definitions* only — do NOT copy code.

**Spec:** `docs/superpowers/specs/2026-06-13-askmyastro-parity-design.md` (§6 yoga strategy, §4.2 knowledge layer). Builds on P0 (`adapter.py`, `dignity.py` already merged to main).

**Conventions (verified):**
- `adapter.planet_facts(chart_json)` returns `{Planet: {sign, sign_idx, house, sign_degrees, nakshatra, pada, retrograde, dignity, rupas, min_required, meets, is_strong, conjuncts, aspects_gives, aspects_receives}}`. `adapter.house_lords(chart_json)` returns `{1..12: planet}`. `adapter.lagna_sign(chart_json)` returns the sign; `adapter.SIGN_IDX[sign]` gives 0–11.
- `aspects_gives` items are `{"to_planet": "X", "aspect_type": "7"}` or `{"to_house": N, "aspect_type": "3"}`. `conjuncts` is a list of planet names sharing the planet's house.
- Existing `tests/python/test_yogas_doshas.py` asserts `compute_yogas(chart)` is a list whose items each have `"name"` and `"category"`. MUST stay green.
- `normalizeYogasDoshas` (in `src/hooks/usePyodide.js`) already maps each yoga to `{name, category, description}` — emitting a `description` field from `compute_yogas` flows through with NO change to that function.
- Run Python tests: `.venv-test/bin/python -m pytest tests/python/<file> -v`. Branch: create `feat/astro-parity-p1a` off `main` before starting.
- Dignity helpers: `dignity.DIGNITY_RANK` (dict), `dignity.strength_label(fact)`.

---

## File Structure

- **Rewrite** `src/lib/pyodide/scripts/yogas.py` — registry: `_context`, geometry/relationship helpers, `YOGA_RULES` list, `compute_yogas`, `compute_yogas_json`. One responsibility: yoga detection over adapter facts.
- **Modify** `src/lib/llm/tools.js` — `get_chart` yogas mapping surfaces `name + description`.
- **Test** `tests/python/test_yogas.py` (new) — synthetic-context unit tests per rule + integration smoke on fixtures. (Keep `test_yogas_doshas.py` as the back-compat guard.)

---

## Task 1: Registry scaffolding + context builder

**Files:**
- Rewrite: `src/lib/pyodide/scripts/yogas.py`
- Test: `tests/python/test_yogas.py` (new)

- [ ] **Step 1: Write the failing test**

```python
# tests/python/test_yogas.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from yogas import _context, compute_yogas, YOGA_RULES


def test_context_shape(sarthak_chart):
    ctx = _context(sarthak_chart)
    assert set(ctx.keys()) >= {"planets", "lords", "lagna_idx"}
    assert ctx["lagna_idx"] == 10  # Aquarius
    assert ctx["planets"]["Saturn"]["house"] >= 1
    assert ctx["lords"][1] == "Saturn"


def test_registry_entries_well_formed():
    assert len(YOGA_RULES) >= 1
    for r in YOGA_RULES:
        assert set(r.keys()) >= {"id", "name", "category", "description", "detect"}
        assert callable(r["detect"])


def test_compute_yogas_returns_named_list(sarthak_chart):
    result = compute_yogas(sarthak_chart)
    assert isinstance(result, list)
    for y in result:
        assert "name" in y and "category" in y and "description" in y
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -v`
Expected: FAIL (`ModuleNotFoundError` is impossible since yogas.py exists — it will fail importing `_context`/`YOGA_RULES`).

- [ ] **Step 3: Rewrite `yogas.py` with the registry skeleton**

Replace the ENTIRE contents of `src/lib/pyodide/scripts/yogas.py` with:

```python
"""Vedic yoga detection as a rule registry over adapter facts.

Each rule is a pure function of a context dict (planets + house lords + lagna),
returning True when the yoga is present. jyotishganit supplies dignity, shadbala
strength, graha-drishti aspects and conjunctions; we read those (never recompute).
Clean-room implementations from classical (BPHS) definitions.
"""
import json
from adapter import planet_facts, house_lords, lagna_sign, SIGN_IDX

KENDRAS = {1, 4, 7, 10}
TRIKONAS = {1, 5, 9}
DUSTHANAS = {6, 8, 12}
NODES = {"Rahu", "Ketu"}
STRONG_DIGNITIES = {"exalted", "moolatrikona", "own"}


def _context(chart_json):
    """Build the per-chart context every rule consumes."""
    return {
        "planets": planet_facts(chart_json),
        "lords": house_lords(chart_json),
        "lagna_idx": SIGN_IDX[lagna_sign(chart_json)],
    }


def house_distance(from_house, to_house):
    """1-based count from from_house to to_house (inclusive of the destination),
    e.g. the 7th from H1 is distance 7; same house is 1."""
    return ((to_house - from_house) % 12) + 1


def planet_in(ctx, planet):
    """The planet's fact dict, or None if not placed (e.g. some charts omit a body)."""
    return ctx["planets"].get(planet)


YOGA_RULES = []  # populated by later tasks


def compute_yogas(chart_json):
    """Run every registered rule; return active yogas as {name, category, description}."""
    ctx = _context(chart_json)
    out = []
    for rule in YOGA_RULES:
        try:
            if rule["detect"](ctx):
                out.append({
                    "name": rule["name"],
                    "category": rule["category"],
                    "description": rule["description"],
                })
        except Exception:
            # A malformed/edge chart must never crash the whole reading — skip the rule.
            continue
    return out


def compute_yogas_json(chart_json_str):
    """Worker entry point: accepts JSON string, returns JSON string."""
    return json.dumps(compute_yogas(json.loads(chart_json_str)), default=str)
```

- [ ] **Step 4: Run to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py tests/python/test_yogas_doshas.py -v`
Expected: PASS. `test_compute_yogas_returns_named_list` passes trivially (empty list). `test_yogas_doshas.py` still passes (empty list is a valid list; its `test_yogas_each_has_name_and_category` iterates zero items).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/yogas.py tests/python/test_yogas.py
git commit -m "refactor(yogas): registry scaffolding + adapter-backed context builder"
```

---

## Task 2: Geometry/relationship helpers + Pancha Mahapurusha

**Files:**
- Modify: `src/lib/pyodide/scripts/yogas.py`
- Test: `tests/python/test_yogas.py`

- [ ] **Step 1: Write the failing test (append)**

```python
from yogas import _mahapurusha_present


def _ctx(planets, lords=None, lagna_idx=10):
    """Build a minimal synthetic context for rule unit tests."""
    full = {}
    for name, p in planets.items():
        full[name] = {"house": p.get("house", 1), "sign": p.get("sign", "Aries"),
                      "sign_idx": p.get("sign_idx", 0), "dignity": p.get("dignity", "neutral"),
                      "is_strong": p.get("is_strong", False), "retrograde": p.get("retrograde", False),
                      "conjuncts": p.get("conjuncts", []),
                      "aspects_gives": p.get("aspects_gives", []),
                      "aspects_receives": p.get("aspects_receives", [])}
    return {"planets": full, "lords": lords or {}, "lagna_idx": lagna_idx}


def test_mahapurusha_fires_for_own_sign_in_kendra():
    # Mars in own sign, in a kendra (H10) -> Ruchaka.
    ctx = _ctx({"Mars": {"house": 10, "dignity": "own"}})
    assert _mahapurusha_present(ctx, "Mars") is True


def test_mahapurusha_absent_when_not_in_kendra():
    ctx = _ctx({"Mars": {"house": 3, "dignity": "own"}})
    assert _mahapurusha_present(ctx, "Mars") is False


def test_mahapurusha_absent_when_neutral_dignity():
    ctx = _ctx({"Jupiter": {"house": 1, "dignity": "neutral"}})
    assert _mahapurusha_present(ctx, "Jupiter") is False
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -v`
Expected: FAIL (`cannot import name '_mahapurusha_present'`).

- [ ] **Step 3: Add to `yogas.py` (before `YOGA_RULES = []`, then register)**

```python
_MAHAPURUSHA = {
    "Mars": ("Ruchaka", "Bold, disciplined, commanding — natural drive and physical courage."),
    "Mercury": ("Bhadra", "Sharp intellect and communication — quick, articulate, business-minded."),
    "Jupiter": ("Hamsa", "Wise, principled, respected — a teacher's grace and good fortune."),
    "Venus": ("Malavya", "Charm, comfort, and an eye for beauty — refined and well-liked."),
    "Saturn": ("Sasa", "Patient, hard-working, authoritative — slow-built, durable success."),
}


def _mahapurusha_present(ctx, planet):
    """One of the five Pancha Mahapurusha yogas: the planet sits in its own/
    moolatrikona/exalted sign AND in a kendra (1/4/7/10) from the lagna."""
    p = planet_in(ctx, planet)
    if not p:
        return False
    return p["house"] in KENDRAS and p["dignity"] in STRONG_DIGNITIES
```

Then register the five rules by appending to `YOGA_RULES` (place this AFTER the `YOGA_RULES = []` line). Use a default-argument lambda so each closure binds its own planet:

```python
for _planet, (_name, _desc) in _MAHAPURUSHA.items():
    YOGA_RULES.append({
        "id": f"mahapurusha_{_name.lower()}",
        "name": _name,
        "category": "Pancha Mahapurusha",
        "description": _desc,
        "detect": (lambda p: (lambda ctx: _mahapurusha_present(ctx, p)))(_planet),
    })
```

- [ ] **Step 4: Run to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/yogas.py tests/python/test_yogas.py
git commit -m "feat(yogas): Pancha Mahapurusha rules (dignity + kendra), registered"
```

---

## Task 3: Chandra (Moon) yogas — Gaja-Kesari, Sunapha, Anapha, Durudhara, Kemadruma

**Files:**
- Modify: `src/lib/pyodide/scripts/yogas.py`
- Test: `tests/python/test_yogas.py`

- [ ] **Step 1: Write the failing test (append)**

```python
from yogas import (_gaja_kesari, _sunapha, _anapha, _durudhara, _kemadruma)

# Helpers: place planets by house. Moon at H1 means 2nd-from-Moon = H2, 12th-from-Moon = H12.

def test_gaja_kesari_fires_jupiter_kendra_from_moon():
    # Moon H1, Jupiter H4 (a kendra from Moon), Jupiter not debilitated.
    ctx = _ctx({"Moon": {"house": 1}, "Jupiter": {"house": 4, "dignity": "own"}})
    assert _gaja_kesari(ctx) is True


def test_gaja_kesari_absent_when_jupiter_debilitated():
    ctx = _ctx({"Moon": {"house": 1}, "Jupiter": {"house": 4, "dignity": "debilitated"}})
    assert _gaja_kesari(ctx) is False


def test_sunapha_fires_planet_2nd_from_moon():
    # Moon H5, planet (Mars) in H6 = 2nd from Moon. Sun/nodes excluded.
    ctx = _ctx({"Moon": {"house": 5}, "Mars": {"house": 6}})
    assert _sunapha(ctx) is True


def test_sunapha_ignores_sun_and_nodes():
    ctx = _ctx({"Moon": {"house": 5}, "Sun": {"house": 6}, "Rahu": {"house": 6}})
    assert _sunapha(ctx) is False


def test_anapha_fires_planet_12th_from_moon():
    # Moon H5, planet in H4 = 12th from Moon.
    ctx = _ctx({"Moon": {"house": 5}, "Venus": {"house": 4}})
    assert _anapha(ctx) is True


def test_durudhara_requires_both_2nd_and_12th():
    ctx = _ctx({"Moon": {"house": 5}, "Mars": {"house": 6}, "Venus": {"house": 4}})
    assert _durudhara(ctx) is True
    ctx2 = _ctx({"Moon": {"house": 5}, "Mars": {"house": 6}})
    assert _durudhara(ctx2) is False


def test_kemadruma_fires_when_moon_isolated():
    # Moon H5, NOTHING in 2nd(H6)/12th(H4) from Moon (Sun/Moon allowed there), and no
    # non-Moon planet in kendras from lagna (lagna_idx default 10 -> kendras H1/4/7/10).
    ctx = _ctx({"Moon": {"house": 5}})
    assert _kemadruma(ctx) is True


def test_kemadruma_absent_when_planet_flanks_moon():
    ctx = _ctx({"Moon": {"house": 5}, "Mars": {"house": 6}})
    assert _kemadruma(ctx) is False
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -v`
Expected: FAIL (`cannot import name '_gaja_kesari'`).

- [ ] **Step 3: Add to `yogas.py`**

```python
def _planets_in_house_from(ctx, anchor_house, distance, exclude=()):
    """Names of planets sitting `distance` houses from anchor_house, excluding `exclude`."""
    target = ((anchor_house - 1 + (distance - 1)) % 12) + 1
    return [name for name, p in ctx["planets"].items()
            if p["house"] == target and name not in exclude]


def _gaja_kesari(ctx):
    """Jupiter in a kendra (1/4/7/10) FROM the Moon, and not debilitated."""
    moon, jup = planet_in(ctx, "Moon"), planet_in(ctx, "Jupiter")
    if not moon or not jup:
        return False
    return house_distance(moon["house"], jup["house"]) in {1, 4, 7, 10} \
        and jup["dignity"] != "debilitated"


def _sunapha(ctx):
    """A planet other than the Sun (and not a node) in the 2nd from the Moon."""
    moon = planet_in(ctx, "Moon")
    if not moon:
        return False
    return len(_planets_in_house_from(ctx, moon["house"], 2, exclude={"Sun", "Moon"} | NODES)) > 0


def _anapha(ctx):
    """A planet other than the Sun (and not a node) in the 12th from the Moon."""
    moon = planet_in(ctx, "Moon")
    if not moon:
        return False
    return len(_planets_in_house_from(ctx, moon["house"], 12, exclude={"Sun", "Moon"} | NODES)) > 0


def _durudhara(ctx):
    """Both the 2nd AND 12th from the Moon occupied (Sunapha + Anapha together)."""
    return _sunapha(ctx) and _anapha(ctx)


def _kemadruma(ctx):
    """Affliction yoga: the Moon is isolated — no planet (other than Sun/Moon) in the
    2nd or 12th from the Moon, AND no planet other than the Moon in a kendra from lagna."""
    moon = planet_in(ctx, "Moon")
    if not moon:
        return False
    flank = (_planets_in_house_from(ctx, moon["house"], 2, exclude={"Sun", "Moon"} | NODES)
             + _planets_in_house_from(ctx, moon["house"], 12, exclude={"Sun", "Moon"} | NODES))
    if flank:
        return False
    lagna_kendras = {((ctx["lagna_idx"] + off) % 12) + 1 for off in (0, 3, 6, 9)}
    # any non-Moon classical planet in a kendra house breaks Kemadruma
    for name, p in ctx["planets"].items():
        if name in ({"Moon"} | NODES):
            continue
        if p["house"] in lagna_kendras:
            return False
    return True
```

Register them (append to `YOGA_RULES`):

```python
YOGA_RULES.extend([
    {"id": "gaja_kesari", "name": "Gaja-Kesari", "category": "Chandra",
     "description": "Wisdom paired with standing — Jupiter strengthens the mind; brings respect, judgment and lasting reputation.",
     "detect": _gaja_kesari},
    {"id": "sunapha", "name": "Sunapha", "category": "Chandra",
     "description": "Self-made prosperity and a capable mind — gains through one's own effort.",
     "detect": _sunapha},
    {"id": "anapha", "name": "Anapha", "category": "Chandra",
     "description": "Well-rounded, healthy and well-regarded — comfort and a good name.",
     "detect": _anapha},
    {"id": "durudhara", "name": "Durudhara", "category": "Chandra",
     "description": "Generous and prosperous — supported on both sides; enjoys and shares wealth.",
     "detect": _durudhara},
    {"id": "kemadruma", "name": "Kemadruma", "category": "Chandra (affliction)",
     "description": "An isolated Moon — periods of struggle, instability or feeling unsupported; needs deliberate structure and support.",
     "detect": _kemadruma},
])
```

- [ ] **Step 4: Run to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -v`
Expected: PASS (all Chandra tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/yogas.py tests/python/test_yogas.py
git commit -m "feat(yogas): Chandra yogas — Gaja-Kesari, Sunapha, Anapha, Durudhara, Kemadruma"
```

---

## Task 4: Surya (Sun) yogas — Budha-Aditya, Vesi, Vasi, Ubhayachari

**Files:**
- Modify: `src/lib/pyodide/scripts/yogas.py`
- Test: `tests/python/test_yogas.py`

- [ ] **Step 1: Write the failing test (append)**

```python
from yogas import (_budha_aditya, _vesi, _vasi, _ubhayachari)


def test_budha_aditya_fires_sun_mercury_same_house():
    ctx = _ctx({"Sun": {"house": 3}, "Mercury": {"house": 3}})
    assert _budha_aditya(ctx) is True
    ctx2 = _ctx({"Sun": {"house": 3}, "Mercury": {"house": 5}})
    assert _budha_aditya(ctx2) is False


def test_vesi_fires_planet_2nd_from_sun():
    # Sun H1, planet (Jupiter) in H2 = 2nd from Sun. Moon/nodes excluded.
    ctx = _ctx({"Sun": {"house": 1}, "Jupiter": {"house": 2}})
    assert _vesi(ctx) is True


def test_vasi_fires_planet_12th_from_sun():
    ctx = _ctx({"Sun": {"house": 5}, "Saturn": {"house": 4}})
    assert _vasi(ctx) is True


def test_ubhayachari_requires_both_sides_of_sun():
    ctx = _ctx({"Sun": {"house": 5}, "Jupiter": {"house": 6}, "Saturn": {"house": 4}})
    assert _ubhayachari(ctx) is True
    ctx2 = _ctx({"Sun": {"house": 5}, "Jupiter": {"house": 6}})
    assert _ubhayachari(ctx2) is False
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -v`
Expected: FAIL (`cannot import name '_budha_aditya'`).

- [ ] **Step 3: Add to `yogas.py`**

```python
def _budha_aditya(ctx):
    """Sun and Mercury together (same house) — intelligence yoga."""
    sun, merc = planet_in(ctx, "Sun"), planet_in(ctx, "Mercury")
    return bool(sun and merc and sun["house"] == merc["house"])


def _vesi(ctx):
    """A planet other than the Moon (and not a node) in the 2nd from the Sun."""
    sun = planet_in(ctx, "Sun")
    if not sun:
        return False
    return len(_planets_in_house_from(ctx, sun["house"], 2, exclude={"Sun", "Moon"} | NODES)) > 0


def _vasi(ctx):
    """A planet other than the Moon (and not a node) in the 12th from the Sun."""
    sun = planet_in(ctx, "Sun")
    if not sun:
        return False
    return len(_planets_in_house_from(ctx, sun["house"], 12, exclude={"Sun", "Moon"} | NODES)) > 0


def _ubhayachari(ctx):
    """Planets flanking the Sun on both sides (2nd AND 12th) — Vesi + Vasi together."""
    return _vesi(ctx) and _vasi(ctx)
```

Register:

```python
YOGA_RULES.extend([
    {"id": "budha_aditya", "name": "Budha-Aditya", "category": "Surya",
     "description": "Bright, analytical intelligence — clear thinking, learning and communication.",
     "detect": _budha_aditya},
    {"id": "vesi", "name": "Vesi", "category": "Surya",
     "description": "Steady, balanced disposition — a measured, principled nature.",
     "detect": _vesi},
    {"id": "vasi", "name": "Vasi", "category": "Surya",
     "description": "Capable and persuasive — gains through skill and goodwill.",
     "detect": _vasi},
    {"id": "ubhayachari", "name": "Ubhayachari", "category": "Surya",
     "description": "All-round comfort and standing — well-supported, healthy, respected.",
     "detect": _ubhayachari},
])
```

- [ ] **Step 4: Run to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/yogas.py tests/python/test_yogas.py
git commit -m "feat(yogas): Surya yogas — Budha-Aditya, Vesi, Vasi, Ubhayachari"
```

---

## Task 5: Port the remaining existing yogas (no regression) — Chandra-Mangal, Adhi, Kesari, Lakshmi, Dharma-Karmadhipati

These five are present in the current `yogas.py` and MUST survive the rewrite (net-additive goal). Lakshmi and Dharma-Karmadhipati use house lords, which are already in `ctx["lords"]`.

**Files:**
- Modify: `src/lib/pyodide/scripts/yogas.py`
- Test: `tests/python/test_yogas.py`

- [ ] **Step 1: Write the failing test (append)**

```python
from yogas import (_chandra_mangal, _adhi, _kesari, _lakshmi, _dharma_karmadhipati)


def test_chandra_mangal_fires_moon_mars_conjunct():
    ctx = _ctx({"Moon": {"house": 7}, "Mars": {"house": 7}})
    assert _chandra_mangal(ctx) is True
    assert _chandra_mangal(_ctx({"Moon": {"house": 7}, "Mars": {"house": 8}})) is False


def test_adhi_fires_two_benefics_6_7_8_from_moon():
    # Moon H1 -> 6th=H6, 7th=H7, 8th=H8. Mercury H6, Jupiter H7 -> two benefics.
    ctx = _ctx({"Moon": {"house": 1}, "Mercury": {"house": 6}, "Jupiter": {"house": 7}})
    assert _adhi(ctx) is True
    assert _adhi(_ctx({"Moon": {"house": 1}, "Mercury": {"house": 6}})) is False  # only one


def test_kesari_fires_strong_jupiter_in_lagna_kendra():
    # lagna_idx 10 (Aquarius) -> kendras H1/4/7/10. Jupiter strong in H1.
    ctx = _ctx({"Jupiter": {"house": 1, "dignity": "own", "is_strong": True}})
    assert _kesari(ctx) is True
    assert _kesari(_ctx({"Jupiter": {"house": 3, "dignity": "own", "is_strong": True}})) is False


def test_lakshmi_fires_strong_venus_and_strong_9th_lord_in_trikona():
    # 9th lord = Venus per lords map; Venus strong, in a trikona (H9).
    ctx = _ctx({"Venus": {"house": 9, "dignity": "exalted", "is_strong": True}},
               lords={9: "Venus"})
    assert _lakshmi(ctx) is True


def test_dharma_karmadhipati_fires_9th_10th_lords_conjunct():
    ctx = _ctx({"Jupiter": {"house": 5}, "Mars": {"house": 5}},
               lords={9: "Jupiter", 10: "Mars"})
    assert _dharma_karmadhipati(ctx) is True
    ctx2 = _ctx({"Jupiter": {"house": 5}, "Mars": {"house": 8}},
                lords={9: "Jupiter", 10: "Mars"})
    assert _dharma_karmadhipati(ctx2) is False
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -v`
Expected: FAIL (`cannot import name '_chandra_mangal'`).

- [ ] **Step 3: Add to `yogas.py`**

```python
BENEFICS = {"Mercury", "Jupiter", "Venus"}


def _chandra_mangal(ctx):
    """Moon and Mars in the same house — drive directed at wealth/security."""
    moon, mars = planet_in(ctx, "Moon"), planet_in(ctx, "Mars")
    return bool(moon and mars and moon["house"] == mars["house"])


def _adhi(ctx):
    """Two or more natural benefics in the 6th/7th/8th from the Moon."""
    moon = planet_in(ctx, "Moon")
    if not moon:
        return False
    target = {((moon["house"] - 1 + off) % 12) + 1 for off in (5, 6, 7)}  # 6th,7th,8th
    count = sum(1 for b in BENEFICS
                if planet_in(ctx, b) and planet_in(ctx, b)["house"] in target)
    return count >= 2


def _kesari(ctx):
    """Jupiter strong (own/moolatrikona/exalted) in a kendra from the lagna."""
    jup = planet_in(ctx, "Jupiter")
    if not jup:
        return False
    lagna_kendras = {((ctx["lagna_idx"] + off) % 12) + 1 for off in (0, 3, 6, 9)}
    return jup["house"] in lagna_kendras and jup["dignity"] in STRONG_DIGNITIES


def _lakshmi(ctx):
    """Venus strong (own/exalted) AND the 9th lord strong in a kendra or trikona."""
    venus = planet_in(ctx, "Venus")
    lord9_name = ctx["lords"].get(9)
    lord9 = planet_in(ctx, lord9_name) if lord9_name else None
    if not (venus and lord9):
        return False
    return venus["dignity"] in STRONG_DIGNITIES \
        and lord9["house"] in (KENDRAS | TRIKONAS) \
        and lord9["dignity"] in STRONG_DIGNITIES


def _dharma_karmadhipati(ctx):
    """The 9th and 10th lords conjunct or in mutual kendra (a strong Raja yoga)."""
    l9, l10 = ctx["lords"].get(9), ctx["lords"].get(10)
    if not l9 or not l10 or l9 == l10:
        return False
    p9, p10 = planet_in(ctx, l9), planet_in(ctx, l10)
    if not p9 or not p10:
        return False
    return house_distance(p9["house"], p10["house"]) in {1, 4, 7, 10}
```

Register:

```python
YOGA_RULES.extend([
    {"id": "chandra_mangal", "name": "Chandra-Mangal", "category": "Chandra",
     "description": "A strong money drive — earning power and ambition, sometimes intense about finances.",
     "detect": _chandra_mangal},
    {"id": "adhi", "name": "Adhi", "category": "Chandra",
     "description": "Leadership and prosperity — well-supported, healthy, and trusted with responsibility.",
     "detect": _adhi},
    {"id": "kesari", "name": "Kesari", "category": "Jupiter",
     "description": "A strong, well-placed Jupiter — sound judgment, optimism and protection in life.",
     "detect": _kesari},
    {"id": "lakshmi", "name": "Lakshmi", "category": "Raja",
     "description": "Wealth and grace — comfort, beauty and good fortune through the year's blessings.",
     "detect": _lakshmi},
    {"id": "dharma_karmadhipati", "name": "Dharma-Karmadhipati", "category": "Raja",
     "description": "Luck meets effort — a powerful combination for career rise and recognition.",
     "detect": _dharma_karmadhipati},
])
```

- [ ] **Step 4: Run to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/yogas.py tests/python/test_yogas.py
git commit -m "feat(yogas): port Chandra-Mangal, Adhi, Kesari, Lakshmi, Dharma-Karmadhipati into registry"
```

---

## Task 6: Integration — surface descriptions, run on real charts, full suite

**Files:**
- Modify: `src/lib/llm/tools.js` (`get_chart` yogas mapping)
- Test: `tests/python/test_yogas.py`; existing e2e

- [ ] **Step 1: Write the integration smoke test (append to test_yogas.py)**

```python
def test_compute_yogas_on_real_chart_is_wellformed(sarthak_chart):
    result = compute_yogas(sarthak_chart)
    # Every active yoga carries a non-empty name, category and description.
    for y in result:
        assert y["name"] and y["category"] and y["description"]
    # Names are unique (no rule fires twice).
    names = [y["name"] for y in result]
    assert len(names) == len(set(names))


def test_compute_yogas_json_roundtrips(sarthak_chart):
    import json as _json
    from yogas import compute_yogas_json
    parsed = _json.loads(compute_yogas_json(_json.dumps(sarthak_chart)))
    assert isinstance(parsed, list)
```

- [ ] **Step 2: Run to verify (these should pass already given Tasks 1–4)**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py tests/python/test_yogas_doshas.py -v`
Expected: PASS. Note in the run output how many yogas fire for Sarthak (informational).

- [ ] **Step 3: Surface descriptions in `get_chart`**

In `src/lib/llm/tools.js`, the `get_chart` execute currently maps yogas as:
```javascript
        yogas: (profile.yogas ?? []).map(y => y.name ?? y).slice(0, 12),
```
Replace that line with one that includes the description when present (the stored shape is `{name, category, description}` after `normalizeYogasDoshas`):
```javascript
        yogas: (profile.yogas ?? []).slice(0, 12).map(y =>
          y?.description ? `${y.name} — ${y.description}` : (y?.name ?? y)),
```

- [ ] **Step 4: Lint + JS unit tests + normalize test**

Run: `npx vitest run tests/lib/normalizeYogasDoshas.test.js && npm run lint`
Expected: PASS, 0 lint errors. (`normalizeYogasDoshas` already passes `description` through; no change needed there — confirm the test still passes.)

- [ ] **Step 5: e2e — confirm get_chart still flows end-to-end**

Run: `npx playwright test tests/e2e/agent.spec.js tests/e2e/chart-and-today.spec.js`
Expected: PASS. (The `agent calls get_chart` test exercises the changed mapping; `chart-and-today` exercises ChartTab reading `activeProfile.yogas`.)

- [ ] **Step 6: Full suite**

Run: `.venv-test/bin/python -m pytest tests/python/ -q && npx vitest run`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pyodide/scripts/yogas.py tests/python/test_yogas.py src/lib/llm/tools.js
git commit -m "feat(yogas): surface yoga descriptions in get_chart; integration smoke"
```

---

## Self-Review notes (for the implementer)

- **Back-compat:** `compute_yogas` still returns a list of dicts each with `name`+`category` (now also `description`), so `test_yogas_doshas.py` and `normalizeYogasDoshas` keep working. Do NOT remove the `name`/`category` keys.
- **No regression — net additive.** Every rule in today's `yogas.py` is re-implemented in the registry: Mahapurusha (Task 2), Gaja-Kesari/Sunapha/Anapha (Task 3), Vesi/Vasi/Budha-Aditya (Task 4), and Chandra-Mangal/Adhi/Kesari/Lakshmi/Dharma-Karmadhipati (Task 5). NEW in P1a: Durudhara, Kemadruma, Ubhayachari + a plain-English `description` and dignity/strength-awareness on every rule. **P1b (next plan) adds genuinely new families: generalized Raja (all kendra–trikona lord combinations), Viparita Raja (Harsha/Sarala/Vimala), Neecha Bhanga, and Dhana yogas.**
- **Type consistency:** rule `detect` functions take `ctx` and return bool. `_context` keys: `planets` (from `planet_facts`), `lords` (from `house_lords`), `lagna_idx` (int). Helpers `house_distance`, `_planets_in_house_from`, `planet_in` are shared. Registry entries always have `id,name,category,description,detect`.
- **Determinism:** rule unit tests use synthetic `_ctx(...)` — they don't depend on what yogas a real chart happens to have. The real-chart tests assert only well-formedness + uniqueness.
- **Clean-room:** definitions are standard BPHS; PyJHora consulted for the Kemadruma two-condition form only. No code copied.
```
