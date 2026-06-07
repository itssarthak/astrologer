import { claudeChat } from './claude'
import { geminiChat } from './gemini'
import { openaiChat } from './openai'

const CLIENTS = { claude: claudeChat, gemini: geminiChat, openai: openaiChat }

/**
 * Unified streaming chat interface.
 * @param {{ provider: string, key: string, messages: Array, systemPrompt: string, onChunk: Function }} opts
 * @returns Promise<void> — resolves when stream ends
 */
export async function chat({ provider, key, messages, systemPrompt, onChunk }) {
  const client = CLIENTS[provider]
  if (!client) throw new Error(`Unknown provider: ${provider}`)
  return client({ key, messages, systemPrompt, onChunk })
}
