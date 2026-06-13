# AskMyAstro → WhatsApp-Agent Parity — Design Spec

**Date:** 2026-06-13
**Status:** Approved (design); pending spec review → implementation plan
**Goal:** Bring the askmyastro.in web app's astrology/numerology capabilities to at least
parity with the personal WhatsApp `astro` agent (homeagent-migration-bundle), then improve.

---

## 1. Background & problem

The web app's astro agent was ported from the personal WhatsApp `astro` agent. The **persona
(`soul.md`) transferred faithfully**, but the **capability depth did not**. The WhatsApp agent's
depth came from a two-layer setup:

- **Computation:** `jyotishganit` (chart calc, NASA JPL DE421, pure-Python/skyfield) **+ PyJHora**
  (yogas, doshas, Ashtakoota, Tajaka/Varshaphal — Swiss-Ephemeris based).
- **Interpretive knowledge:** curated skill prose (yoga meanings, orb-weighting rules,
  compound-number tables, dosha exception clauses, reading procedure).

The web app kept `jyotishganit` (running in a Pyodide Web Worker) but **dropped PyJHora and the
interpretive knowledge**, reimplementing only a thin subset by hand:

| Capability | WhatsApp agent | Web app today | Source file |
|---|---|---|---|
| Chart calc (D1–D60, dasha, panchanga) | jyotishganit | jyotishganit (computed, mostly unsurfaced) | `chart.py` |
| Yogas | ~6,500 evaluated (PyJHora), ~30 active | **13 hand-coded** | `yogas.py` |
| Planetary strength | Shadbala + full dignity ladder | `_is_strong` = exalted/own only | `yogas.py:36` |
| Doshas | 8 (PyJHora, with exceptions) | 5 (heuristic) | `doshas.py` |
| Aspects (graha drishti) | full, with orbs | **none** | — |
| Synastry | 14-section deep cross-check + Varshaphal + J–S axis | Guna Milan + simple overlays | `synastry.py` |
| Numerology | driver, name-in-use, compound numbers, rulers, pairs | life-path/destiny/soul/personality/personal-year | `numerology.py` |
| Daily transit | dominant-transit prioritization logic | raw planet→house dump | `transit.py` |

Net effect: the model now improvises interpretation from its own training instead of reading
authoritative computed facts — the "less depth" the user observes, despite `soul.md` saying
"never guess."

---

## 2. Decisions (locked)

1. **Compute stays client-side** in the existing Pyodide Web Worker. Preserves the app's privacy
   model (PrivacyBadge, "nothing leaves your device"). **No backend.**
2. **Restore both layers:** computation **and** a co-located interpretive knowledge layer
   (Approach 1 — see §4).
3. **Web-app surfaces only.** No proactive push (the WhatsApp 7am cron) and no PDF export in this
   effort. Parity = in-app capability depth.
4. **Yoga/dosha engine: clean-room reimplementation, app stays proprietary.** We do **not** ship
   PyJHora code. We **may reference** PyJHora's source to understand rule definitions and **use it
   offline as a black-box test oracle**, but we **write our own implementation in our own
   structure** — no verbatim porting. Rationale: the astrological rules themselves are
   public-domain classical facts (BPHS etc.); PyJHora's *code expression* is AGPL-3.0, and
   vendoring or verbatim-translating it would make the app a combined work obligated to ship under
   AGPL. (Not legal advice; practical risk posture.)

---

## 3. Feasibility findings (grounded in source)

Investigated `pyjhora-4.8.7` source directly:

- `horoscope/chart/yoga.py` is **12,990 lines / 233 yoga rules**. Each rule has a pure
  `..._from_planet_positions(planet_positions)` variant (**239 total**) that does only
  list/house logic — **no ephemeris at detection time**.
- The Swiss-Ephemeris coupling is shallow and avoidable: `const.py`'s `swe.*` are **planet-ID
  integers** (Sun=0…), replaceable with literals; `utils.py`/`house.py` only touch
  `swisseph`/`drik` inside the chart-*computation* paths (`_from_jd_place`), which we don't use
  because **`jyotishganit` already computes the chart in-browser**.
