// Human-friendly labels for each agent tool, keyed by the tool name in the registry (tools.js).
// `active` shows in the live "in progress" indicator; `past` shows as a chip in the chat thread.
// One entry per tool keeps the two tenses from drifting apart. The toolLabels test pins these
// keys to the tool registry so a newly-added tool can't silently fall back to its raw name.
export const TOOL_LABELS = {
  list_profiles:      { active: 'Looking up your profiles',  past: 'Looked up your profiles' },
  get_chart:          { active: 'Fetching the birth chart',        past: 'Fetched the birth chart' },
  get_divisional:     { active: 'Reading divisional charts',       past: 'Read divisional charts' },
  get_dasha:          { active: 'Reading the dasha timeline',       past: 'Read the dasha timeline' },
  get_doshas:         { active: 'Checking the doshas',              past: 'Checked the doshas' },
  get_yogas:          { active: 'Listing the yogas',                past: 'Listed the yogas' },
  get_ashtakavarga:   { active: 'Reading Ashtakavarga strengths',   past: 'Read Ashtakavarga strengths' },
  get_aspects:        { active: 'Reading the aspects',              past: 'Read the aspects' },
  get_varshaphal:     { active: 'Casting the annual chart',         past: 'Cast the annual chart' },
  get_today_transit:  { active: "Reading today's transits",        past: "Read today's transits" },
  match_profiles:     { active: 'Checking compatibility',    past: 'Checked compatibility' },
  compute_numerology: { active: 'Crunching the numbers',     past: 'Crunched the numbers' },
  numerology_compatibility: { active: 'Checking number compatibility', past: 'Checked number compatibility' },
  numerology_match:   { active: 'Matching the numbers',     past: 'Matched the numbers' },
  loshu_grid:         { active: 'Drawing the Lo Shu grid',   past: 'Drew the Lo Shu grid' },
  geocode_place:      { active: 'Looking up the location',   past: 'Looked up the location' },
  compute_chart:      { active: 'Computing the birth chart', past: 'Computed a birth chart' },
  astro_reference:    { active: 'Confirming the facts',        past: 'Confirmed the facts' },
  web_search:         { active: 'Searching the web',         past: 'Searched the web' },
}

export const toolLabel = name => TOOL_LABELS[name]?.past ?? name
export const toolLabelActive = name => TOOL_LABELS[name]?.active ?? `Running ${name}`
