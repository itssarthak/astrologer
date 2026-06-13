import soulMd from '../../assets/soul.md?raw'
import userMdTemplate from '../../assets/user-template.md?raw'

// The model has no live clock — without this it guesses "today" from training data. Inject the
// real current date/time + timezone so dates, "today"/"now", current dasha and transit reasoning
// are anchored to the user's actual local time. Computed fresh per system-prompt build.
function currentDateTimeBlock() {
  const now = new Date()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone // e.g. "Asia/Kolkata"
  const formatted = now.toLocaleString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
  const offMin = -now.getTimezoneOffset() // minutes ahead of UTC (negative = behind)
  const sign = offMin >= 0 ? '+' : '-'
  const abs = Math.abs(offMin)
  const offset = `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
  return `# Current date & time
Right now it is ${formatted} (${tz}, ${offset}).
Treat this as "today"/"now" — never infer the current date from training data. Always give time periods as absolute dates.`
}

// Build the per-user system prompt by filling the {{PLACEHOLDER}} tokens in the soul + user
// template at runtime (global replace — a token may appear several times).
export function buildSystemPrompt(profile) {
  const lagna = profile?.chart?.d1Chart?.houses?.find(h => h.number === 1)?.sign ?? 'unknown'
  const values = {
    NAME: profile?.name ?? 'the user',
    DOB: profile?.dob ?? 'unknown',
    TIME: profile?.time ?? 'unknown',
    PLACE: profile?.place ?? 'unknown',
    GENDER: profile?.gender || 'not specified',
    LAGNA: lagna,
  }
  const combined = `${soulMd}\n\n---\n\n# Current User\n${userMdTemplate}`
  const filled = combined.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match)
  return `${filled}\n\n---\n\n${currentDateTimeBlock()}`
}
