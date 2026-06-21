# Lo Shu Grid + Numerology Matchmaking — Design

Date: 2026-06-21
Status: Approved for planning

## Goal

Add two capabilities to the (currently number-only) numerology feature, wiring both ends
(compute → agent → UI) per `CLAUDE.md`:

1. **Lo Shu grid** in the Numbers tab — a populated 3×3 grid with missing/repeated numbers,
   planes, and arrows.
2. **Numerology compatibility** in the Match tab — a separate, clearly-labelled panel sitting
   alongside (never blended into) the canonical 36-point Guna Milan.

## Governing constraint — sourcing discipline (`CLAUDE.md`: never hallucinate)

- We adopt **one** convention and never blend traditions. The grid is the authentic Lo Shu
  magic square with fixed home cells:

  ```
   4 | 9 | 2
  ---+---+---
   3 | 5 | 7
  ---+---+---
   8 | 1 | 6
  ```

- **Structural facts are geometry, not claims**: which three cells form a row/column/diagonal
  is a property of the magic square, not an interpretive assertion.
- **Number meanings are grounded in the app's existing planet rulers** (`PLANET_RULER` in
  `numerology.py`: 1=Sun … 9=Mars). We do not import unsourced "pop-numerology" prose. Plane and
  arrow labels are structural; any short interpretive phrase attached to them derives from the
  planet groupings the app already trusts.
- **No unsourced lookup tables.** The driver–conductor dimension reuses the existing
  `planet_relation` / NAISARGIKA friendship table rather than a published number-compatibility
  grid (see §3).
- The match's numeric score is **explicitly labelled "indicative, non-classical"** everywhere it
  appears (UI panel, tool output, agent context). It never mixes into the Guna Milan score.

## Edge-case rules (fixed, not optional)

- `0` is never placed — it has no home cell.
- Master numbers (11/22/33) from mulank/bhagyank are reduced to a single digit before placement.
- Kua is year-+gender-derived; for gender `other` or unspecified it is **omitted** and the result
  notes "Kua omitted (requires male/female)". The grid still renders from the remaining digits.
- A plane/column/diagonal counts as an **arrow of strength** only when all three of its cells are
  present, and an **arrow of weakness** only when all three are absent.

## 1. Grid input

The grid is populated from: **every digit of the DOB (DD-MM-YYYY) + Mulank (driver) + Bhagyank
(conductor) + Kua**, subject to the edge-case rules above. Mulank, Bhagyank, and Kua are already
computed (or computable) inside `numerology.py`.

## 2. Compute layer — `src/lib/pyodide/scripts/numerology.py`

No new script file, so no `worker.js` / `vite.config.js` registration is required.

- **`compute_kua(year, gender)`** → int | None. Standard year-digit-sum formula, gender-dependent;
  returns `None` for `other`/unspecified.
- **`compute_loshu_grid(dob, gender)`** → dict:
  ```jsonc
  {
    "counts": {"1": 1, "2": 0, ... "9": 2},   // home-cell tallies
    "missing": [2, 7],
    "repeated": [9],                            // count >= 2 ("strengthened")
    "kua": 4,                                   // or null, with "kua_note"
    "planes":   [{"name": "Mental",   "cells": [4,9,2], "state": "full|partial|absent"}, ...],
    "columns":  [{"name": "Will",     "cells": [9,5,1], "state": "..."}, ...],
    "diagonals":[{"name": "...",      "cells": [4,5,6], "state": "..."}, ...],
    "arrows_strength": ["Will (9-5-1)"],        // fully-present lines
    "arrows_weakness": ["Action (2-7-6)"]       // fully-absent lines
  }
  ```
- **`compute_numerology(full_name, dob, gender=None, name_in_use=None)`** gains a `gender` param and
  a new `"loshu"` key in its return. `AddProfileModal` starts passing `formData.gender`.
- **`compute_numerology_match(a, b)`** — takes two profiles' numerology inputs (name, dob, gender)
  and returns three grounded blocks plus an aggregate:
  ```jsonc
  {
    "core":   {"mulank": {...relation}, "bhagyank": {...}, "life_path": {...},
               "rating": "Harmonious|Mixed|Challenging"},
    "driver_conductor": {                         // CROSS comparison, via planet_relation
        "a_driver_vs_b_conductor": {...}, "b_driver_vs_a_conductor": {...},
        "rating": "..."},
    "grid": {"a_missing_filled_by_b": [...], "b_missing_filled_by_a": [...],
             "shared_strengths": [...], "combined_arrows": [...], "rating": "..."},
    "indicative_score": 7,        // /10, labelled non-classical
    "indicative_label": "indicative, non-classical",
    "summary_rating": "Mixed"
  }
  ```
  Each dimension's rating derives from the friend/neutral/enemy verdicts (and, for `grid`, the
  degree of complementarity). The `indicative_score` is a transparent, documented aggregation of
  the three dimension ratings — not a claim of classical authority.
