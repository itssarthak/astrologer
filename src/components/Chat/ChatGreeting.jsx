// Shown in the Chat tab before any conversation — the astrologer greets the user in the same
// assistant-bubble style as a real reply, so a blank chat never feels empty.
export default function ChatGreeting({ name }) {
  const greeting = name
    ? `Namaste, ${name} 🙏 I've cast your chart and I'm here whenever you are.`
    : `Namaste 🙏 I'm here whenever you are.`

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm text-sm leading-relaxed bg-surface border border-border text-text">
        {greeting} Ask me about today's energy, the path ahead, relationships, career, or any
        placement you're curious about.
      </div>
    </div>
  )
}
