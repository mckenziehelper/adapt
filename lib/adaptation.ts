// Weekly adaptation orchestration — Phase 2 implementation.
// Runs every Sunday night after sessions are logged.

import { supabase } from './supabase'
import { getActiveProgram, saveProgram } from './programs'
import { getWeeklyHealthSummary } from './healthkit'

/**
 * Run the weekly adaptation cycle.
 * Gathers this week's data, calls the adapt-program edge function,
 * and saves the updated program locally.
 */
export async function runWeeklyAdaptation(userId: string, goal: string, weeksOnApp: number) {
  try {
    const currentProgram = await getActiveProgram()
    if (!currentProgram) return null

    const healthSummary = await getWeeklyHealthSummary(7)

    const { data, error } = await supabase.functions.invoke('adapt-program', {
      body: {
        user_id: userId,
        current_program_json: JSON.stringify(currentProgram.program),
        goal,
        weeks: weeksOnApp,
        planned_vs_actual_sessions: '{}', // TODO: pull from WatermelonDB
        checkins: '{}',                    // TODO: pull from WatermelonDB
        cardio_summary: JSON.stringify(healthSummary.cardioSessions),
        avg_sleep: healthSummary.avgSleepHours,
        avg_steps: healthSummary.avgDailySteps,
        hrv_trend: healthSummary.hrvTrend,
      },
    })

    if (error) throw error
    if (!data?.program) return null

    await saveProgram(data.program, data.coach_note ?? '')
    return data

  } catch (err) {
    console.error('Weekly adaptation error:', err)
    return null
  }
}
