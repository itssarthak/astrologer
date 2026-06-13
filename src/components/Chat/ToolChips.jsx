import { toolLabel } from '../../lib/llm/toolLabels'

// Chips listing the tools the agent called for an answer. Shown live (on the in-progress
// message, as each tool is invoked) and on the persisted assistant message afterwards, so the
// chip appears the moment a tool runs rather than only when the completion arrives.
export default function ToolChips({ tools }) {
  if (!tools || tools.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 max-w-[85%]">
      {tools.map(name => (
        <span key={name}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-light/60 border border-primary/20 text-primary text-[11px] font-medium">
          🔧 {toolLabel(name)}
        </span>
      ))}
    </div>
  )
}
