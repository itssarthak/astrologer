import { claudeChat } from './claude'
import { geminiChat } from './gemini'
import { openaiChat } from './openai'

// "custom" reuses the OpenAI client against a user-supplied baseUrl + model.
const CLIENTS = { claude: claudeChat, gemini: geminiChat, openai: openaiChat, custom: openaiChat }

/**
 * Unified streaming chat interface.
 * @param {{ provider: string, key: string, messages: Array, systemPrompt: string, onChunk: Function, baseUrl?: string, model?: string }} opts
 * @returns Promise<void> — resolves when stream ends
 */
export async function chat({ provider, key, messages, systemPrompt, onChunk, baseUrl, model }) {
  const client = CLIENTS[provider]
  if (!client) throw new Error(`Unknown provider: ${provider}`)
  return client({ key, messages, systemPrompt, onChunk, baseUrl, model })
}