- Therefore the full classical rule logic is reproducible in pure Python over `jyotishganit`'s
  output, with **no Swiss Ephemeris and no WASM build**. We reimplement these rules ourselves
  (clean-room, per Decision 4), using PyJHora as reference + oracle only.

**Verification (RESOLVED 2026-06-13):** ran the in-browser `jyotishganit` build (`.venv-test`,
v0.1.3) against a known chart. It already emits, per planet occupant:
`dignities.dignity`, full 6-part `shadbala` (incl. `Shadbala.{Total, Rupas, MinRequired,
MeetsRequirement}`), `aspects.{gives,receives}` (graha drishti, `aspect_type` ∈ "3"/"7"/"10"/etc.,
keyed `to_house`/`to_planet`), and `conjuncts`. Top-level it emits `dashas.all.mahadashas →
antardashas → pratyantardashas` (full Vimshottari tree with dates) + `dashas.balance`,
`divisionalCharts` (d2,d3,d4,d7,d9,d10,d12,d16,d20,d24,d27,d30,d40,d45,d60), and `ashtakavarga`.
House occupants also carry `aspectsReceived`, `bhavaBala`, `lord`, `lordPlacedHouse`,
`lordPlacedSign`.

**Consequence:** the "missing depth" is overwhelmingly a **surfacing + annotation problem, not a
computation one**. `dignity.py` and `aspects.py` are **thin surfacing layers** (extract + add
degree-orbs from `signDegrees`), not reimplementations. The repo's crude `_is_strong`
(exalted/own only) simply ignored data that was already present. Shadbala/dignity/aspects/dasha/
divisionals require no Swiss Ephemeris and no new computation.

---

## 4. Architecture

All compute lives in `src/lib/pyodide/scripts/`. The defining rule (**Approach 1**): every
computer returns **self-describing JSON — facts + co-located interpretive annotations** (meaning,
strength, orb class, exception status). Reference tables live in Python next to the compute.

```
jyotishganit chart JSON
        │
        ▼
   adapter.py  ──►  internal positions structure (single source of truth)
        │
        ├──► dignity.py   (strength foundation: surface jyotishganit OR compute)
        ├──► aspects.py   (graha drishti + orbs + tightness legend)
        │
        ├──► yogas.py     (clean-room RULE REGISTRY, grows toward full corpus)
        ├──► doshas.py    (RULE REGISTRY: 8 doshas + exception clauses)
        ├──► numerology.py(Cheiro + Pythagorean, full set + compound tables)
        ├──► synastry.py  (Guna Milan + deep cross-check sections)
        └──► varshaphal.py(solar-return + Tajaka yogas)  [P3]
                 │
                 ▼
        src/lib/llm/tools.js  (tool surface: get_chart, get_divisional,
                               match_profiles, get_today_transit,
                               compute_numerology, get_varshaphal)
                 │
                 ▼
        buildSystemPrompt() + compact `reading-procedure` knowledge block
```

### 4.1 Module responsibilities

- **`adapter.py` (new)** — Convert jyotishganit chart JSON → one internal positions structure
  (`{planet: {sign, sign_idx, house, longitude, nakshatra, pada, retro, dignity, strength}}`).
  Single source of truth for shape; isolates every rule module from jyotishganit's JSON quirks.
  Also supplies divisional-chart positions (D9 etc.) on request.
- **`dignity.py` (new — thin surfacing layer)** — Read `dignities.dignity` and
  `shadbala.Shadbala.{Rupas, MinRequired, MeetsRequirement}` straight off jyotishganit's output and
  expose a clean `{dignity, rupas, min_required, meets, is_strong}` per planet. No computation of
  friendship/shadbala (jyotishganit already does it). Foundation consumed by yogas/synastry.
- **`aspects.py` (new — thin surfacing layer)** — Read jyotishganit's per-planet
  `aspects.{gives,receives}` (already-computed graha drishti, `aspect_type` + `to_house`/`to_planet`)
  and `conjuncts`; add the degree-orb + tightness legend (≤3° tight / 3–7° active / 7–10° loose /
  >10° noted) computed from `signDegrees`. Provides `aspects_to(planet)` and `orb_within_sign`.
