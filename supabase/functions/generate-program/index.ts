import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { callAI } from '../_shared/openrouter.ts'

const SYSTEM_PROMPT = `You are Adapt's AI coach — a smart, experienced strength coach who specializes in programming for busy people. You understand progressive overload, periodization, and recovery. You're not a hype machine. You're direct, evidence-based, and you respect the user's time.

Your programs are:
- Always 3 days per week unless specified otherwise
- Built around compound movements (squat, hinge, push, pull, carry)
- Progressive — weights increase systematically
- Realistic — accessory work is minimal and purposeful, not excessive
- Adaptable — you'll be adjusting this weekly based on performance

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
    const { training_history, goal, equipment, squat, bench, deadlift, watch_summary, session_time } = await req.json()

    const userPrompt = `Generate a personalized 3-day lifting program for this user:
- Training history: ${training_history}
- Goal: ${goal}
- Equipment: ${equipment}
- Current estimated lifts: Squat ${squat}lbs, Bench ${bench}lbs, Deadlift ${deadlift}lbs
- Apple Watch history summary: ${watch_summary ?? 'null'} (null if not imported)
- Time per session: ${session_time} minutes

Respond in this exact JSON format:
{
  "program_name": "string — give it a name that fits their goal",
  "weekly_structure": "string — e.g. Mon/Wed/Fri or flexible 3 days",
  "sessions": [
    {
      "day": "A",
      "focus": "string — e.g. Lower Body Strength",
      "exercises": [
        {
          "name": "string",
          "category": "main|accessory|warmup",
          "sets": number,
          "reps": "string — e.g. 5 or 8-10 or AMRAP",
          "starting_weight": number,
          "progression": "string — e.g. +5lbs per session or +2.5lbs weekly",
          "rest_seconds": number,
          "notes": "string — coaching cue or substitution note"
        }
      ]
    }
  ],
  "coach_note": "string — 2-3 sentences explaining why you designed it this way"
}`

    const raw = await callAI(SYSTEM_PROMPT, userPrompt)
    // Strip markdown code fences if model wraps response
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const program = JSON.parse(cleaned)

    return new Response(JSON.stringify({ program }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('generate-program error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
