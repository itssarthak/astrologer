import { buildSystemPrompt } from './soul'
import { instructionFor, TOOL_GUIDANCE, LAYMAN_REMINDER } from '../llm/tabConfig'

// Single source of truth for how a chat turn's system prompt is layered, so the ordering is
// testable and can't drift from what useChat actually sends. Order matters:
//   soul.md (identity + layman tone) → tool guidance → per-tab framing → computed-data context →
//   LAYMAN_REMINDER (last, to re-anchor plain language after the jargon-dense data context).
export function assembleSystemPrompt(profile, tab, { extraContext = '', toolsEnabled = true } = {}) {
  const base = buildSystemPrompt(profile)
  const guidance = toolsEnabled ? `\n\n${TOOL_GUIDANCE}` : ''
  const ctx = extraContext ? `\n\n${extraContext}` : ''
  return `${base}${guidance}\n\n# This view\n${instructionFor(tab)}${ctx}\n\n${LAYMAN_REMINDER}`
}
