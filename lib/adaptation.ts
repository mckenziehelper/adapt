// Weekly adaptation — queries WatermelonDB, calls adapt-program edge function,
// saves updated program and coach message.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Q } from '@nozbe/watermelondb'
import { database, SessionModel } from './watermelon'
import { supabase } from './supabase'
import { getActiveProgram, saveProgram } from './programs'

export type AdaptationResult = {
  changes: Array<{
    type: string
    exercise: string
    reason: string
    old_value: string
    new_value: string
  }>
  plateau_detected: {
    detected: boolean
    exercise: string | null
    weeks_stalled: number
    intervention: string
  }
  weekly_coach_message: string
  next_week_focus: string
}

/**
 * Run the weekly adaptation cycle.
 *
 * 1. Queries the last 7 days of completed sessions from WatermelonDB.
 * 2. Builds planned_vs_actual_sessions and checkins strings.
 * 3. Fetches the active program.
 * 4. Calls the adapt-program Supabase edge function.
 * 5. Saves the adapted program to WatermelonDB.
 * 6. Persists coach message fields to AsyncStorage.
 * 7. Returns the full AdaptationResult.
 *
 * Throws on error so callers can show an alert.
 */
export async function runWeeklyAdaptation(
  goal: string,
  weeksOnApp: number,
): Promise<AdaptationResult> {
  // --- 1. Load active program ---
  const currentProgram = await getActiveProgram()
  if (!currentProgram) {
    throw new Error('No active program found. Generate a program first.')
  }

  // --- 2. Query last 7 days of completed sessions ---
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  const recentSessions = await database
    .get<SessionModel>('sessions')
    .query(
      Q.where('completed_at', Q.gte(sevenDaysAgo)),
      Q.where('completed_at', Q.notEq(null)),
    )
    .fetch()

  // --- 3. Build planned_vs_actual_sessions string ---
  const plannedVsActual = recentSessions
    .map((s) => {
      const planned = s.plannedJson ? JSON.parse(s.plannedJson) : {}
      const actual = s.actualJson ? JSON.parse(s.actualJson) : {}
      const date = new Date(s.completedAt).toISOString().slice(0, 10)
      return `Day ${s.sessionDay} (${date}): planned=${JSON.stringify(planned)}, actual=${JSON.stringify(actual)}`
    })
    .join('\n') || 'No sessions completed this week.'

  // --- 4. Build checkins string ---
  const checkins = recentSessions
    .map((s) => {
      const date = new Date(s.completedAt).toISOString().slice(0, 10)
      const parts: string[] = [`Day ${s.sessionDay} (${date})`]
      if (s.energyCheckin) parts.push(`energy=${s.energyCheckin}/5`)
      if (s.soreAreas) parts.push(`sore=${s.soreAreas}`)
      if (s.timeAvailable) parts.push(`time=${s.timeAvailable}min`)
      return parts.join(', ')
    })
    .join('\n') || 'No check-ins recorded.'

  // --- 5. Call edge function ---
  const { data, error } = await supabase.functions.invoke('adapt-program', {
    body: {
      planned_vs_actual_sessions: plannedVsActual,
      checkins,
      cardio_summary: 'N/A',
      avg_sleep: 'N/A',
      avg_steps: 'N/A',
      hrv_trend: 'N/A',
      current_program_json: currentProgram.programJson,
      goal,
      weeks: weeksOnApp,
    },
  })

  if (error) throw new Error(error.message ?? 'Edge function error')

  const result = data as AdaptationResult

  if (!result || !result.weekly_coach_message) {
    throw new Error('Adaptation response missing expected fields.')
  }

  // --- 6. Apply changes to program ---
  await saveProgram(currentProgram.program, result.weekly_coach_message)

  // --- 7. Persist coach message to AsyncStorage ---
  await AsyncStorage.setItem('coach_message', result.weekly_coach_message)
  await AsyncStorage.setItem('coach_message_date', new Date().toISOString())
  await AsyncStorage.setItem('next_week_focus', result.next_week_focus ?? '')

  return result
}
