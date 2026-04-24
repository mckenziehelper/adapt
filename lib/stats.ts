// lib/stats.ts
import { database, SessionModel, SetModel } from './watermelon'

// --- Types ---

export type LiftSummary = {
  exerciseName: string
  bestWeight: number
  trend: 'up' | 'flat' | null  // null = only one session ever
}

export type SetSummary = {
  exerciseName: string
  setNumber: number
  weight: number
  reps: number
  isPR: boolean
}

export type SessionSummary = {
  id: string
  completedAt: number
  sessionDay: string
  focus: string
  exercises: string[]   // unique exercise names
  totalVolume: number   // sum of weight × reps
  sets: SetSummary[]
}

export type CalendarDay = {
  date: string          // 'YYYY-MM-DD'
  hasSession: boolean
}

export type LiftSession = {
  date: number          // Unix timestamp ms
  maxWeight: number     // best weight across all sets in this session
  sets: SetSummary[]
}

// --- Internal helpers ---

function startOfMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
}

function weekKey(timestamp: number): number {
  return Math.floor(timestamp / (7 * 24 * 60 * 60 * 1000))
}

function toDateString(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// --- Exported queries ---

/** Stats row: sessions this month, total PRs, current week streak */
export async function getStatsThisMonth(): Promise<{
  sessions: number
  prs: number
  weekStreak: number
}> {
  const [allSessions, allSets] = await Promise.all([
    database.get<SessionModel>('sessions').query().fetch(),
    database.get<SetModel>('sets').query().fetch(),
  ])

  const completed = allSessions.filter(s => s.completedAt != null)

  const monthStart = startOfMonth()
  const sessionsThisMonth = completed.filter(s => s.completedAt >= monthStart).length

  const thisMonthSessionIds = new Set(
    completed.filter(s => s.completedAt >= monthStart).map(s => s.id)
  )
  const prCount = allSets.filter(s => s.isPR && thisMonthSessionIds.has(s.sessionId)).length

  // Consecutive weeks ending at the current week
  const completedWeeks = new Set(completed.map(s => weekKey(s.completedAt)))
  let streak = 0
  let w = weekKey(Date.now())
  while (completedWeeks.has(w)) {
    streak++
    w--
  }

  return { sessions: sessionsThisMonth, prs: prCount, weekStreak: streak }
}

/** Top lifts: every logged exercise with best weight and trend arrow */
export async function getTopLifts(): Promise<LiftSummary[]> {
  const [allSets, allSessions] = await Promise.all([
    database.get<SetModel>('sets').query().fetch(),
    database.get<SessionModel>('sessions').query().fetch(),
  ])

  // sessionId → completedAt
  const sessionTs: Record<string, number> = {}
  for (const s of allSessions) {
    if (s.completedAt) sessionTs[s.id] = s.completedAt
  }

  // exercise → [{ timestamp, weight, sessionId }]
  const byExercise: Record<string, { ts: number; weight: number; sid: string }[]> = {}
  for (const set of allSets) {
    const ts = sessionTs[set.sessionId]
    if (!ts || !set.weight) continue
    if (!byExercise[set.exerciseName]) byExercise[set.exerciseName] = []
    byExercise[set.exerciseName].push({ ts, weight: set.weight, sid: set.sessionId })
  }

  const results: LiftSummary[] = []
  for (const [name, entries] of Object.entries(byExercise)) {
    // Max weight per session, keyed by sessionId
    const bySessionId: Record<string, number> = {}
    for (const e of entries) {
      bySessionId[e.sid] = Math.max(bySessionId[e.sid] ?? 0, e.weight)
    }
    // Build sid → ts lookup for sorting
    const sidToTs: Record<string, number> = {}
    for (const e of entries) { sidToTs[e.sid] = e.ts }
    const sorted = Object.entries(bySessionId).sort((a, b) => (sidToTs[b[0]] ?? 0) - (sidToTs[a[0]] ?? 0))
    const bestWeight = sorted[0][1]
    let trend: 'up' | 'flat' | null = null
    if (sorted.length >= 2) {
      trend = bestWeight > sorted[1][1] ? 'up' : 'flat'
    }
    results.push({ exerciseName: name, bestWeight, trend })
  }

  // Sort heaviest first
  return results.sort((a, b) => b.bestWeight - a.bestWeight)
}

/** Last N completed sessions with their sets */
export async function getRecentSessions(limit = 10): Promise<SessionSummary[]> {
  const [allSessions, allSets] = await Promise.all([
    database.get<SessionModel>('sessions').query().fetch(),
    database.get<SetModel>('sets').query().fetch(),
  ])

  const completed = allSessions
    .filter(s => s.completedAt != null)
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, limit)

  const setsBySession: Record<string, SetModel[]> = {}
  for (const set of allSets) {
    if (!setsBySession[set.sessionId]) setsBySession[set.sessionId] = []
    setsBySession[set.sessionId].push(set)
  }

  return completed.map(session => {
    const sets = setsBySession[session.id] ?? []
    const exerciseNames = [...new Set(sets.map(s => s.exerciseName))]
    const totalVolume = sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.actualReps ?? 0), 0)
    let focus = ''
    try { focus = JSON.parse(session.plannedJson)?.focus ?? '' } catch {}

    return {
      id: session.id,
      completedAt: session.completedAt,
      sessionDay: session.sessionDay,
      focus,
      exercises: exerciseNames,
      totalVolume,
      sets: sets
        .sort((a, b) => a.setNumber - b.setNumber)
        .map(s => ({
          exerciseName: s.exerciseName,
          setNumber: s.setNumber,
          weight: s.weight ?? 0,
          reps: s.actualReps ?? 0,
          isPR: s.isPR,
        })),
    }
  })
}

