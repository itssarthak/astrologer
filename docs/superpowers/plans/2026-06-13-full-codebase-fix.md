# Full Codebase Fix — Requirements & Execution Doc

> **Source:** Whole-project review (4 parallel subsystem reviews + manual verification), 2026-06-13.
> **Scope:** Fix every finding — correctness, security, duplication, UX, tests. Nothing left behind.
> **Goal:** Resolve all 36 catalogued items, each verified, with frequent commits.

**App context:** Browser-only ("bring your own API key", no backend) Vedic astrology assistant. React 19 + Vite + Tailwind; astrology math runs in-browser via Pyodide (Python/skyfield/jyotishganit → WASM). Optional AWS Lambda for the full yoga/dosha catalog.

**Test commands:**
- Unit: `npm test -- --run` (vitest) and `npx vitest run <file>`
- Python: `python -m pytest tests/python -q` (needs `.venv-test`; jyotishganit-dependent tests may skip)
- E2E: `npx playwright test` / `npx playwright test tests/e2e/<spec>.js`
- Lint: `npm run lint`

**Conventions:**
- Each item gets its own commit. Co-author trailer as configured.
- Verify before claiming done (run the relevant test/lint).
- Items marked **VERIFY-FIRST** require reading runtime shape before fixing.
- Items marked **JUDGMENT** are intentional simplifications — confirm intent, fix only if agreed; otherwise document and add a test pinning current behavior.

---

## Severity tiers & execution order

**Batch A — Security / correctness (do first):** A1 Gemini key in URL · A2 privacy copy · A3 Lambda field mismatch · A4 reactive routing guards · A5 D9 path (VERIFY-FIRST) · A6 max_tokens truncation · A7 abort cancels tool fetches + persists partial · A8 compute_transit lagna guard · A9 JS→Python string-boundary guard · A10 Gemini synthetic tool-id collision · A11 safeJSON silent arg-swallow · A12 geocode timezone staleness guard · A13 Pyodide init timer leak.

**Batch B — Duplication / dead code:** B1 single tool-name source · B2 useChatThread hook (5 tabs) · B3 shared providers module (ApiKeyModal/StepApiKey) · B4 OpenRouter default resolver · B5 delete dead useProfiles + test + unused refreshProfiles · B6 unify yoga/dosha output shape.

**Batch C — UX / hygiene / perf:** C1 chip dedup decision · C2 memoize providerSupportsTools · C3 memoize ProfilesContext value · C4 stable list keys · C5 error boundary · C6 onboarding step indicator · C7 StepComputing timeout · C8 AddProfileModal cancel · C9 BirthDetailsForm place-text reset · C10 prompt-injection framing · C11 Anthropic prompt caching · C12 delete local hip_main.dat · C13 CSP headers · C14 Pyodide Web Worker (largest; last).

**Batch D — Astrological accuracy (JUDGMENT):** D1 Yoni 14×14 matrix · D2 Vashya hardcode · D3 Manglik cancellation.

**Batch E — Test gaps:** E1 analytics PII-strip test · E2 Lambda JS-contract test · E3 keys malformed-JSON test · E4 transit invalid-lagna test · E5 dosha coverage (guru_chandala/pitru/ganda_moola/kala_sarpa boundary) · E6 replace waitForTimeout sleeps · E7 retries for CI.

---

## Batch A — Security / correctness

### A1 — Gemini API key leaks into URL query string
- **Severity:** High (security). **Files:** `src/lib/llm/agent.js:112`.
- **Problem:** Agent path builds `...generateContent?key=${key}`; URLs leak to history/proxy/referrer logs. Streaming client (`gemini.js:13`) already uses the `x-goog-api-key` header — inconsistent.
- **Fix:** Drop `?key=` from the URL; add `'x-goog-api-key': key` to the request headers in `runGeminiRound`.
- **Verify:** `grep -n "key=" src/lib/llm/agent.js` returns nothing; `npx playwright test tests/e2e/agent.spec.js` (Gemini path if covered) green; manual: gemini agent round still works.

