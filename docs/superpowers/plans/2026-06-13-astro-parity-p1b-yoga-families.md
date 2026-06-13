# P1b — New Yoga Families Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the high-value classical yoga families (generalized Raja, Viparita Raja, Neecha Bhanga, Dhana) to the clean-room yoga registry, and fix a latent dignity-vocabulary bug that prevents existing own-sign yogas from firing on real charts.

**Architecture:** All new rules are pure functions of the existing `_context(chart)` dict (planets + house lords + lagna), registered in `YOGA_RULES` exactly like the P1a rules. A small set of shared helpers (`_aspects`, `_parivartana`, `_associated`, owned-sign and exaltation maps) is added once and reused. The dignity fix is made at the adapter — the single source of truth — so it corrects both yoga detection and the dignity text surfaced to the LLM.

**Tech Stack:** Pure Python (runs in the Pyodide worker), pytest for unit tests (`.venv-test/bin/python -m pytest`), synthetic-context unit tests via the existing `_ctx()` helper in `tests/python/test_yogas.py`.

**Key facts established before writing this plan (verified against jyotishganit 0.1.3):**
- jyotishganit's `dignities.dignity` field emits ONLY: `deep_exaltation`, `exalted`, `deep_debilitation`, `debilitated`, `moolatrikona`, `own_sign`, `neutral`. It NEVER emits `own`, `friend`, or `enemy`.
- Because P1a's `STRONG_DIGNITIES = {"exalted","moolatrikona","own"}` checks `"own"`, own-sign Mahapurusha/Kesari/Lakshmi never fire on real charts, and `_gaja_kesari`'s `!= "debilitated"` check lets a `deep_debilitation` Jupiter slip through.
- Aspect data shape (per planet, from `adapter.planet_facts`): `aspects_receives` is a list of `{"from_planet": <name>, "aspect_type": "<n>"}` (and/or `{"from_house": .., "aspect_type": ..}`); `aspects_gives` mirror with `to_planet`/`to_house`. Planet-keyed entries are what we use.
- `adapter.SIGN_LORD` maps sign→ruling planet; `house_distance(from_house, to_house)` returns a 1-based inclusive count (same house = 1, the kendras = {1,4,7,10}).

---

## File Structure

- Modify: `src/lib/pyodide/scripts/adapter.py` — normalize the dignity string in `planet_facts`.
- Modify: `src/lib/pyodide/scripts/yogas.py` — add shared helpers + 6 new yoga rules.
- Modify: `tests/python/test_adapter.py` — dignity-normalization regression test.
- Modify: `tests/python/test_yogas.py` — unit tests for helpers and each new rule.

No worker.js / vite.config.js / tools.js changes are needed: `compute_yogas` already returns `{name, category, description}` and the worker already loads `yogas.py` and `adapter.py`.

---

### Task 1: Normalize dignity vocabulary at the adapter

**Files:**
- Modify: `src/lib/pyodide/scripts/adapter.py`
- Test: `tests/python/test_adapter.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/python/test_adapter.py`:

```python
def test_dignity_normalized_to_canonical(sarthak_chart):
    from adapter import planet_facts
    pf = planet_facts(sarthak_chart)
    # jyotishganit raw vocabulary must never leak through the adapter.
    for name, f in pf.items():
        assert f["dignity"] not in ("own_sign", "deep_exaltation", "deep_debilitation"), \
            f"{name} leaked raw dignity {f['dignity']!r}"
        assert f["dignity"] in ("exalted", "debilitated", "moolatrikona", "own", "neutral")
    # Sarthak's Jupiter is in its own sign (Sagittarius) -> must normalize to 'own'.
    assert pf["Jupiter"]["dignity"] == "own"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_adapter.py::test_dignity_normalized_to_canonical -v`
Expected: FAIL (`Jupiter` dignity is `own_sign`).

- [ ] **Step 3: Implement the normalization**

In `src/lib/pyodide/scripts/adapter.py`, add the map near the top (after `SIGN_IDX`):

```python
# jyotishganit emits a wider raw dignity vocabulary; collapse it to the canonical
# set the rule modules and dignity.py expect. (deep_* magnitude is conveyed
# separately by shadbala strength, so collapsing it here loses nothing downstream.)
_DIGNITY_CANON = {
    "deep_exaltation": "exalted",
    "deep_debilitation": "debilitated",
    "own_sign": "own",
}
```

