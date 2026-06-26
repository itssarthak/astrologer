# Tool-Response Meaning Enrichment — Design

**Date:** 2026-06-26
**Status:** Design — awaiting implementation plan
**Owner:** Ask My Astro

## Problem

The engine computes every *quantitative/positional* astrology fact (placements, dignity,
strength, dasha dates, ashtakavarga bindus, yogas, doshas, transits, numerology numbers) and
feeds it to the LLM via context (`src/lib/prompts/formatters.js`) and tools
(`src/lib/llm/tools.js`). The model is explicitly forbidden from inventing these
(`src/assets/soul.md` "Core principle"; `src/lib/llm/tabConfig.js` `TOOL_GUIDANCE`).

But the *interpretive primitives* a reading is built from are **not** supplied — the model pulls
them from training:

- **House significations** — what the 7th / 10th / 2nd house governs. Largest, most-used gap.
- **Planet karakas & nature** — Venus = love/spouse, Saturn = discipline/delay. (These already
  exist in `src/lib/llm/reference.js` `PLANETS`, but are not attached to tool outputs.)
- **Divisional-chart read-guide** — what a varga signifies / how to weigh a planet in it.
  (`DIVISIONALS` exists in `reference.js`, not attached to `get_divisional` output.)
- **Sign natures** — the temperament of each rasi.
- **Numerology number meanings** — trait meaning of a driver/destiny number 1–9. (Ruling planet
  and Cheiro *compound* meanings already ship from `numerology.py`; the single-digit 1–9 trait
  meaning is the gap.)
- **Dignity-effect text** — what "debilitated" / "exalted" does to a planet's results.

The goal: **feed the model the sourced primitives so it never invents a fact, while leaving the
synthesis to the model so readings stay alive.**

## Core principle — atomic facts, never pre-baked synthesis

Attach the **atomic** sourced building blocks, but never the merger.

- "Venus" has a sourced karaka. "7th house" has a sourced signification. "debilitated" has a
  sourced effect. Feed all three as **separate, labeled facts**.
- "Venus debilitated in the 7th" is a **third thing** that emerges from merging them. That merge
  stays the model's job. Two factors can each point one way and combine into something different;
  hardcoding the combination would both explode combinatorially and make every reading canned.

**Structural guarantee:** every annotation helper looks up exactly **one primitive at a time**
(this house, *or* this planet, *or* this number) and returns it as its own field. No function
anywhere accepts a `(planet, house, sign)` tuple and returns a combined meaning. The merge is
therefore impossible to hardcode — it always falls to the model.

This is the line between "never hallucinate astrological facts" (CLAUDE.md) — now enforced for
interpretive primitives too — and "code computes, you interpret" (soul.md) — interpretation, i.e.
the merge, remains the model's.

## Approach (chosen: A — JS reference + tool-layer annotation)

Extend the existing JS reference module and annotate at the tool-return layer. Python compute
scripts are **untouched** (no `worker.js` / `vite.config.js` script registration, no Pyodide
round-trip). Rejected alternative B (enrich inside `.py` scripts) tangled static classical
reference into compute code and was the heavier change; `reference.js` is already described in-file
as "a fact source, not interpretation," making it the natural home.

### 1. Reference tables — `src/lib/llm/reference.js`

Add atomic, sourced, conservative tables (matching the existing `PLANETS` / `DIVISIONALS` style):

- `HOUSES` — keys `1`–`12`, each `{ signifies: <classical karakatvas>, classification: 'kendra'|'trikona'|'dusthana'|'upachaya'|null }`. The classifications already exist as glossary terms; this attaches them per-house.
- `SIGNS` — keys `Aries`…`Pisces`, each `{ element, quality, ruler, nature: <one-line temperament> }`.
- `NUMEROLOGY_NUMBERS` — keys `1`–`9`, each `{ ruler, traits: <one-line meaning> }` (single-digit trait gap; complements the ruler + Cheiro compound meaning already shipped by `numerology.py`).
- `DIGNITY_EFFECT` — keys matching jyotishganit's dignity strings (`own_sign`, `exalted`, `deep_exaltation`, `debilitated`, `deep_debilitation`, `moolatrikona`, `neutral`), each a one-line effect on the planet's results.

`PLANETS` (karaka + nature) and `DIVISIONALS` (signifies + standard flag) already exist and are reused.

Add small accessor helpers next to `lookupReference`, e.g. `houseMeaning(n)`, `signMeaning(s)`,
`numberMeaning(n)`, `dignityEffect(s)`, `planetKaraka(name)` — each returns one primitive or
`undefined`. These keep the lookups atomic and make the tool layer read cleanly.