### A2 — Privacy copy overstates reality
- **Severity:** High (trust). **Files:** `src/components/shared/PrivacyBadge.jsx:5`, `src/components/Onboarding/StepWelcome.jsx:19-20`.
- **Problem:** "100% private · stays on your device" / "Your birth data never leaves your device" is false: birth data goes to the chosen LLM provider; place query → Nominatim; coords → timeapi.io; if `VITE_PYJHORA_API_URL` set, full birth record → Lambda.
- **Fix:** Reword to accurate-but-reassuring: data stored locally; only sent to the services needed to answer (your chosen AI provider, geocoding, optional chart service); no analytics PII. Keep it short. Add a one-line disclosure near onboarding/privacy badge tooltip.
- **Verify:** Copy no longer claims "never leaves device"/"100% private"; `npx playwright test tests/e2e/onboarding.spec.js` still green (update any text assertions).

### A3 — Optional Lambda path is dead (field-name mismatch)
- **Severity:** Medium (dead feature). **Files:** `backend/handler.py:11,35,51` (`tz_offset`) vs `src/components/shared/BirthDetailsForm.jsx:45` (`timezone_offset`) sent via `src/hooks/usePyodide.js`.
- **Problem:** Form/JS sends `timezone_offset`; handler reads `body["tz_offset"]` → 400 → silent fallback to Pyodide. Lambda catalog never used. Handler tests pass because they hand-build `tz_offset`.
- **Fix:** Make handler accept both keys (`body.get("tz_offset", body.get("timezone_offset"))`) OR normalize on the JS side before POST. Prefer handler tolerance + JS sends canonical `tz_offset`. Pick one canonical name and align both sides.
- **Verify:** New contract test E2 (below) passing; `python -m pytest backend -q` green.

### A4 — Routing guards not reactive to key/profile state
- **Severity:** Medium. **Files:** `src/router.jsx:7-13,25-31`, `src/components/Sidebar/ApiKeyModal.jsx:46`.
- **Problem:** Guards read `getApiKey()` only at render with no subscription. Clearing the key from the sidebar doesn't redirect to onboarding; next send throws "No API key configured".
- **Fix:** Expose key/setup state via context (or a `useApiKey` hook with a storage-event + custom-event subscription) so guards re-render on change. Simplest: a small `KeyContext`/`useSetupState` that ApiKeyModal updates and router consumes. Fire a custom event on save/clear in `storage/keys.js`; subscribe in the guard.
- **Verify:** New e2e: configure key → clear from sidebar → app redirects to onboarding. `npx playwright test`.

### A5 — ChartTab D9 path shape (VERIFY-FIRST)
- **Severity:** Medium (possible always-null). **Files:** `src/components/Tabs/ChartTab.jsx:32` reads `chart?.divisionalCharts?.d9`; everything else uses `d1Chart.houses`.
- **Action:** Run a real chart compute, log the JSON keys, confirm the actual D9 nesting/casing. If `divisionalCharts.d9` is correct → no change (add comment). If different → fix the access path.
- **Verify:** `npx playwright test tests/e2e/chart-and-today.spec.js`; D9 sub-tab renders a chart for a real profile (or correctly shows "not available" only when truly absent).

### A6 — max_tokens 2048 truncates agentic answers
- **Severity:** Medium. **Files:** `src/lib/llm/agent.js:41,80` (and single-shot path in `index.js`).
- **Problem:** Final reading after tool calls can be cut off silently.
- **Fix:** Raise final-answer cap (e.g. 4096) — at minimum on the agentic path's answer rounds. Keep a named constant.
- **Verify:** Constant present; a long-answer agent e2e isn't truncated (manual/though hard to assert exactly — assert response length not equal to cap boundary). Lint + existing agent e2e green.

### A7 — Abort doesn't cancel in-flight tool fetches; useAgent drops partial output
- **Severity:** Medium. **Files:** `src/lib/llm/agent.js` (tool dispatch ~164-189), `src/lib/llm/tools.js` (`web_search`, `geocode_place`), `src/hooks/useAgent.js:53-63`.
- **Problem:** (a) `tool.execute` doesn't receive `signal`, so geocode/web_search fetches run to completion after abort. (b) On abort `useAgent` returns `''` and appends no assistant message — visible partial text lost (inconsistent with `useLLM.js:47-50`).
- **Fix:** Thread `signal` into `execute(args, { signal })` and pass to network tools' fetch. On `AbortError` in `useAgent`, persist whatever text streamed so far (mirror useLLM).
- **Verify:** `npx playwright test tests/e2e/stop.spec.js` green; add assertion that a stopped agent keeps partial text.

