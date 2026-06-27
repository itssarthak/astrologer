# Combined Lo Shu grid + joint plane / Raj-Yog completion

Date: 2026-06-27
Status: approved

## Problem

The Match tab now shows each partner's Lo Shu grid side-by-side, but nothing
shows the **combined** picture: which numbers each partner contributes, and which
Lo Shu lines (planes / columns / diagonals) the pairing *completes together* that
neither person had alone. Users specifically want a merged grid ("what comes from
where") and a Raj-Yog indicator (a jointly completed diagonal).

## Scope

A single combined grid plus a "completed together" list, rendered below the two
per-person grids in the Numerology Compatibility panel. Indicative, non-classical —
never blended into Guna Milan.

## Decisions (from brainstorming)

- **Combined grid visual:** one 3×3 grid (4-9-2 / 3-5-7 / 8-1-6). Each cell repeats
  its digit once per occurrence, colour-coded per person (A vs B). Empty = muted dot.
- **What to highlight:** only lines **newly completed by the union** — full in the
  merged grid but NOT full in either partner alone. This is the partnership's
  value-add, not pre-existing strengths.
- **Raj Yog:** a completed **diagonal** (4-5-6 or 2-5-8) carries a "Raj Yog" badge
  beside its sourced meaning; the section shows a top-line "Raj Yog: yes/none".
  Per the no-hallucination rule, the **agent context** names it precisely as
  *popular-numerology "Raj Yog" = a jointly completed Lo Shu diagonal within the
  indicative numerology layer*, so the LLM never conflates it with a classical
  Vedic Raja Yoga. The sourced planet-ruler meaning is what carries the actual effect.

## Architecture

Sourced line definitions and meanings stay in Python (`LOSHU_LINES` /
`LOSHU_LINE_MEANING`); the UI only renders. (Computing completions in JS was
rejected — it would duplicate sourced facts into the frontend.)

### Python — `numerology.py`

`compute_numerology_match` gains a `combined` block:

```
"combined": {
  "completed_lines": [
    {
      "name": "Mental plane (4-9-2)",
      "cells": [4, 9, 2],
      "meaning": "<sourced planet-ruler meaning>",
      "type": "plane" | "diagonal",   # all six rows+columns are planes
      "raj_yog": <bool, true for diagonals>,
      "from": [ {"number": 4, "source": "a"|"b"|"both"}, ... ]  # one per cell
    },
    ...
  ],
  "has_raj_yog": <bool>
}
```

Logic: build merged counts = a_grid.counts + b_grid.counts per digit. For each of
the 8 `LOSHU_LINES`, compute line state (`full` when all 3 cells > 0) for A alone,
B alone, and merged. Keep a line iff merged is `full` and neither A nor B alone was
`full`. `source` per cell: `both` if A and B both > 0, else `a` / `b`. `type`:
diagonal for the two "Diagonal …" lines, plane for the other six (three horizontal
+ three vertical — all are Lo Shu planes). `raj_yog = (type == "diagonal")`.
`has_raj_yog = any(raj_yog)`.

The combined grid cell counts need no new field — the UI derives the A|B split from
the existing `grid.a_grid.counts` and `grid.b_grid.counts`.

### UI — `CombinedLoShuGrid.jsx` (new, focused component)

Props: `aGrid`, `bGrid`, `combined`, `names` ([a, b]).
- Renders the 3×3 combined grid with per-person colour-coded digit copies.
- A legend mapping colour → name.
- "Completed together" list: each line shows its meaning, a type/Raj-Yog badge,
  and the per-cell "X from <who>" contributions. Raj-Yog top-line summary.
- Renders nothing if `combined` is absent (older cached matches).

Embedded in `NumerologyMatchPanel.jsx` below the two per-person grids.

### Agent context — `formatters.js`

`formatNumerologyMatchContext` appends the completed lines with honest framing of
"Raj Yog" as above, so agent ↔ UI stay in sync.

## Testing

- Python: a known DOB pair where a line is newly completed by the union — assert
  it appears with correct `type`, `raj_yog`, `from`; assert pre-completed lines are
  excluded; `has_raj_yog` correct.
- Component: combined grid renders, both names in legend, completed line + Raj-Yog
  badge render; renders null without `combined`.
- Formatter: context includes the completed-line text and the precise Raj-Yog framing.

## Out of scope

- Listing lines that were already complete for one partner.
- Any change to the classical Guna Milan / synastry path.