Then in `planet_facts`, replace the dignity extraction line:

```python
                "dignity": (occ.get("dignities") or {}).get("dignity", "neutral"),
```

with:

```python
                "dignity": _DIGNITY_CANON.get(
                    (occ.get("dignities") or {}).get("dignity", "neutral"),
                    (occ.get("dignities") or {}).get("dignity", "neutral"),
                ),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_adapter.py -v`
Expected: PASS (all adapter tests green).

- [ ] **Step 5: Run the full Python suite to confirm no regression**

Run: `.venv-test/bin/python -m pytest tests/python -v`
Expected: all PASS (existing yoga synthetic tests use canonical strings, so unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/lib/pyodide/scripts/adapter.py tests/python/test_adapter.py
git commit -m "fix: normalize jyotishganit dignity vocabulary at the adapter

own_sign/deep_exaltation/deep_debilitation now collapse to own/exalted/debilitated
so own-sign Mahapurusha/Kesari/Lakshmi yogas actually fire on real charts."
```

---

### Task 2: Shared association helpers

**Files:**
- Modify: `src/lib/pyodide/scripts/yogas.py`
- Test: `tests/python/test_yogas.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/python/test_yogas.py` (import line at top, plus tests):

```python
from yogas import _aspects, _parivartana, _associated, OWNED_SIGNS


def test_owned_signs_map():
    assert set(OWNED_SIGNS["Mars"]) == {"Aries", "Scorpio"}
    assert OWNED_SIGNS["Sun"] == ["Leo"]


def test_aspects_reads_receives():
    # B (Mars) records that it receives an aspect from A (Saturn).
    ctx = _ctx({"Saturn": {"house": 1}, "Mars": {"house": 7}})
    ctx["planets"]["Mars"]["aspects_receives"] = [{"from_planet": "Saturn", "aspect_type": "7"}]
    assert _aspects(ctx, "Saturn", "Mars") is True
    assert _aspects(ctx, "Mars", "Saturn") is False


def test_parivartana_detects_sign_exchange():
    # Mars in Venus's sign (Libra) and Venus in Mars's sign (Aries) -> exchange.
    ctx = _ctx({"Mars": {"house": 1, "sign": "Libra"}, "Venus": {"house": 7, "sign": "Aries"}})
    assert _parivartana(ctx, "Mars", "Venus") is True
    ctx2 = _ctx({"Mars": {"house": 1, "sign": "Libra"}, "Venus": {"house": 7, "sign": "Taurus"}})
    assert _parivartana(ctx2, "Mars", "Venus") is False


def test_associated_conjunction_aspect_exchange():
    # Conjunction (same house)
    ctx = _ctx({"Mars": {"house": 5}, "Venus": {"house": 5}})
    assert _associated(ctx, "Mars", "Venus") is True
    # Mutual aspect
    ctx2 = _ctx({"Mars": {"house": 1}, "Venus": {"house": 7}})
    ctx2["planets"]["Mars"]["aspects_receives"] = [{"from_planet": "Venus"}]
    ctx2["planets"]["Venus"]["aspects_receives"] = [{"from_planet": "Mars"}]
    assert _associated(ctx2, "Mars", "Venus") is True
    # One-sided aspect only -> not associated
    ctx3 = _ctx({"Mars": {"house": 1}, "Venus": {"house": 7}})
    ctx3["planets"]["Mars"]["aspects_receives"] = [{"from_planet": "Venus"}]
    assert _associated(ctx3, "Mars", "Venus") is False
    # Same planet -> never self-associated
    assert _associated(ctx, "Mars", "Mars") is False
```

- [ ] **Step 2: Run to verify they fail**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -k "owned_signs or aspects_reads or parivartana or associated" -v`
Expected: FAIL (`ImportError` — helpers not defined).

- [ ] **Step 3: Implement the helpers**

In `src/lib/pyodide/scripts/yogas.py`, change the import line to also pull `SIGN_LORD`:

```python
from adapter import planet_facts, house_lords, lagna_sign, SIGN_IDX, SIGN_LORD
```

Add after the constants block (after `STRONG_DIGNITIES = ...`):

```python
# planet -> the signs it rules (inverse of adapter.SIGN_LORD).
OWNED_SIGNS = {}
for _sign, _lord in SIGN_LORD.items():
    OWNED_SIGNS.setdefault(_lord, []).append(_sign)


def _aspects(ctx, giver, receiver):
    """True if `giver` casts a graha-drishti onto `receiver` (read from the
    receiver's pre-computed aspects_receives — jyotishganit already resolved drishti)."""
    pr = ctx["planets"].get(receiver)
    if not pr:
        return False
    return any(e.get("from_planet") == giver for e in pr.get("aspects_receives", []))


def _parivartana(ctx, a, b):
    """Sign exchange (parivartana): a sits in a sign b rules AND b sits in a sign a rules."""
    pa, pb = ctx["planets"].get(a), ctx["planets"].get(b)
    if not pa or not pb:
        return False
    return pa["sign"] in OWNED_SIGNS.get(b, []) and pb["sign"] in OWNED_SIGNS.get(a, [])


def _associated(ctx, a, b):
    """Classical 'association' of two planets: conjunction (same house),
    mutual aspect, or sign exchange. Two distinct planets only."""
    if a == b:
        return False
    pa, pb = ctx["planets"].get(a), ctx["planets"].get(b)
    if not pa or not pb:
        return False
    if pa["house"] == pb["house"]:
        return True
    if _aspects(ctx, a, b) and _aspects(ctx, b, a):
        return True
    return _parivartana(ctx, a, b)
```

- [ ] **Step 4: Run to verify they pass**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -k "owned_signs or aspects_reads or parivartana or associated" -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/yogas.py tests/python/test_yogas.py
git commit -m "feat: add shared yoga association helpers (aspect, parivartana, associated)"
```

---

### Task 3: Generalized Raja yoga (kendra–trikona lord association)

**Files:**
- Modify: `src/lib/pyodide/scripts/yogas.py`
- Test: `tests/python/test_yogas.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/python/test_yogas.py`:

```python
from yogas import _raja_kendra_trikona


def test_raja_fires_when_kendra_and_trikona_lords_conjoin():
    # lords: 10 (kendra) = Mars, 9 (trikona) = Jupiter; both in H5 -> conjunction.
    ctx = _ctx({"Mars": {"house": 5}, "Jupiter": {"house": 5}},
               lords={1: "Saturn", 4: "Venus", 7: "Sun", 10: "Mars",
                      5: "Mercury", 9: "Jupiter"})
    assert _raja_kendra_trikona(ctx) is True


def test_raja_absent_when_no_association():
    ctx = _ctx({"Mars": {"house": 5}, "Jupiter": {"house": 8}},
               lords={1: "Saturn", 4: "Venus", 7: "Sun", 10: "Mars",
                      5: "Mercury", 9: "Jupiter"})
    assert _raja_kendra_trikona(ctx) is False


def test_raja_ignores_shared_lord_pair():
    # If the only kendra/trikona lord overlap is the same planet (lagna lord), no yoga from self-pair.
    ctx = _ctx({"Saturn": {"house": 1}},
               lords={1: "Saturn", 4: "Saturn", 7: "Saturn", 10: "Saturn",
                      5: "Saturn", 9: "Saturn"})
    assert _raja_kendra_trikona(ctx) is False
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -k raja -v`
Expected: FAIL (`ImportError`).

- [ ] **Step 3: Implement the rule + register it**

In `src/lib/pyodide/scripts/yogas.py`, add the detect function (place it after the helpers):

```python
def _raja_kendra_trikona(ctx):
    """Generalized Raja yoga: any kendra lord (1/4/7/10) associated with any
    trikona lord (1/5/9). The lagna lord rules both, so same-planet pairs are skipped."""
    lords = ctx["lords"]
    kendra_lords = {lords.get(h) for h in (1, 4, 7, 10)} - {None}
    trikona_lords = {lords.get(h) for h in (1, 5, 9)} - {None}
    for k in kendra_lords:
        for t in trikona_lords:
            if k != t and _associated(ctx, k, t):
                return True
    return False
```

Register it (extend `YOGA_RULES`, e.g. append a new `YOGA_RULES.extend([...])` block near the other Raja yogas):

```python
YOGA_RULES.append({
    "id": "raja_kendra_trikona", "name": "Raja Yoga", "category": "Raja",
    "description": "A kendra lord and a trikona lord join forces — the classic marker of rise in status, authority and worldly success.",
    "detect": _raja_kendra_trikona,
})
```

- [ ] **Step 4: Run to verify it passes**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -k raja -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/yogas.py tests/python/test_yogas.py
git commit -m "feat: add generalized kendra-trikona Raja yoga"
```

---

### Task 4: Viparita Raja yogas (Harsha, Sarala, Vimala)

**Files:**
- Modify: `src/lib/pyodide/scripts/yogas.py`
- Test: `tests/python/test_yogas.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/python/test_yogas.py`:

```python
from yogas import _viparita


def test_viparita_harsha_6th_lord_in_dusthana():
    # 6th lord (Mars) sits in a dusthana (H8) -> Harsha.
    ctx = _ctx({"Mars": {"house": 8}}, lords={6: "Mars"})
    assert _viparita(ctx, 6) is True


def test_viparita_absent_when_lord_in_good_house():
    ctx = _ctx({"Mars": {"house": 10}}, lords={6: "Mars"})
    assert _viparita(ctx, 6) is False


def test_viparita_sarala_and_vimala():
    # 8th lord in H12 -> Sarala; 12th lord in H6 -> Vimala.
    ctx = _ctx({"Saturn": {"house": 12}, "Jupiter": {"house": 6}},
               lords={8: "Saturn", 12: "Jupiter"})
    assert _viparita(ctx, 8) is True
    assert _viparita(ctx, 12) is True
```

- [ ] **Step 2: Run to verify they fail**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -k viparita -v`
Expected: FAIL (`ImportError`).

- [ ] **Step 3: Implement the rule + register the three yogas**

In `src/lib/pyodide/scripts/yogas.py`, add:

```python
def _viparita(ctx, lord_house):
    """Viparita Raja yoga: the lord of a dusthana (6/8/12) is itself placed in a
    dusthana (6/8/12) — adversity turning to advantage."""
    lord = ctx["lords"].get(lord_house)
    p = ctx["planets"].get(lord) if lord else None
    return bool(p and p["house"] in DUSTHANAS)
```

Register:

```python
YOGA_RULES.extend([
    {"id": "viparita_harsha", "name": "Harsha (Viparita Raja)", "category": "Viparita Raja",
     "description": "The 6th lord falls in a dusthana — enemies, debts and health troubles turn into strength; you outlast your obstacles.",
     "detect": (lambda ctx: _viparita(ctx, 6))},
    {"id": "viparita_sarala", "name": "Sarala (Viparita Raja)", "category": "Viparita Raja",
     "description": "The 8th lord falls in a dusthana — resilience through crises; long life and recovery from setbacks.",
     "detect": (lambda ctx: _viparita(ctx, 8))},
    {"id": "viparita_vimala", "name": "Vimala (Viparita Raja)", "category": "Viparita Raja",
     "description": "The 12th lord falls in a dusthana — losses convert to gains; thrift and good conduct bring quiet prosperity.",
     "detect": (lambda ctx: _viparita(ctx, 12))},
])
```

- [ ] **Step 4: Run to verify they pass**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -k viparita -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/yogas.py tests/python/test_yogas.py
git commit -m "feat: add Viparita Raja yogas (Harsha, Sarala, Vimala)"
```

---

### Task 5: Neecha Bhanga Raja yoga (cancellation of debilitation)

**Files:**
- Modify: `src/lib/pyodide/scripts/yogas.py`
- Test: `tests/python/test_yogas.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/python/test_yogas.py`:

```python
from yogas import _neecha_bhanga, EXALTED_IN_SIGN


def test_neecha_bhanga_via_dispositor_in_kendra_from_lagna():
    # Sun debilitated in Libra; dispositor of Libra is Venus; Venus in a kendra (H4) from lagna.
    ctx = _ctx({"Sun": {"house": 7, "sign": "Libra", "dignity": "debilitated"},
                "Venus": {"house": 4, "sign": "Cancer"}})
    assert _neecha_bhanga(ctx) is True


def test_neecha_bhanga_via_exaltation_lord_in_kendra():
    # Sun debilitated in Libra; the planet exalted in Libra is Saturn; Saturn in kendra (H10).
    ctx = _ctx({"Sun": {"house": 7, "sign": "Libra", "dignity": "debilitated"},
                "Venus": {"house": 3, "sign": "Gemini"},
                "Saturn": {"house": 10, "sign": "Capricorn"}})
    assert EXALTED_IN_SIGN["Libra"] == "Saturn"
    assert _neecha_bhanga(ctx) is True


def test_neecha_bhanga_absent_when_no_cancellation():
    # Sun debilitated in Libra; dispositor Venus and exalt-lord Saturn both in non-kendra, non-Moon-kendra houses.
    ctx = _ctx({"Sun": {"house": 7, "sign": "Libra", "dignity": "debilitated"},
                "Venus": {"house": 3, "sign": "Gemini"},
                "Saturn": {"house": 6, "sign": "Virgo"}})
    assert _neecha_bhanga(ctx) is False


def test_neecha_bhanga_absent_when_no_debilitated_planet():
    ctx = _ctx({"Sun": {"house": 1, "sign": "Aquarius", "dignity": "neutral"}})
    assert _neecha_bhanga(ctx) is False
```

- [ ] **Step 2: Run to verify they fail**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -k neecha -v`
Expected: FAIL (`ImportError`).

- [ ] **Step 3: Implement the rule + register it**

In `src/lib/pyodide/scripts/yogas.py`, add the exaltation map near the constants:

```python
# The planet exalted in each sign (signs with no exaltation are omitted).
EXALTED_IN_SIGN = {
    "Aries": "Sun", "Taurus": "Moon", "Cancer": "Jupiter", "Virgo": "Mercury",
    "Libra": "Saturn", "Capricorn": "Mars", "Pisces": "Venus",
}
```

Add the detect function:

```python
def _kendra_from(ctx, planet, anchor_house):
    """True if `planet` sits in a kendra (1/4/7/10) counted from anchor_house."""
    p = ctx["planets"].get(planet)
    return bool(p and house_distance(anchor_house, p["house"]) in KENDRAS)


def _neecha_bhanga(ctx):
    """Neecha Bhanga Raja yoga: a planet is debilitated, but its weakness is cancelled
    because either the dispositor of its sign OR the planet exalted in that sign sits in
    a kendra from the lagna or from the Moon."""
    moon = ctx["planets"].get("Moon")
    moon_house = moon["house"] if moon else None
    for name, p in ctx["planets"].items():
        if name in NODES or p["dignity"] != "debilitated":
            continue
        rescuers = [r for r in (SIGN_LORD.get(p["sign"]), EXALTED_IN_SIGN.get(p["sign"])) if r]
        for r in rescuers:
            rp = ctx["planets"].get(r)
            if not rp:
                continue
            if rp["house"] in KENDRAS:  # kendra from the lagna (house is lagna-relative)
                return True
            if moon_house and _kendra_from(ctx, r, moon_house):
                return True
    return False
```

Register:

```python
YOGA_RULES.append({
    "id": "neecha_bhanga", "name": "Neecha Bhanga Raja Yoga", "category": "Raja (cancellation)",
    "description": "A debilitated planet's weakness is cancelled — an early struggle in that area of life tends to reverse into notable strength and success later.",
    "detect": _neecha_bhanga,
})
```

- [ ] **Step 4: Run to verify they pass**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -k neecha -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/yogas.py tests/python/test_yogas.py
git commit -m "feat: add Neecha Bhanga Raja yoga (debilitation cancellation)"
```

---

### Task 6: Dhana yoga (wealth)

**Files:**
- Modify: `src/lib/pyodide/scripts/yogas.py`
- Test: `tests/python/test_yogas.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/python/test_yogas.py`:

```python
from yogas import _dhana


def test_dhana_fires_when_2nd_and_11th_lords_associate():
    # 2nd lord (Jupiter) and 11th lord (Mars) conjoin in H1.
    ctx = _ctx({"Jupiter": {"house": 1}, "Mars": {"house": 1}},
               lords={2: "Jupiter", 11: "Mars"})
    assert _dhana(ctx) is True


def test_dhana_absent_when_no_association():
    ctx = _ctx({"Jupiter": {"house": 1}, "Mars": {"house": 6}},
               lords={2: "Jupiter", 11: "Mars"})
    assert _dhana(ctx) is False


def test_dhana_absent_when_same_lord():
    ctx = _ctx({"Jupiter": {"house": 1}}, lords={2: "Jupiter", 11: "Jupiter"})
    assert _dhana(ctx) is False
```

- [ ] **Step 2: Run to verify they fail**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -k dhana -v`
Expected: FAIL (`ImportError`).

- [ ] **Step 3: Implement the rule + register it**

In `src/lib/pyodide/scripts/yogas.py`, add:

```python
def _dhana(ctx):
    """Dhana (wealth) yoga: the lord of the 2nd (accumulated wealth) and the lord of
    the 11th (gains/income) are associated — conjunction, mutual aspect, or exchange."""
    l2, l11 = ctx["lords"].get(2), ctx["lords"].get(11)
    if not l2 or not l11 or l2 == l11:
        return False
    return _associated(ctx, l2, l11)
```

Register:

```python
YOGA_RULES.append({
    "id": "dhana_2_11", "name": "Dhana Yoga", "category": "Dhana",
    "description": "The lords of wealth (2nd) and gains (11th) combine — strong support for accumulating money and assets through the right channels.",
    "detect": _dhana,
})
```

- [ ] **Step 4: Run to verify they pass**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -k dhana -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pyodide/scripts/yogas.py tests/python/test_yogas.py
git commit -m "feat: add Dhana (wealth) yoga from 2nd/11th lord association"
```

---

### Task 7: Integration verification

**Files:**
- Test only (no new production code unless a gap is found).

- [ ] **Step 1: Confirm the registry grew to 25 rules and stays well-formed**

Add to `tests/python/test_yogas.py`:

```python
def test_registry_has_all_new_families():
    ids = {r["id"] for r in YOGA_RULES}
    assert {"raja_kendra_trikona", "viparita_harsha", "viparita_sarala",
            "viparita_vimala", "neecha_bhanga", "dhana_2_11"} <= ids
    assert len(YOGA_RULES) == 25  # 19 from P1a + 6 new
```

- [ ] **Step 2: Run the full Python suite**

Run: `.venv-test/bin/python -m pytest tests/python -v`
Expected: all PASS.

- [ ] **Step 3: Sanity-check on real charts (no crash, unique names, well-formed)**

Run: `.venv-test/bin/python -m pytest tests/python/test_yogas.py -k "real_chart or roundtrips or wellformed" -v`
Expected: PASS (every active yoga has non-empty name/category/description; names unique).

- [ ] **Step 4: JS suite, lint, build**

Run: `npx vitest run` → all PASS.
Run: `npm run lint` → 0 errors (warnings unchanged from baseline of 9).
Run: `npm run build` → succeeds.

- [ ] **Step 5: Commit any test-only additions**

```bash
git add tests/python/test_yogas.py
git commit -m "test: verify P1b yoga registry integration (25 rules)"
```

---

## Self-Review

**1. Spec coverage:** P1b families from the parity design — generalized Raja (Task 3), Viparita Raja Harsha/Sarala/Vimala (Task 4), Neecha Bhanga (Task 5), Dhana (Task 6) — all covered. The dignity-vocabulary bug (discovered while grounding this plan) is fixed in Task 1 as a prerequisite, since the new own-sign-sensitive logic and the existing own-sign yogas both depend on it.

**2. Placeholder scan:** Every code step contains full code. No TBD/TODO. Test assertions are concrete with stated expected results.

**3. Type consistency:** `_associated(ctx, a, b)`, `_aspects(ctx, giver, receiver)`, `_parivartana(ctx, a, b)`, `_viparita(ctx, lord_house)`, `_kendra_from(ctx, planet, anchor_house)`, `_raja_kendra_trikona(ctx)`, `_neecha_bhanga(ctx)`, `_dhana(ctx)` — signatures consistent between definition and call sites. Constants `KENDRAS`, `TRIKONAS`, `DUSTHANAS`, `NODES`, `STRONG_DIGNITIES` already exist in yogas.py; `OWNED_SIGNS` and `EXALTED_IN_SIGN` are newly added. `SIGN_LORD` is newly imported from adapter. All detect functions take a single `ctx` arg as the registry requires (Viparita uses lambdas to bind the house number).

**Scope notes deferred to later phases:** Raja yoga reports a single rolled-up entry (not one per lord pair); broader Dhana combinations (5th/9th lords, multiple dhana houses) and additional Neecha Bhanga clauses (dispositor exalted, debilitated planet conjunct dispositor) are intentionally omitted to avoid false positives and can be added later. Net-additive: no P1a yoga is removed or weakened — only the dignity fix *enables* previously-dead own-sign detection.
