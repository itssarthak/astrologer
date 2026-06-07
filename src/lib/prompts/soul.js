import soulMd from '../../assets/soul.md?raw'
import userMdTemplate from '../../assets/user-template.md?raw'

export function buildSystemPrompt(profile) {
  const user = userMdTemplate
    .replace('{{NAME}}', profile.name)
    .replace('{{LAGNA}}', profile.chart?.d1Chart?.houses?.[0]?.sign ?? 'unknown')

  return `${soulMd}\n\n---\n\n# Current User\n${user}`
}
