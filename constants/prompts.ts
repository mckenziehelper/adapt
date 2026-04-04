export const PROGRAM_GENERATION_SYSTEM = `You are Adapt's AI coach — a smart, experienced strength coach who specializes in programming for busy people. You understand progressive overload, periodization, and recovery. You're not a hype machine. You're direct, evidence-based, and you respect the user's time.

Your programs are:
- Always 3 days per week unless specified otherwise
- Built around compound movements (squat, hinge, push, pull, carry)
- Progressive — weights increase systematically
- Realistic — accessory work is minimal and purposeful, not excessive
- Adaptable — you'll be adjusting this weekly based on performance

Always respond in valid JSON only. No markdown, no explanation outside the JSON.`

export const buildProgramGenerationPrompt = (params: {
  training_history: string
  goal: string
  equipment: string
  squat: string
  bench: string
  deadlift: string
  watch_summary: string | null
  session_time: number
}) => `Generate a personalized 3-day lifting program for this user:
- Training history: ${params.training_history}
- Goal: ${params.goal}
- Equipment: ${params.equipment}
- Current estimated lifts: Squat ${params.squat}lbs, Bench ${params.bench}lbs, Deadlift ${params.deadlift}lbs
- Apple Watch history summary: ${params.watch_summary ?? 'null'} (null if not imported)
- Time per session: ${params.session_time} minutes

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

export const WEEKLY_ADAPTATION_SYSTEM = PROGRAM_GENERATION_SYSTEM

export const buildWeeklyAdaptationPrompt = (params: {
  planned_vs_actual_sessions: string
  checkins: string
  cardio_summary: string
  avg_sleep: number
  avg_steps: number
  hrv_trend: string
  current_program_json: string
  goal: string
  weeks: number
}) => `Review this user's week and adapt their program for next week.

This week's plan vs actual:
${params.planned_vs_actual_sessions}

Pre-workout check-ins this week:
${params.checkins}

HealthKit data this week:
- Cardio sessions: ${params.cardio_summary}
- Average sleep: ${params.avg_sleep} hours
- Average steps: ${params.avg_steps}
- HRV trend: ${params.hrv_trend}

Current program:
${params.current_program_json}

User's overall goal: ${params.goal}
Weeks on this program: ${params.weeks}

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
  "weekly_coach_message": "string — 3-4 sentences. Conversational, specific, honest.",
  "next_week_focus": "string — one sentence priority for next week"
}`

export const buildSessionAdjustmentPrompt = (params: {
  energy: number
  sore_areas: string[]
  time: number
  session_json: string
  last_session_summary: string
}) => `User check-in before today's workout:
- Energy: ${params.energy}/5
- Soreness: ${params.sore_areas.join(', ') || 'none'}
- Time available: ${params.time} minutes
- Planned session: ${params.session_json}
- Last session: ${params.last_session_summary}

Adjust today's session if needed. If energy < 3 or time < planned, modify.
If everything is fine, return the session unchanged.

Respond in same session JSON format as the program.
Include a "adjustment_note" field explaining any changes made (or "No adjustments needed" if unchanged).`
