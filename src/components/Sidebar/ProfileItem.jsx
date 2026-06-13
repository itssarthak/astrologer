// src/components/Sidebar/ProfileItem.jsx
import { useContext } from 'react'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { useBusy } from '../../contexts/BusyContext'

export default function ProfileItem({ profile }) {
  const { activeProfileId, switchProfile, removeProfile } = useContext(ProfilesContext)
  const { busy } = useBusy()
  const isActive = profile.id === activeProfileId
  // Block switching while a response is streaming — otherwise part of it lands here.
  const locked = busy && !isActive

  const initial = profile.name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div onClick={() => { if (!locked) switchProfile(profile.id) }}
      title={locked ? 'Wait for the current response to finish' : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
        locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${
        isActive ? 'bg-primary-light border border-primary' : 'hover:bg-surface-2 border border-transparent'
      }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
        isActive ? 'bg-primary text-white' : 'bg-surface-2 text-muted'
      }`}>
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-text'}`}>{profile.name}</p>
        <p className="text-xs text-muted truncate">{profile.dob}</p>
      </div>
      {!isActive && !busy && (
        <button onClick={e => { e.stopPropagation(); removeProfile(profile.id) }}
          className="text-muted hover:text-red-500 transition-colors text-lg leading-none flex-shrink-0"
          aria-label={`Remove ${profile.name}`}>
          ×
        </button>
      )}
    </div>
  )
}
