import soulMd from '../../assets/soul.md?raw'
import userMdTemplate from '../../assets/user-template.md?raw'

// Build the per-user system prompt by filling the {{PLACEHOLDER}} tokens in the soul + user
// template at runtime (global replace — a token may appear several times).
export function buildSystemPrompt(profile) {
  const lagna = profile?.chart?.d1Chart?.houses?.find(h => h.number === 1)?.sign ?? 'unknown'
  const values = {
    NAME: profile?.name ?? 'the user',
    LAGNA: lagna,
  }
  const combined = `${soulMd}\n\n---\n\n# Current User\n${userMdTemplate}`
  return combined.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match)
}