### A8 — compute_transit throws on unknown lagna
- **Severity:** Low-Med. **Files:** `src/lib/pyodide/scripts/transit.py:26` (`SIGNS.index(natal_lagna_sign)`), caller `src/lib/llm/tools.js:71`.
- **Problem:** Undefined/unexpected lagna → `ValueError` → unhandled rejection.
- **Fix:** Guard: if lagna missing/not in SIGNS, return a structured error dict instead of raising; JS surfaces it.
- **Verify:** New python test E4 passing; `python -m pytest tests/python -q`.

### A9 — No type guard at JS→Python string boundary
- **Severity:** Low-Med (regression class). **Files:** `src/lib/pyodide/index.js:139,149,170`.
- **Problem:** "Pass objects, we stringify once" enforced only by discipline; a future string arg re-introduces the past double-encode crash.
- **Fix:** Helper `asJson(x) => typeof x === 'string' ? x : JSON.stringify(x)` used at all marshalling points.
- **Verify:** Unit test (vitest) on the helper for object/string inputs; existing compute e2e green.

### A10 — Gemini synthetic tool-call IDs collide
- **Severity:** Low (edge). **Files:** `src/lib/llm/agent.js:131,106`.
- **Problem:** IDs `${name}_${i}`; Gemini matches `functionResponse` by name → duplicate same-tool calls in one turn can't be disambiguated.
- **Fix:** Preserve order and pair responses positionally for Gemini; ensure each call/response is matched by index, not just name. Document the constraint.
- **Verify:** Unit/e2e exercising two same-tool calls in one Gemini round (or at least a regression note + test if feasible).

### A11 — safeJSON swallows malformed tool args
- **Severity:** Low. **Files:** `src/lib/llm/agent.js:10-13`.
- **Problem:** Invalid JSON args → `{}` → confusing downstream error instead of surfacing parse failure.
- **Fix:** On parse failure, feed a tool error result back ("could not parse arguments for <tool>") instead of silently using `{}`.
- **Verify:** Unit test: malformed args produce an error tool-result, not a thrown profile error.

### A12 — geocode fetchTimezone no staleness guard
- **Severity:** Low. **Files:** `src/hooks/useGeocode.js:38`.
- **Problem:** Un-cancellable timezone fetch can resolve against a stale place selection.
- **Fix:** Track a request id / AbortController; ignore late responses for superseded selections.
- **Verify:** `npx vitest run tests/useGeocode.test.js` green; add a stale-response test.

### A13 — Pyodide init timers leak on failure
- **Severity:** Low. **Files:** `src/lib/pyodide/index.js:34,97-99`.
- **Problem:** `subSteps` timers cleared only on success; on `loadPyodide()` reject they fire stale messages.
- **Fix:** Clear timers in `finally` (or catch).
- **Verify:** Code review; existing pyodide-dependent e2e green.

---

## Batch B — Duplication / dead code

### B1 — Single source for tool names/labels/guidance
- **Files:** `src/lib/llm/tools.js` (schemas), `src/hooks/useAgent.js:8-19` (`TOOL_GUIDANCE`), `src/lib/llm/toolLabels.js` (two maps).
- **Fix:** Make `toolLabels.js` carry `{ active, past }` per tool (one map). Derive `TOOL_GUIDANCE` from the registry descriptions (or drop the redundant prose). Single keyed object; missing label fails loudly in dev.
- **Verify:** Adding a tool requires editing one place; lint + agent e2e (chip text) green.

### B2 — Extract useChatThread hook (5 duplicated tabs)
- **Files:** `src/components/Tabs/{ChatTab,ChartTab,NumbersTab,TodayTab,MatchTab}.jsx`.
- **Fix:** New `src/hooks/useChatThread.js` encapsulating messages state + streamingContent + handleSend + reload + clearChat + profile-change effect, parameterized by the send fn (useAgent vs useLLM). Refactor all five tabs onto it. Preserve each tab's specifics (ChatTab guards missing profile → fold into hook).
- **Verify:** Full e2e suite green (chart/today/match/numbers/chat/toolbar). No behavior change.

