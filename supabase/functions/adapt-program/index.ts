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
    const {
      planned_vs_actual_sessions,
      checkins,
      cardio_summary,
      avg_sleep,
      avg_steps,
      hrv_trend,
      current_program_json,
      goal,
      weeks,
    } = await req.json()

    const userPrompt = `Review this user's week and adapt their program for next week.

This week's plan vs actual:
${planned_vs_actual_sessions}

Pre-workout check-ins this week:
${checkins}

HealthKit data this week:
- Cardio sessions: ${cardio_summary}
- Average sleep: ${avg_sleep} hours
- Average steps: ${avg_steps}
- HRV trend: ${hrv_trend}

Current program:
${current_program_json}

User's overall goal: ${goal}
Weeks on this program: ${weeks}

Analyze what happened and respond in this exact JSON format:
{
  "changes": [
    {
      "type": "weight_increase|weight_decrease|exercise_swap|volume_change|deload|rest_day_added",
      "exercise": "string",
      "reason": "string — plain English explanation of why",
      "old_value": "string",
      "new_value": "string"
    }
  ],
  "plateau_detected": {
    "detected": boolean,
    "exercise": "string or null",
    "weeks_stalled": number,
    "intervention": "string — what you're doing about it"
  },
  "weekly_coach_message": "string — 3-4 sentences. Conversational, specific, honest. Reference actual things that happened this week.",
  "next_week_focus": "string — one sentence priority for next week",
  "adapted_program": "the full updated program object with all changes applied — same structure as the current program JSON but with the changes incorporated"
}`

    const raw = await callAI(SYSTEM_PROMPT, userPrompt)
    const adaptation = JSON.parse(raw)

    return new Response(JSON.stringify(adaptation), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('adapt-program error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
