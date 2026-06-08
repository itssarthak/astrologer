// src/components/TabBar/TabBar.jsx
const TABS = [
  { id: 'chat', label: 'Chat' },
  { id: 'today', label: 'Today' },
  { id: 'chart', label: 'Chart' },
  { id: 'numbers', label: 'Numbers' },
  { id: 'match', label: 'Match' },
]

export default function TabBar({ activeTab, onTabChange }) {
  return (
    <div className="flex border-b border-border bg-surface px-4 gap-1 overflow-x-auto flex-shrink-0">
      {TABS.map(t => (
        <button key={t.id} onClick={() => onTabChange(t.id)}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
            activeTab === t.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-text'
          }`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
