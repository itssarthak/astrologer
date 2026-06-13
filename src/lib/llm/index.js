import { claudeChat } from './claude'
import { geminiChat } from './gemini'
import { openaiChat } from './openai'
import { resolveProviderConfig } from './providers'

// "custom" and "openrouter" both reuse the OpenAI-compatible client; OpenRouter's fixed base
// URL + default model come from resolveProviderConfig (shared with the agentic path).
const CLIENTS = { claude: claudeChat, gemini: geminiChat, openai: openaiChat, custom: openaiChat, openrouter: openaiChat }

/**
 * Unified streaming chat interface.
 * @param {{ provider: string, key: string, messages: Array, systemPrompt: string, onChunk: Function, baseUrl?: string, model?: string }} opts
 * @returns Promise<void> — resolves when stream ends
 */
export async function chat({ provider, key, messages, systemPrompt, onChunk, baseUrl, model, signal }) {
  const client = CLIENTS[provider]
  if (!client) throw new Error(`Unknown provider: ${provider}`)
  const { baseUrl: resolvedBaseUrl, model: resolvedModel } = resolveProviderConfig(provider, { baseUrl, model })
  return client({ key, messages, systemPrompt, onChunk, baseUrl: resolvedBaseUrl, model: resolvedModel, signal })
}
