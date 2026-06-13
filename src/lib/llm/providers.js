// Single source of truth for the bring-your-own-key providers: the UI metadata used by the
// onboarding + sidebar key forms, and the OpenAI-compatible base-URL/model resolution shared
// by the streaming (index.js) and agentic (agent.js) paths.

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export const OPENROUTER_DEFAULT_MODEL = 'openrouter/free'

export const PROVIDERS = [
  { id: 'claude', label: 'Claude', placeholder: 'sk-ant-...', docs: 'https://console.anthropic.com/account/keys' },
  { id: 'gemini', label: 'Gemini', placeholder: 'AIza...', docs: 'https://aistudio.google.com/app/apikey' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...', docs: 'https://platform.openai.com/api-keys' },
  {
    id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-...',
    docs: 'https://openrouter.ai/keys', docsLabel: 'Generate your OpenRouter API key →',
    needsModel: true, defaultModel: OPENROUTER_DEFAULT_MODEL,
  },
  { id: 'custom', label: 'Custom', placeholder: 'your API key', needsBaseUrl: true, needsModel: true },
]

export function defaultModelFor(id) {
  return PROVIDERS.find(p => p.id === id)?.defaultModel ?? ''
}

// OpenRouter has a fixed base URL and a free default model (the user supplies only a key);
// every other provider passes its baseUrl/model through unchanged.
export function resolveProviderConfig(provider, { baseUrl, model } = {}) {
  if (provider === 'openrouter') {
    return { baseUrl: OPENROUTER_BASE_URL, model: model || OPENROUTER_DEFAULT_MODEL }
  }
  return { baseUrl, model }
}
