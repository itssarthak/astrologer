# CLAUDE.md — working rules for this repo (Ask My Astro)

Project: a client-side Vedic-astrology web app. Astrology/numerology is computed in-browser
(Pyodide + jyotishganit, `src/lib/pyodide/scripts/*.py`); a provider-neutral LLM agent answers
in chat using tools (`src/lib/llm/tools.js`); tabs (Today/Chart/Numbers/Match/Chat) render the
same computed data. No backend — birth data stays on the device.

## Rule: keep the agent and the UI in sync (both directions)

What the agent can compute/knows and what the UI shows MUST stay in sync — neither side should
silently have more than the other.

- **UI → agent:** anything the user can see in the UI must also be reachable by the LLM. If a
  tab renders computed data, the agent needs either a tool that returns it or that data in its
  context (`src/lib/prompts/formatters.js` / the tab's `extraContext`, or a tool in
  `src/lib/llm/tools.js`). The user should never be able to see something the assistant can't.
- **Agent → UI:** anything the engine computes and the agent can fetch should be surfaced in
  the relevant tab when it's useful to the user — don't compute something only the LLM can see.
- **Drive the UI from the data, not hardcoded subsets.** Render lists/options from what was
  actually computed (e.g. the Chart tab's divisional tabs come from `chart.divisionalCharts`
  keys, not a fixed `['D1','D9']`). If the engine produces it, the UI offers it; if it doesn't,
  the UI doesn't pretend it does.

**When you add or change a computation:** wire BOTH ends in the same change — the Python compute,
the tool/`formatter` that exposes it to the agent, AND the UI surface that shows it (or a clear
note if one side is intentionally omitted). Adding a tool without a UI surface (or a UI panel
without agent access) is the bug this rule exists to prevent.

**If it's not clear** whether a new capability belongs in the agent tools, the UI, or both — or
how a piece of data should be surfaced — ask before implementing.

## Conventions

- Tests are the bar: Python `.venv-test/bin/python -m pytest tests/python`, JS `npx vitest run`,
  e2e `npx playwright test`, plus `npm run lint` (0 errors) and `npm run build` before merging.
- Python scripts must be listed in BOTH `src/lib/pyodide/worker.js` (`scripts` array + preload)
  and `vite.config.js` (`PY_SCRIPTS`); new tools need a label in `src/lib/llm/toolLabels.js`.
- Never hallucinate astrological facts (see `src/assets/soul.md`): rules come from sourced
  classical definitions; surface only what was computed.
