import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { callAI } from '../_shared/openrouter.ts'

const SYSTEM_PROMPT = `You are Adapt's AI coach — a smart, experienced strength coach who specializes in programming for busy people. You understand progressive overload, periodization, and recovery. You're not a hype machine. You're direct, evidence-based, and you respect the user's time.

Always respond in valid JSON only. No markdown, no explanation outside the JSON.`

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { energy, sore_areas, time, session_json, last_session_summary } = await req.json()

    const userPrompt = `User check-in before today's workout:
- Energy: ${energy}/5
- Soreness: ${Array.isArray(sore_areas) ? sore_areas.join(', ') : sore_areas || 'none'}
- Time available: ${time} minutes
- Planned session: ${session_json}
- Last session: ${last_session_summary}

Adjust today's session if needed. If energy < 3 or time < planned, modify.
If everything is fine, return the session unchanged.

Respond in same session JSON format as the program.
Include a "adjustment_note" field explaining any changes made (or "No adjustments needed" if unchanged).`

    const raw = await callAI(SYSTEM_PROMPT, userPrompt)
    const session = JSON.parse(raw)

    return new Response(JSON.stringify(session), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('adjust-session error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