`astro_reference` (the lookup tool) also gains coverage of the new tables so the model can confirm
a house/sign/number/dignity meaning on demand, not only receive it pre-attached.

### 2. Tool-layer annotation — `src/lib/llm/tools.js`

Attach the relevant primitive(s) to each tool's return, as **separate labeled fields** (never a
merged sentence):

- `get_chart` / `compute_chart` (`planetLines`) — each planet line keeps `sign / house / dignity / strength / retrograde` and gains `karaka` (planet) + `house_meaning` (house) + `dignity_effect`. Implementation note: `planetLines` currently returns plain strings; it becomes structured objects (or string + parallel meanings) — keep the existing fields, add the meanings.
- `get_divisional` — response gains `signifies` (the varga's meaning, from `DIVISIONALS`) and a short `how_to_read` note; each occupant gains its planet `karaka`. The error paths already cite `DIVISIONALS` — unchanged.
- `get_dasha` — each period lord (current maha/antar/pratyantar + timeline entries) gains the lord's `karaka` so the model can read what themes the period tends to time. Atomic: planet karaka only, not "Saturn period in the 7th means…".
- `get_ashtakavarga` — strongest/weakest signs gain the `sign nature`; add a one-line note that high bindu = stronger results for that sign's matters (generic, not per-life-area-merged).
- `get_today_transit` / `get_varshaphal` — placements gain planet `karaka`; varshaphal's varsha-lagna and muntha gain `house_meaning` / `sign nature` as applicable.
- `compute_numerology` — driver and destiny numbers gain `traits` from `NUMEROLOGY_NUMBERS` (ruler + Cheiro compound already present).
- `numerology_compatibility` — already returns ruler relation; optionally attach each number's `traits`. Low priority.

Yogas (`get_yogas`) and doshas (`get_doshas`) **already** carry sourced `description` / `text` from
the Python engine (`yogas.py`, `doshas.py`) — left as-is.

### 3. Formatters (context path) — `src/lib/prompts/formatters.js`

The Chart/Today/Match tabs inject computed data directly into the system prompt via these
formatters, bypassing tools. To keep parity (model sees the same primitives whether it reads
context or calls a tool), `formatChartContext` placements gain `house_meaning` + `karaka` +
`dignity_effect`, drawn from the same reference accessors. `formatNumerologyContext` gains number
`traits`. (Decision point for plan: keep these terse so context doesn't bloat — one short clause
per primitive.)

### Tone unaffected

These enrichments feed the model's **private reasoning** only. The existing tone gates
(`TOOL_GUIDANCE`, `LAYMAN_REMINDER`, soul.md Tone section) still forbid surfacing house numbers,
karakas, Sanskrit, chart codes in the reply. The model translates primitives → plain effect-first
language as today; it simply no longer has to *invent* the primitives.

## Out of scope

- **UI surfacing** of these meanings (tooltips etc.) — deferred. The meanings are static reference,
  not per-user computed data, so CLAUDE.md's agent↔UI sync rule does not strictly apply. Agent side
  only this round.
- **Python compute changes** — none.
- **Nakshatra meanings** — deferred unless a later pass needs them; keeps this round bounded.
- **Pre-merged / combination meanings** — explicitly forbidden by the core principle.

## Sourcing

All new table content comes from sourced classical definitions (BPHS-tradition house
karakatvas, standard sign natures, Cheiro/Sepharial for numbers), consistent with soul.md's
"never hallucinate astrological facts" and CLAUDE.md "rules come from sourced classical
definitions." Entries stay one-line and conservative — the existing `reference.js` bar.

## Testing

- **Unit (`npx vitest run`):** new accessor helpers return the right primitive for valid keys and
  `undefined` for unknown keys; `lookupReference` returns the new tables; each annotated tool
  includes the expected meaning fields and **omits** any merged/combined meaning field (guard the
  atomic principle); tone-gate tests unaffected.
- **Reference completeness:** assert every house 1–12, sign, number 1–9, and dignity string used by
  the engine has an entry (no silent gaps).
- **Full suite before merge:** `npx vitest run`, `npm run lint` (0 errors), `npm run build`; Python
  suite unaffected but run `.venv-test/bin/python -m pytest tests/python` to confirm no regression;
  `npx playwright test` for the two e2e flows.

## Documentation

- This spec.
- Update `CLAUDE.md` if the reference-enrichment pattern becomes a standing convention (e.g. a note:
  "tool responses attach atomic sourced meanings from `reference.js`; never pre-merge them").
- `src/lib/llm/toolLabels.js` unchanged (no new tools); `astro_reference` description updated to
  mention the added coverage.
