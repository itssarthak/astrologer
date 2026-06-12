// Anthropic Messages API — streaming via fetch SSE
export async function claudeChat({ key, messages, systemPrompt, onChunk, signal, model = 'claude-sonnet-4-6' }) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Claude API error ${resp.status}`)
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
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          onChunk?.(event.delta.text)
        }
      } catch { /* skip malformed lines */ }
    }
  }
}
