// src/components/Sidebar/ApiKeyModal.jsx
import { useState, useEffect } from 'react'
import { getApiKey, saveApiKey, clearApiKey } from '../../lib/storage/keys'

const PROVIDERS = [
  { id: 'claude', label: 'Claude', placeholder: 'sk-ant-...' },
  { id: 'gemini', label: 'Gemini', placeholder: 'AIza...' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
]

export default function ApiKeyModal({ onClose }) {
  const existing = getApiKey()
  const [provider, setProvider] = useState(existing?.provider ?? 'claude')
  const [key, setKey] = useState(existing?.key ?? '')
  const [saveError, setSaveError] = useState(null)

  const trimmedKey = key.trim()

  const handleSave = () => {
    if (!trimmedKey) return
    try {
      saveApiKey({ provider, key: trimmedKey })
      onClose()
    } catch {
      setSaveError('Could not save. Try disabling private browsing mode.')
    }
  }

  const handleClear = () => {
    clearApiKey()
    setKey('')
    setSaveError(null)
  }

  const current = PROVIDERS.find(p => p.id === provider)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-surface rounded-2xl border border-border shadow-xl p-6 flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-text">API Key</h2>
          <button onClick={onClose} className="text-muted hover:text-text text-xl leading-none">✕</button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted uppercase tracking-wide">Provider</label>
          <div className="flex gap-2">
            {PROVIDERS.map(p => (
              <button key={p.id} onClick={() => { setProvider(p.id); setKey('') }}
                aria-pressed={provider === p.id}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  provider === p.id
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-border bg-white text-muted hover:border-border-strong'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted uppercase tracking-wide">API Key</label>
          <input type="password" value={key} onChange={e => setKey(e.target.value)}
            placeholder={current?.placeholder ?? ''}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text focus:outline-none focus:border-primary font-mono text-sm" />
        </div>

        {saveError && <p className="text-xs text-red-500">{saveError}</p>}

        <div className="flex gap-2">
          <button onClick={handleClear}
            className="flex-1 py-2 rounded-lg border border-border text-sm text-muted hover:text-red-500 hover:border-red-300 transition-colors">
            Clear key
          </button>
          <button onClick={handleSave} disabled={!trimmedKey}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors">
            Save →
          </button>
        </div>
      </div>
    </div>
  )
}