- **`yogas.py` (rewrite as registry)** — Each rule: `{id, name, category, detect(positions, ctx)
  → {present, strength}, meaning}`. Clean-room implementations from classical definitions,
  validated against the oracle. Prioritized coverage (see §6), additive growth toward the full
  corpus. Categories: Pancha Mahapurusha, Chandra, Surya, Raja (incl. Viparita, Neecha Bhanga),
  Dhana, negative (Kemadruma, Shakata, Daridra).
- **`doshas.py` (expand to registry)** — 8 doshas: Manglik (classical exceptions + match-time
  mutual cancellation), Kala Sarpa (partial/with-exit), Pitru, Guru Chandala, Ganda Moola
  (pada-level escape), **Kalathra, Ghata, Shrapit**. Each → present/cancelled/exception-reason/
  severity/meaning; remedies **colour-only** per `soul.md`.
- **`numerology.py` (expand)** — Add Driver/Mulank, Name-in-use, compound numbers (two-digit
  pre-reduction + Cheiro meaning tables incl. warning set 13/14/16/26/43/44), planet-ruler per
  number, number-pair compatibility, master-number dual reading.
- **`synastry.py` (expand)** — Keep Guna Milan (already solid). Add: dignity-weighted house
  overlays, karaka cross-check, 7H + 7H-lord state, dasha overlap (now +12mo, JSON walk of
  Vimshottari tree), Jupiter–Saturn axis cross-aspects (orbs + ⭐/⚠️ rating), scaffolded ranked
  contradictions (🔴/🟡/✅) with counter-strategies.
- **`varshaphal.py` (new, P3)** — Tajaka annual chart via solar-return search (cast charts until
  transiting Sun = natal Sun longitude; jyotishganit casts arbitrary instants, as `transit.py`
  proves), then annual lagna, year-lord, Muntha house, Ithasala/Eesarpha/Kamboola (applying/
  separating/Moon-involved aspects via `aspects.py`).
- **`transit.py` (expand)** — Add graha-drishti aspects to natal + dominant-transit ranking
  (2H pressure → node axis on 1/7 → Saturn aspects to lagna/luminaries → Jupiter/Venus
  counterweights → Moon = emotional weather), from the `daily-transit-read` skill.

### 4.2 Knowledge layer

- **Reference tables in Python**, co-located per module; concise meaning strings ride along in
  tool output, so results are authoritative on their own.