/** Last `days` days as calendar entries */
export async function getConsistencyCalendar(days = 35): Promise<CalendarDay[]> {
  const allSessions = await database.get<SessionModel>('sessions').query().fetch()
  const sessionDates = new Set(
    allSessions
      .filter(s => s.completedAt != null)
      .map(s => toDateString(s.completedAt))
  )

  const result: CalendarDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = toDateString(d.getTime())
    result.push({ date: key, hasSession: sessionDates.has(key) })
  }
  return result
}

export type CombinedLiftSeries = {
  exerciseName: string
  color: string
  points: { date: number; maxWeight: number }[]
}

const SERIES_COLORS = ['#3B82F6', '#84CC16', '#F59E0B', '#EC4899', '#A78BFA']

/** Top N exercises with per-session max weight, for the combined progress chart */
export async function getCombinedLiftHistory(topN = 5): Promise<CombinedLiftSeries[]> {
  const [allSets, allSessions] = await Promise.all([
    database.get<SetModel>('sets').query().fetch(),
    database.get<SessionModel>('sessions').query().fetch(),
  ])

  const sessionTs: Record<string, number> = {}
  for (const s of allSessions) {
    if (s.completedAt) sessionTs[s.id] = s.completedAt
  }

  const byExercise: Record<string, Record<string, number>> = {}
  for (const set of allSets) {
    const ts = sessionTs[set.sessionId]
    if (!ts || !set.weight) continue
    if (!byExercise[set.exerciseName]) byExercise[set.exerciseName] = {}
    byExercise[set.exerciseName][set.sessionId] = Math.max(
      byExercise[set.exerciseName][set.sessionId] ?? 0,
      set.weight
    )
  }

  return Object.entries(byExercise)
    .map(([name, sessionMaxes]) => {
      const points = Object.entries(sessionMaxes)
        .map(([sid, maxWeight]) => ({ date: sessionTs[sid], maxWeight }))
        .sort((a, b) => a.date - b.date)
        .slice(-8)
      return { exerciseName: name, points, bestWeight: Math.max(...points.map(p => p.maxWeight)) }
    })
    .filter(e => e.points.length >= 2)
    .sort((a, b) => b.bestWeight - a.bestWeight)
    .slice(0, topN)
    .map((e, i) => ({
      exerciseName: e.exerciseName,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      points: e.points,
    }))
}

/** All sets for one exercise, grouped by session, newest first, capped at 8 sessions */
export async function getLiftHistory(exerciseName: string): Promise<LiftSession[]> {
  const [allSets, allSessions] = await Promise.all([
    database.get<SetModel>('sets').query().fetch(),
    database.get<SessionModel>('sessions').query().fetch(),
  ])

  const sessionTs: Record<string, number> = {}
  for (const s of allSessions) {
    if (s.completedAt) sessionTs[s.id] = s.completedAt
  }

  const exerciseSets = allSets.filter(
    s => s.exerciseName === exerciseName && sessionTs[s.sessionId]
  )

  const bySessionId: Record<string, SetModel[]> = {}
  for (const set of exerciseSets) {
    if (!bySessionId[set.sessionId]) bySessionId[set.sessionId] = []
    bySessionId[set.sessionId].push(set)
  }

  return Object.entries(bySessionId)
    .sort((a, b) => (sessionTs[b[0]] ?? 0) - (sessionTs[a[0]] ?? 0))
    .slice(0, 8)
    .map(([sid, sets]) => ({
      date: sessionTs[sid],
      maxWeight: Math.max(...sets.map(s => s.weight ?? 0)),
      sets: sets
        .sort((a, b) => a.setNumber - b.setNumber)
        .map(s => ({
          exerciseName: s.exerciseName,
          setNumber: s.setNumber,
          weight: s.weight ?? 0,
          reps: s.actualReps ?? 0,
          isPR: s.isPR,
        })),
    }))
}
