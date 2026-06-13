// Human-friendly labels for each agent tool, keyed by the tool name in the registry (tools.js).
// `active` shows in the live "in progress" indicator; `past` shows as a chip in the chat thread.
// One entry per tool keeps the two tenses from drifting apart. The toolLabels test pins these
// keys to the tool registry so a newly-added tool can't silently fall back to its raw name.
export const TOOL_LABELS = {
  list_profiles:      { active: 'Looking up your profiles',  past: 'Looked up your profiles' },
  get_chart:          { active: 'Fetching the birth chart',        past: 'Fetched the birth chart' },
  get_divisional:     { active: 'Reading divisional charts',       past: 'Read divisional charts' },
  get_today_transit:  { active: "Reading today's transits",        past: "Read today's transits" },
  match_profiles:     { active: 'Checking compatibility',    past: 'Checked compatibility' },
  compute_numerology: { active: 'Crunching the numbers',     past: 'Crunched the numbers' },
  geocode_place:      { active: 'Looking up the location',   past: 'Looked up the location' },
  compute_chart:      { active: 'Computing the birth chart', past: 'Computed a birth chart' },
  web_search:         { active: 'Searching the web',         past: 'Searched the web' },
}

export const toolLabel = name => TOOL_LABELS[name]?.past ?? name
export const toolLabelActive = name => TOOL_LABELS[name]?.active ?? `Running ${name}`