- **One compact `reading-procedure` block** appended in `buildSystemPrompt` (`src/lib/prompts/
  soul.js`) after `TOOL_GUIDANCE`: reading sequence (summary → personality skeleton → dasha
  chapter → top yogas → active doshas → Navamsa for marriage), weighting rules (tight orbs heavy ·
  Nadi/Bhakoot dominate raw Guna total · weigh yogas against dignity · Manglik over-diagnosed →
  check exceptions · don't over-claim Varshaphal), and the orb/severity legend. Kept small to
  protect the cached system block.

---

## 5. Tool surface (`src/lib/llm/tools.js` + schemas + `toolLabels.js`)

- **`get_chart` (expand)** — dignity-annotated planets; full Vimshottari chain
  (maha→antar→pratyantar); top yogas with meanings + strength; doshas with present/cancelled/
  exception. New optional `include: ['divisionals','ashtakavarga']`.
- **`get_divisional` (new)** — named varga; **D9 Navamsa** default, plus D2/D3/D7/D10/D12.
- **`match_profiles` (expand)** — full deep cross-check (Guna Milan + dignity-weighted overlays +
  karaka + 7H-lord + dasha overlap + Jupiter–Saturn axis + ranked contradictions).
- **`get_today_transit` (expand)** — graha-drishti aspects to natal + dominant-transit ranking.
- **`compute_numerology` (expand)** — driver/Mulank, name-in-use, compound numbers + meanings,
  ruler, pair-compatibility.
- **`get_varshaphal` (new, P3)** — annual cross-compare for one/two profiles.

Each new/changed tool: JSON-schema update + `toolLabels.js` chip label for the live ToolChips UI.

**Constraint — tool-result size:** `agent.js` truncates tool results to 6,000 chars
(`MAX_TOOL_RESULT_CHARS`). The deep cross-check exceeds this. Design synastry output **compact and
segmentable** (codes + short meanings; sections fetched on demand) rather than one fat blob.
Consider a per-tool cap override or section-fetch parameter for `match_profiles`.

---

## 6. Yoga coverage strategy

"All 6,500" in PyJHora is 233 base rules with per-rule variant expansion; the skill itself
filtered to ~30 active and a named shortlist. We build a **growing clean-room registry** rather
than a one-shot dump:

- **P1 priority set (~40–60 rules):** Pancha Mahapurusha; Gaja-Kesari, Chandra-Mangal, Adhi,
  Sunapha/Anapha/Durudhara, Kemadruma; Budha-Aditya, Vesi/Vasi/Ubhayachari; generalized Raja
  (kendra-trikona lord links), Viparita Raja (Harsha/Sarala/Vimala), Neecha Bhanga, Dharma-
  Karmadhipati, Lakshmi; Dhana yogas; Shakata/Daridra.
- **P4 growth:** extend the registry toward the full classical corpus, each rule individually
  testable against the oracle.

Registry design makes coverage additive: adding a rule = adding one entry + one test, no churn.

---

## 7. Testing — proving parity

- **Golden fixtures:** PyJHora used **offline as a black-box oracle** (dev-only venv, never
  shipped, never code-copied) to generate expected yoga/dosha/Guna-Milan outputs for a set of
  known charts. Plus the WhatsApp smoke values (Tanya: 11 Jul 1998 19:10 IST Agra → nakshatra
  Shravana; tithi Krishna Dwitiya; active doshas Pitru only / Manglik neutralised; ~30 active
  yogas incl. Hamsa, Sunapha).
- **Per-rule unit tests** (each yoga/dosha rule), **module tests**, and a **parity-fixture set** of
  N charts with expected outputs. CI gate: fixtures must match within tolerance before a phase
  ships.
- **Clean-room discipline:** implement from classical definitions; use PyJHora source for
  *understanding* rule definitions and as an output oracle, never copy its code.

---

## 8. Phasing (one spec, phased implementation plan)

- **P0 — Foundation & surfacing (verification DONE).** `adapter.py` (extract dignities/shadbala/
  aspects/conjuncts/lords into internal structure); `dignity.py` + `aspects.py` surfacing layers;
  golden-fixture harness (oracle + smoke values); **surface the already-computed depth via
  `get_chart` (dignity+shadbala-annotated planets, full dasha chain) and new `get_divisional`
  (D9 etc.)**. This phase ships a real user-facing win (the model finally sees strength, aspects,
  full dasha, Navamsa) with surfacing-only code.
- **P1 — Core reading depth (biggest felt win).** Yoga registry (priority set); doshas (8 +
  exceptions); numerology expansion; surface D9 + full dasha via `get_chart`/`get_divisional`;
  `reading-procedure` live.
- **P2 — Deep synastry.** Full `match_profiles` cross-check; handle the 6k-char cap.
- **P3 — Varshaphal/Tajaka.** `varshaphal.py` solar-return + tajaka yogas; `get_varshaphal` tool.
- **P4 — Post-parity / beyond.** Grow yoga registry toward full corpus; transit aspect-ranking
  refinements; then the "improve beyond parity" ideas.

Each phase ships: compute + co-located knowledge + tool surface + tests + parity-fixture check +
deploy.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| AGPL contamination from PyJHora | Clean-room: reference + oracle only, own implementation, no copied code. App stays proprietary. |
| jyotishganit lacks dignity/shadbala in-browser | RESOLVED — verified present (dignities, full shadbala, aspects, dasha tree, divisionals, ashtakavarga). Surfacing only. |
| Deep synastry exceeds 6k-char tool cap | Compact/segmentable output; per-tool cap override or section-fetch. |
| Pyodide payload growth (more Python) | Pure-Python text is modest; loaded in worker off main thread. Monitor bundle. |
| Varshaphal solar-return accuracy | Validate Varsha Pravesh dates/year-lord against oracle; flag as timing-context, not destiny. |
| Adapter mismatch (ayanamsa/indexing/nodes) | Validate adapter output against known charts before any rule module consumes it. |

---

## 10. Out of scope (this effort)

- Proactive notifications / daily cron push.
- PDF / printable report export.
- Any server-side compute.
- "Beyond parity" feature ideas (deferred to P4+ after parity is reached).
