// src/components/TabBar/BottomNav.jsx
const TABS = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'numbers', label: 'Numbers', icon: '✨' },
  { id: 'match', label: 'Match', icon: '❤️' },
]

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav className="flex border-t border-border bg-surface safe-bottom flex-shrink-0">
      {TABS.map(t => (
        <button key={t.id} onClick={() => onTabChange(t.id)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
            activeTab === t.id ? 'text-primary' : 'text-muted'
          }`}>
          <span className="text-xl leading-none">{t.icon}</span>
          <span className="text-[10px] font-medium">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
