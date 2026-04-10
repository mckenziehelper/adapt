import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { callAI } from '../_shared/openrouter.ts'

const SYSTEM_PROMPT = `You are Adapt's AI coach — a smart, experienced strength coach who specializes in programming for busy people. You understand progressive overload, periodization, and recovery. You're not a hype machine. You're direct, evidence-based, and you respect the user's time.

Your programs are:
- Exactly the number of days per week the user specifies — no more, no less
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
    const { training_history, goal, equipment, squat, bench, deadlift, watch_summary, session_time, days_per_week, notes } = await req.json()

    const userPrompt = `Generate a personalized ${days_per_week}-day-per-week lifting program for this user:
- Training history: ${training_history}
- Goal: ${goal}
- Equipment: ${equipment}
- Days per week: ${days_per_week} (generate exactly this many sessions — A, B, C... up to ${days_per_week})
- Current estimated lifts: Squat ${squat}lbs, Bench ${bench}lbs, Deadlift ${deadlift}lbs
- Apple Watch history summary: ${watch_summary ?? 'null'} (null if not imported)
- Time per session: ${session_time} minutes
- Additional context from user: ${notes ?? 'none'}

Respond in this exact JSON format:
{
  "program_name": "string — give it a name that fits their goal",
  "weekly_structure": "string — e.g. Mon/Wed/Fri or flexible 3 days",
  "sessions": [
    {
      "day": "A",
      "focus": "string — e.g. Lower Body Strength",
      "description": "string — 2-3 sentences: what this workout builds, what to focus on mentally, what to expect from the session",
      "exercises": [
        {
          "name": "string",
          "category": "main|accessory|warmup",
          "sets": number,
          "reps": "string — e.g. 5 or 8-10 or AMRAP",
          "starting_weight": number,
          "progression": "string — e.g. +5lbs per session or +2.5lbs weekly",
          "rest_seconds": number,
          "notes": "string — coaching cue or substitution note",
          "how_to": "string — 2-3 sentences: how to perform the lift correctly, what muscles it works, one key form cue to keep in mind"
        }
      ]
    }
  ],
  "coach_note": "string — 2-3 sentences explaining why you designed it this way"
}`

    const raw = await callAI(SYSTEM_PROMPT, userPrompt, 2500)
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
