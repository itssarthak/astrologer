import { claudeChat } from './claude'
import { geminiChat } from './gemini'
import { openaiChat } from './openai'

// "custom" and "openrouter" both reuse the OpenAI-compatible client. OpenRouter has a fixed
// base URL (the user only supplies a key + model), so we inject it here.
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const CLIENTS = { claude: claudeChat, gemini: geminiChat, openai: openaiChat, custom: openaiChat, openrouter: openaiChat }

/**
 * Unified streaming chat interface.
 * @param {{ provider: string, key: string, messages: Array, systemPrompt: string, onChunk: Function, baseUrl?: string, model?: string }} opts
 * @returns Promise<void> — resolves when stream ends
 */
export async function chat({ provider, key, messages, systemPrompt, onChunk, baseUrl, model, signal }) {
  const client = CLIENTS[provider]
  if (!client) throw new Error(`Unknown provider: ${provider}`)
  const resolvedBaseUrl = provider === 'openrouter' ? OPENROUTER_BASE_URL : baseUrl
  const resolvedModel = provider === 'openrouter' ? (model || 'openrouter/free') : model
  return client({ key, messages, systemPrompt, onChunk, baseUrl: resolvedBaseUrl, model: resolvedModel, signal })
}