- `*_json` wrappers added to mirror the existing `compute_*_json` pattern.

## 3. Driver–conductor dimension (why no external table)

The user asked for a driver–conductor comparison distinct from the like-for-like core comparison.
To stay grounded, this dimension is a **cross-pairing**: A's driver vs B's conductor, and A's
conductor vs B's driver, each evaluated through the existing `planet_relation` NAISARGIKA table.
This is distinct from the core block (which compares driver↔driver, conductor↔conductor,
life-path↔life-path) and requires no unsourced data.

## 4. Agent wiring (keep both ends in sync)

- **Formatter** (`src/lib/prompts/formatters.js`): the numerology formatter is extended to render
  the Lo Shu grid (counts, missing, repeated, planes, arrows) so chat can read everything the
  Numbers tab shows.
- **Tools** (`src/lib/llm/tools.js`):
  - `compute_numerology` execute() starts passing gender (so its output carries `loshu`).
  - **New `numerology_match` tool** — inputs are two *people*
    (`full_name_a/dob_a/gender_a`, `full_name_b/dob_b/gender_b`); returns
    `compute_numerology_match`. Kept **separate** from `numerology_compatibility` because that
    primitive takes two bare numbers; a single tool accepting either numbers or people would give a
    light LLM two conflicting input shapes.
  - `numerology_compatibility` is unchanged (low-level primitive; agent-only helper).
- **`src/lib/llm/toolLabels.js`**: add a label for `numerology_match`.

## 5. UI surfaces

### Numbers tab — Lo Shu panel (`src/components/Tabs/NumbersTab.jsx`)
Rendered entirely from `numerology.loshu` (data-driven, no hardcoded subsets):
```
Lo Shu Grid
 ┌─────┬─────┬─────┐
 │  4  │ 99  │     │   each cell shows the digit repeated by its count
 ├─────┼─────┼─────┤
 │ 33  │  5  │     │
 ├─────┼─────┼─────┤
 │  8  │  1  │  6  │
 └─────┴─────┴─────┘
 Missing: 2, 7   ·   Repeated (strong): 3, 9   ·   Kua: 4
 Planes:  Mental ✓   Emotional —   Practical ✓
 Arrows of strength: Will (9-5-1)   ·   Arrows of weakness: Action (2-7-6)
```
When Kua is omitted, the panel shows the note instead of a Kua value.

### Match tab — Numerology Compatibility panel (`src/components/Tabs/MatchTab.jsx`)
A **separate** section from Guna Milan, driven by `compute_numerology_match`:
- the **indicative /10 score**, badged "indicative, non-classical",
- the three dimension ratings (Core / Driver–Conductor / Grid) each with a one-line explanation,
- the grid-complementarity readout (what each partner supplies to the other, shared strengths).

## 6. Migration — no profile re-entry

Existing saved profiles store numerology JSON without `loshu` (and computed without gender). We
**recompute numerology lazily**: when a tab needs it, recompute from the profile's stored
`name`/`dob`/`gender` so older profiles gain the grid without re-entry. Exact call site (tab-level
recompute vs `migrateProfile`) is finalised during planning; the spec commits to **no re-entry
required** and to using the profile's already-stored gender.

## 7. Testing

- **Python golden tests** (`tests/python`): known DOB → exact `counts`/`missing`/`repeated`/arrows;
  Kua values for male, female, and `other` (None); master-number reduction and `0`-skip rules;
  deterministic `compute_numerology_match` output for fixed pairs, including the cross-pairing
  driver–conductor logic.
- **JS unit** (`npx vitest run`): Numbers-tab Lo Shu panel and Match-tab numerology panel render
  from computed data (not hardcoded), including the Kua-omitted branch.
- **Match e2e** (`npx playwright test`): the numerology panel appears alongside Guna Milan with the
  indicative-score badge.
- Gates before merge: `npm run lint` (0 errors) and `npm run build`.

## Out of scope

- Per-number long-form interpretive essays beyond the planet-grounded phrasing.
- Any blending of numerology into the canonical Guna Milan score.
- Collecting new birth-data fields (gender already exists).
