// src/components/Chat/TemplatePrompts.jsx
// Starter prompts shown only in the empty-chat state. Tapping a chip fills the input
// (via the parent's injectText wiring) so the user can edit before sending.
export const TEMPLATE_PROMPTS = [
  { label: "Today's transit read", text: 'Give me my transit read for today.' },
  { label: 'Read my chart', text: 'Give me an overview reading of my birth chart.' },
  { label: 'Current life phase', text: "What's the major theme of my current dasha period?" },
  { label: 'Year ahead', text: 'What does the year ahead look like for me?' },
]

export default function TemplatePrompts({ onPick }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {TEMPLATE_PROMPTS.map(p => (
        <button key={p.label} onClick={() => onPick(p.text)}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface border border-border text-text hover:border-primary hover:text-primary transition-colors">
          {p.label}
        </button>
      ))}
    </div>
  )
}
