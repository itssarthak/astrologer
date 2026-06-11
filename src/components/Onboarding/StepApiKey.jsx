import { useState } from 'react'
import { getApiKey, saveApiKey } from '../../lib/storage/keys'

const PROVIDERS = [
  { id: 'claude', label: 'Claude', placeholder: 'sk-ant-...', docs: 'https://console.anthropic.com/account/keys' },
  { id: 'gemini', label: 'Gemini', placeholder: 'AIza...', docs: 'https://aistudio.google.com/app/apikey' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...', docs: 'https://platform.openai.com/api-keys' },
  { id: 'custom', label: 'Custom', placeholder: 'your API key', docs: null },
]

export default function StepApiKey({ onNext }) {
  const existing = getApiKey()
  const [provider, setProvider] = useState(existing?.provider ?? 'claude')
  const [key, setKey] = useState(existing?.key ?? '')
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? '')
  const [model, setModel] = useState(existing?.model ?? '')
  const [saveError, setSaveError] = useState(null)

  const current = PROVIDERS.find(p => p.id === provider)
  const isCustom = provider === 'custom'
  const trimmedKey = key.trim()
  const trimmedUrl = baseUrl.trim()
  const trimmedModel = model.trim()
  const canContinue = isCustom ? (trimmedKey && trimmedUrl && trimmedModel) : !!trimmedKey

  const switchProvider = id => {
    setProvider(id)
    setKey('')
    setBaseUrl('')
    setModel('')
    setSaveError(null)
  }

  const handleContinue = () => {
    if (!canContinue) return
    try {
      saveApiKey({
        provider,
        key: trimmedKey,
        baseUrl: isCustom ? trimmedUrl : undefined,
        model: isCustom ? trimmedModel : undefined,
      })
      onNext()
    } catch {
      setSaveError('Could not save to browser storage. Try disabling private browsing mode.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text">Connect your AI</h2>
        <p className="text-sm text-muted mt-1">Your key is stored only in your browser. It goes directly to the AI — we never see it.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-text-2 uppercase tracking-wide">Choose provider</label>
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

      {isCustom && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-2 uppercase tracking-wide">Base URL</label>
            <input type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://your-endpoint.com/v1"
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text focus:outline-none focus:border-primary font-mono text-sm" />
            <p className="text-xs text-muted">OpenAI-compatible endpoint (must allow browser CORS).</p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-2 uppercase tracking-wide">Model</label>
            <input type="text" value={model} onChange={e => setModel(e.target.value)}
              placeholder="e.g. llama-3.1-70b"
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text focus:outline-none focus:border-primary font-mono text-sm" />
          </div>
        </>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-text-2 uppercase tracking-wide">API Key</label>
        <input type="password" value={key} onChange={e => setKey(e.target.value)}
          placeholder={current.placeholder}
          className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text focus:outline-none focus:border-primary font-mono text-sm" />
      </div>

      {current.docs && (
        <a href={current.docs} target="_blank" rel="noopener noreferrer"
          className="text-xs text-muted text-center underline">
          How do I get an API key? →
        </a>
      )}

      {saveError && <p className="text-xs text-red-500 text-center">{saveError}</p>}

      <button onClick={handleContinue} disabled={!canContinue}
        className="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        Continue →
      </button>
    </div>
  )
}
