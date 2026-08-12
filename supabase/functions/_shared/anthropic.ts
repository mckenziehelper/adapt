const ANTHROPIC_BASE = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-5'

export async function callAI(systemPrompt: string, userPrompt: string, maxTokens = 2500): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const response = await fetch(ANTHROPIC_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic error ${response.status}: ${error}`)
  }

  const data = await response.json()
  return data.content[0].text
}