### B3 — Shared providers module
- **Files:** `src/components/Sidebar/ApiKeyModal.jsx`, `src/components/Onboarding/StepApiKey.jsx`.
- **Fix:** Extract `PROVIDERS`, `defaultModelFor`, `switchProvider`, validation into `src/lib/llm/providers.js`; both components import.
- **Verify:** `npx playwright test tests/e2e/{onboarding,openrouter,llm-custom}.spec.js` green.

### B4 — OpenRouter default resolver
- **Files:** `src/lib/llm/index.js:18-19`, `src/lib/llm/agent.js:155-156` (`OPENROUTER_BASE_URL` defined twice).
- **Fix:** One shared resolver (base URL + default model) in `providers.js`/`index.js`; import in both.
- **Verify:** `grep -rn OPENROUTER_BASE_URL src/` shows one definition; openrouter e2e green.

### B5 — Delete dead useProfiles + unused refreshProfiles
- **Files:** `src/hooks/useProfiles.js` (imported only by `tests/useProfiles.test.js`), `tests/useProfiles.test.js`, `src/contexts/ProfilesContext.jsx:40,46` (`refreshProfiles` unused).
- **Fix:** Delete `useProfiles.js` and its test (app uses ProfilesContext). Remove `refreshProfiles` from context value if no consumer; or wire it if intended. Confirm no import breaks.
- **Verify:** `grep -rn "useProfiles\|refreshProfiles" src/ tests/` clean; `npm test -- --run` green.

### B6 — Unify yoga/dosha output shape
- **Files:** `src/lib/pyodide/scripts/yogas.py`/`doshas.py` (`{name, description}`) vs `backend/handler.py` (`{name, category, planet}`); consumers in `ChartTab.jsx`.
- **Fix:** Define one canonical shape; map both sources to it (adapter on whichever side). Consumer handles a single shape.
- **Verify:** ChartTab renders yogas/doshas from both sources identically; python + e2e green.

---

## Batch C — UX / hygiene / perf

### C1 — Chip dedup decision
- **Files:** `src/hooks/useAgent.js:54`, `src/components/Chat/ChatMessage.jsx`.
- **Decision:** Dedup to one chip per distinct tool per answer (`[...new Set(usedTools)]`). Rationale: repeated identical chips read as noise.
- **Verify:** agent e2e chip assertion still green; multi-call case shows one chip.

### C2 — Memoize providerSupportsTools
- **Files:** `src/hooks/useAgent.js:76`.
- **Fix:** Compute from `keyData` once (useMemo) instead of reading localStorage every render.
- **Verify:** Lint; behavior unchanged.

### C3 — Memoize ProfilesContext value
- **Files:** `src/contexts/ProfilesContext.jsx:46`.
- **Fix:** `useMemo` the value object; memoize `activeProfile` derivation.
- **Verify:** `npm test -- --run tests/contexts.test.jsx` green.

### C4 — Stable list keys
- **Files:** `src/components/Chat/ChatMessages.jsx:14`, `ChatMessage.jsx:13`, `BirthDetailsForm.jsx:102`, `ChartTab.jsx:91`.
- **Fix:** Use stable keys (message id/timestamp+role; tool name; place_id; yoga name). Add ids to messages at append time in `storage/chat.js` if missing.
- **Verify:** Lint; e2e green.

### C5 — Error boundary
- **Files:** new `src/components/shared/ErrorBoundary.jsx`; wrap tab content in `MainApp.jsx`.
- **Fix:** Class error boundary with reload fallback so a bad chart shape doesn't white-screen the app.
- **Verify:** Manual: force a render throw → fallback shows; e2e green.

