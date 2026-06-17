// src/components/Sidebar/ApiKeyModal.jsx
import { useState } from 'react'
import { getApiKey, saveApiKey, clearApiKey } from '../../lib/storage/keys'
import { PROVIDERS, defaultModelFor } from '../../lib/llm/providers'

export default function ApiKeyModal({ onClose }) {
  const existing = getApiKey()
  const initialProvider = existing?.provider ?? 'openrouter'
  const [provider, setProvider] = useState(initialProvider)
  const [key, setKey] = useState(existing?.key ?? '')
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? '')
  const [model, setModel] = useState(existing?.model ?? defaultModelFor(initialProvider))
  const [saveError, setSaveError] = useState(null)

  const current = PROVIDERS.find(p => p.id === provider)
  const needsBaseUrl = !!current.needsBaseUrl
  const needsModel = !!current.needsModel
  const trimmedKey = key.trim()
  const trimmedUrl = baseUrl.trim()
  const trimmedModel = model.trim()
  const canSave = !!trimmedKey && (!needsBaseUrl || !!trimmedUrl) && (!needsModel || !!trimmedModel)

  const switchProvider = id => {
    setProvider(id)
    setKey('')
    setBaseUrl('')
    setModel(defaultModelFor(id))
    setSaveError(null)
  }

  const handleSave = () => {
    if (!canSave) return
    try {
      saveApiKey({
        provider,
        key: trimmedKey,
        baseUrl: needsBaseUrl ? trimmedUrl : undefined,
        model: needsModel ? trimmedModel : undefined,
      })
      onClose()
    } catch {
      setSaveError('Could not save. Try disabling private browsing mode.')
    }
  }

  const handleClear = () => {
    clearApiKey()
    setKey('')
    setBaseUrl('')
    setModel(defaultModelFor(provider))
    setSaveError(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-surface rounded-2xl border border-border shadow-xl p-6 flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-text">API Key</h2>
          <button onClick={onClose} className="text-muted hover:text-text text-xl leading-none">✕</button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted uppercase tracking-wide">Provider</label>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map(p => (
              <button key={p.id} onClick={() => switchProvider(p.id)}
                aria-pressed={provider === p.id}
                className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                  provider === p.id
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-border bg-white text-muted hover:border-border-strong'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {needsBaseUrl && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Base URL</label>
            <input type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://your-endpoint.com/v1"
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text focus:outline-none focus:border-primary font-mono text-sm" />
            <p className="text-xs text-muted">OpenAI-compatible endpoint (must allow browser CORS).</p>
          </div>
        )}

        {needsModel && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Model</label>
            <input type="text" value={model} onChange={e => setModel(e.target.value)}
              placeholder={current.defaultModel ?? 'e.g. llama-3.1-70b'}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text focus:outline-none focus:border-primary font-mono text-sm" />
            {provider === 'openrouter' && (
              <p className="text-xs text-muted">
                Suggested: <span className="font-mono text-text-2">openai/gpt-oss-120b:free</span> — a capable free model at no cost.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted uppercase tracking-wide">API Key</label>
          <input type="password" value={key} onChange={e => setKey(e.target.value)}
            placeholder={current?.placeholder ?? ''}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text focus:outline-none focus:border-primary font-mono text-sm" />
        </div>

        {current.docs && (
          <a href={current.docs} target="_blank" rel="noopener noreferrer"
            className={`text-xs text-center underline ${provider === 'openrouter' ? 'text-primary font-medium' : 'text-muted'}`}>
            {current.docsLabel ?? 'How do I get an API key? →'}
          </a>
        )}

        {saveError && <p className="text-xs text-red-500">{saveError}</p>}

        <div className="flex gap-2">
          <button onClick={handleClear}
            className="flex-1 py-2 rounded-lg border border-border text-sm text-muted hover:text-red-500 hover:border-red-300 transition-colors">
            Clear key
          </button>
          <button onClick={handleSave} disabled={!canSave}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors">
            Save →
          </button>
        </div>
      </div>
    </div>
  )
}
