// OpenAI Chat Completions API — streaming.
// baseUrl lets the "custom" provider point at any OpenAI-compatible endpoint
// (Ollama, LM Studio, OpenRouter, vLLM, a self-hosted proxy, etc.).
export async function openaiChat({ key, messages, systemPrompt, onChunk, signal, model = 'gpt-4o', baseUrl = 'https://api.openai.com/v1' }) {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  const resp = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 2048,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `OpenAI API error ${resp.status}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const event = JSON.parse(data)
        const text = event.choices?.[0]?.delta?.content
        if (text) onChunk?.(text)
      } catch { /* skip */ }
    }
  }
}