### C6 — Onboarding step indicator desync
- **Files:** `src/pages/Onboarding.jsx:16`.
- **Fix:** When key already exists and step 2 is skipped, indicator should reflect actual steps (don't jump 1→3 on a "Step X of 4" bar). Compute total/visible steps dynamically.
- **Verify:** onboarding e2e for returning-user path.

### C7 — StepComputing waitForPyodide timeout
- **Files:** `src/components/Onboarding/StepComputing.jsx`.
- **Fix:** Add a timeout to the poller → show error+retry instead of infinite spinner.
- **Verify:** Manual/e2e: simulated stall surfaces error.

### C8 — AddProfileModal cancel during compute
- **Files:** `src/components/Sidebar/AddProfileModal.jsx`.
- **Fix:** Allow cancel/close during compute; abort the in-flight work.
- **Verify:** Manual; e2e green.

### C9 — BirthDetailsForm place-text reset
- **Files:** `src/components/shared/BirthDetailsForm.jsx:21`.
- **Fix:** When typing clears `selectedPlace`, give a visible hint (e.g. helper text "select a place from the list") so the disabled submit is explained.
- **Verify:** `npx vitest run tests/BirthDetailsForm.test.jsx` green.

### C10 — Prompt-injection framing
- **Files:** `src/lib/prompts/soul.js` or `TOOL_GUIDANCE`.
- **Fix:** Add a line instructing the model to treat tool/web/geocode output as untrusted data, not instructions.
- **Verify:** Prompt contains the framing; e2e green.

### C11 — Anthropic prompt caching
- **Files:** `src/lib/llm/claude.js`, `src/lib/llm/agent.js` (Claude round).
- **Fix:** Add `cache_control: {type:'ephemeral'}` on the system prompt block for Claude to cut agentic-loop cost/latency.
- **Verify:** Request body includes cache_control; agent e2e green.

### C12 — Delete local hip_main.dat
- **Files:** working tree `hip_main.dat` (53MB, gitignored, not runtime-needed).
- **Fix:** `rm hip_main.dat` locally.
- **Verify:** `ls hip_main.dat` gone; `git status` clean.

### C13 — CSP headers
- **Files:** `vercel.json`.
- **Fix:** Add a `Content-Security-Policy` allowing required `connect-src` (jsdelivr, LLM hosts, Nominatim, timeapi, DuckDuckGo, GA) and tight `default-src`/`script-src`.
- **Verify:** App loads + all flows work on `npm run preview` with the header; no console CSP violations.

### C14 — Pyodide Web Worker (largest; do last)
- **Files:** `src/lib/pyodide/index.js`, `src/contexts/PyodideContext.jsx`, new worker.
- **Fix:** Move Pyodide init + computes into a Web Worker so chart math doesn't block the UI. (`vite.config.js` already has `worker.format:'es'`.)
- **Verify:** Full e2e suite green; UI responsive during compute. **If too large/risky, document and defer with a tracked note — do not half-migrate.**

---

## Batch D — Astrological accuracy (JUDGMENT — confirm before changing)

### D1 — Yoni koota uses numeric distance, not 14×14 matrix
- **Files:** `src/lib/pyodide/scripts/synastry.py:126`.
- **Action:** Implement the classical 14×14 friend/neutral/enemy yoni matrix (or confirm the approximation is acceptable). If keeping, add a test pinning current values + a comment noting divergence.

### D2 — Vashya hardcoded 2/2
- **Files:** `src/lib/pyodide/scripts/synastry.py:125`.
- **Action:** Implement real Vashya groupings, or document + pin with a test.

### D3 — Manglik cancellation coarse
- **Files:** `src/lib/pyodide/scripts/doshas.py:22-25`.
- **Action:** Refine cancellation rules or document + pin with a test.

> Default stance if no further input: implement D1 (clear correctness gain), document+pin D2/D3.

---

## Batch E — Test gaps

- **E1** Analytics PII-strip unit test — `src/lib/analytics.js` has none. Assert `trackEvent` drops `name/dob/time/lat/lon/key/chart/numerology`. New `tests/lib/analytics.test.js`.
- **E2** Lambda JS-contract test — assert the body shape the JS actually sends maps to handler-read keys (catches A3 class). Extend `backend/test_handler.py` and/or a JS-side test.
- **E3** keys malformed-JSON resilience — `getApiKey` try/catch untested. Add to `tests/lib/keys.test.js`.
- **E4** transit invalid-lagna — python test for A8 guard.
- **E5** dosha coverage — guru_chandala, pitru, ganda_moola, kala_sarpa boundary (planet on Rahu/Ketu axis).
- **E6** Replace `waitForTimeout` sleeps in `tests/e2e/llm-custom.spec.js:109,116` with web-first assertions.
- **E7** CI flakiness — set `retries: 1` for CI in `playwright.config.js` (keep 0 locally via `process.env.CI`).

---

## Done criteria
Every item above is either fixed+verified, or (for JUDGMENT/deferred) explicitly documented with a pinning test and a tracked note. Final gate: `npm run lint`, `npm test -- --run`, `python -m pytest tests/python -q`, and `npx playwright test` all green; `git status` clean.
