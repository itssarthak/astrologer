// Human-friendly labels for the agent tools, shown in the chat (and the live indicator).
export const TOOL_LABELS = {
  list_profiles: 'Looked up your profiles',
  get_chart: 'Fetched the birth chart',
  get_today_transit: "Read today's transits",
  match_profiles: 'Checked compatibility',
  compute_numerology: 'Crunched the numbers',
  geocode_place: 'Looked up the location',
  compute_chart: 'Computed a birth chart',
  web_search: 'Searched the web',
}

// Present-continuous form for the "in progress" indicator.
const TOOL_LABELS_ACTIVE = {
  list_profiles: 'Looking up your profiles',
  get_chart: 'Fetching the birth chart',
  get_today_transit: "Reading today's transits",
  match_profiles: 'Checking compatibility',
  compute_numerology: 'Crunching the numbers',
  geocode_place: 'Looking up the location',
  compute_chart: 'Computing the birth chart',
  web_search: 'Searching the web',
}

export const toolLabel = name => TOOL_LABELS[name] ?? name
export const toolLabelActive = name => TOOL_LABELS_ACTIVE[name] ?? `Running ${name}`
