// src/components/Sidebar/Sidebar.jsx
import { useState, useContext } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { PyodideContext } from '../../contexts/PyodideContext'
import ProfileItem from './ProfileItem'
import AddProfileModal from './AddProfileModal'
import ApiKeyModal from './ApiKeyModal'

const ENGINE_STATUS = {
  ready: { dot: 'bg-green-400', label: 'Python engine ready' },
  loading: { dot: 'bg-amber-400 animate-pulse', label: 'Loading Python engine…' },
  idle: { dot: 'bg-amber-400 animate-pulse', label: 'Starting Python engine…' },
  error: { dot: 'bg-red-400', label: 'Python engine failed to load' },
}

export default function Sidebar() {
  const { profiles } = useContext(ProfilesContext)
  const { status } = useContext(PyodideContext)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showApiModal, setShowApiModal] = useState(false)

  const engine = ENGINE_STATUS[status] ?? ENGINE_STATUS.idle

  return (
    <aside className="flex flex-col h-full bg-dark-bg text-gold w-64 flex-shrink-0 border-r border-border">
      {/* Header */}
      <div className="px-4 py-5 border-b border-white/10">
        <p className="text-base font-bold tracking-tight">Ask My Astro</p>
        <p className="text-xs text-gold/60 mt-0.5">Your private astrologer</p>
      </div>

      {/* Profile list */}
      <div className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-1">
        <p className="text-xs font-semibold text-gold/50 uppercase tracking-wide px-1 mb-1">Profiles</p>
        {profiles.map(p => <ProfileItem key={p.id} profile={p} />)}

        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gold/70 hover:text-gold hover:bg-white/5 transition-colors mt-1 w-full text-left">
          <span className="text-lg leading-none">+</span>
          <span>Add profile</span>
        </button>
      </div>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-white/10 flex flex-col gap-1">
        <button onClick={() => setShowApiModal(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gold/70 hover:text-gold hover:bg-white/5 transition-colors">
          <span>🔑</span>
          <span>API Key</span>
        </button>
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-gold/60" role="status" aria-live="polite">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${engine.dot}`} />
          <span>{engine.label}</span>
        </div>
      </div>

      {showAddModal && <AddProfileModal onClose={() => setShowAddModal(false)} />}
      {showApiModal && <ApiKeyModal onClose={() => setShowApiModal(false)} />}
    </aside>
  )
}
