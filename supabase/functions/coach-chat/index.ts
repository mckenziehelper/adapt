import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'openrouter/auto'

const SYSTEM_PROMPT = `You are Adapt's AI coach — a direct, experienced strength coach helping a user modify their lifting program.

When the user asks you to make changes to their program:
- Explain what you're changing and why, briefly (1-3 sentences max)
- Return the complete updated program JSON in "program_changes"

When the user is asking a question or just chatting:
- Answer concisely
- Omit "program_changes" entirely

Rules for program changes:
- Keep the same JSON structure — do not add or rename top-level fields
- Make only the specific changes requested, leave everything else alone
- Be conservative — don't add exercises or volume unless asked

Always respond with valid JSON only in this exact format:
{ "message": "string", "program_changes": { ...complete program object }, "changes_summary": ["short description of each change, e.g. 'Bench press: 3×5 → 4×5'", "Squat weight: 135lbs → 140lbs"] }

Or if no changes:
{ "message": "string" }

The changes_summary array must be present whenever program_changes is present. Each item is a short, plain-English description of one change. Maximum 6 items.`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { current_program, conversation, user_message } = await req.json()

    const apiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      // Prior conversation turns
      ...(conversation ?? []).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      // New user message with program context injected on first turn
      {
        role: 'user',
        content: conversation?.length
          ? user_message
          : `Here is my current program:\n${JSON.stringify(current_program, null, 2)}\n\n${user_message}`,
      },
    ]

    const response = await fetch(OPENROUTER_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://adapt.app',
        'X-Title': 'Adapt',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        response_format: { type: 'json_object' },
        max_tokens: 6000,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`OpenRouter error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const raw = data.choices[0]?.message?.content
    if (!raw) throw new Error('Empty response from model')

    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    let result: { message: string; program_changes?: object; changes_summary?: string[] }
    try {
      result = JSON.parse(cleaned)
    } catch {
      throw new Error(`Invalid JSON from model: ${cleaned.slice(0, 200)}`)
    }

    // Omit empty program_changes so the client doesn't show an apply button
    if (result.program_changes && Object.keys(result.program_changes).length === 0) {
      delete result.program_changes
    }
    // Strip empty changes_summary
    if (Array.isArray(result.changes_summary) && result.changes_summary.length === 0) {
      delete result.changes_summary
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('coach-chat error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
