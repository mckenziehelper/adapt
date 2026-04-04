// HealthKit read helpers — Phase 3 implementation.
// Read-only. Never request write permissions.
// Used to inform AI adaptation — not to replace the lifting log.

export type HealthKitSummary = {
  cardioSessions: Array<{
    type: string
    duration: number // minutes
    distance?: number // miles
    calories?: number
    date: string
  }>
  avgSleepHours: number
  avgDailySteps: number
  hrvTrend: 'improving' | 'declining' | 'stable' | 'unknown'
}

/**
 * Stub — request HealthKit permissions (Phase 3)
 */
export async function requestHealthKitPermissions(): Promise<boolean> {
  console.warn('HealthKit not yet implemented — Phase 3')
  return false
}

/**
 * Stub — pull last N days of HealthKit data for AI adaptation (Phase 3)
 */
export async function getWeeklyHealthSummary(days = 7): Promise<HealthKitSummary> {
  return {
    cardioSessions: [],
    avgSleepHours: 0,
    avgDailySteps: 0,
    hrvTrend: 'unknown',
  }
}

/**
 * Stub — import Apple Watch workout history for onboarding cold start (Phase 3)
 */
export async function importWatchHistory(): Promise<string | null> {
  return null
}
