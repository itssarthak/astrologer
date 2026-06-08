import { useState } from 'react'
import { saveApiKey } from '../../lib/storage/keys'

const PROVIDERS = [
  { id: 'claude', label: 'Claude', placeholder: 'sk-ant-...', docs: 'https://console.anthropic.com/account/keys' },
  { id: 'gemini', label: 'Gemini', placeholder: 'AIza...', docs: 'https://aistudio.google.com/app/apikey' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...', docs: 'https://platform.openai.com/api-keys' },
]

export default function StepApiKey({ onNext }) {
  const [provider, setProvider] = useState('claude')
  const [key, setKey] = useState('')

  const current = PROVIDERS.find(p => p.id === provider)

  const handleContinue = () => {
    if (!key.trim()) return
    saveApiKey({ provider, key: key.trim() })
    onNext()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text">Connect your AI</h2>
        <p className="text-sm text-muted mt-1">Your key is stored only in your browser. It goes directly to the AI — we never see it.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-text-2 uppercase tracking-wide">Choose provider</label>
        <div className="flex gap-2">
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => setProvider(p.id)}
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
        <label className="text-xs font-semibold text-text-2 uppercase tracking-wide">API Key</label>
        <input type="password" value={key} onChange={e => setKey(e.target.value)}
          placeholder={current.placeholder}
          className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text focus:outline-none focus:border-primary font-mono text-sm" />
      </div>

      <a href={current.docs} target="_blank" rel="noopener noreferrer"
        className="text-xs text-muted text-center underline">
        How do I get an API key? →
      </a>

      <button onClick={handleContinue} disabled={!key.trim()}
        className="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        Continue →
      </button>
    </div>
  )
}
