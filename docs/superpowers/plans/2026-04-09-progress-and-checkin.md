# Progress Screen + Pre-Workout Check-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full progress dashboard with lift history drill-down, and a pre-workout check-in screen that optionally adjusts today's session via AI.

**Architecture:** All progress data reads from local WatermelonDB — no network required. Check-in writes answers to WatermelonDB immediately, then optionally calls the `adjust-session` Supabase Edge Function if online. The active workout screen receives the final session JSON (original or adjusted) as a param.

**Tech Stack:** React Native (Expo), WatermelonDB, Supabase Edge Functions, `@nozbe/watermelondb`, `@react-native-community/netinfo`, custom View-based bar chart (no extra chart library needed).

---

## File Map

| File | Change |
|------|--------|
| `lib/stats.ts` | **Create** — WatermelonDB query helpers for all progress data |
| `app/(tabs)/progress.tsx` | **Replace stub** — full dashboard implementation |
| `app/progress/[exercise].tsx` | **Create** — lift drill-down with bar chart + set history |
| `app/workout/[sessionId]/checkin.tsx` | **Replace stub** — 3-question check-in + AI adjustment |
| `app/workout/[sessionId]/active.tsx` | **Modify** — accept optional `adjustedSession` + check-in params |
| `app/(tabs)/index.tsx` | **Modify** — route "Start Workout" to checkin, not active |
| `supabase/functions/tests/adjust-session.test.mjs` | **Create** — edge function integration test |

---

## Task 1: Data query helpers (`lib/stats.ts`)

**Files:**
- Create: `lib/stats.ts`

- [ ] **Step 1: Create `lib/stats.ts` with all exported types and helper functions**

```typescript
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

  const prCount = allSets.filter(s => s.isPR).length

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

  // exercise → [{ timestamp, weight }]
  const byExercise: Record<string, { ts: number; weight: number }[]> = {}
  for (const set of allSets) {
    const ts = sessionTs[set.sessionId]
    if (!ts || !set.weight) continue
    if (!byExercise[set.exerciseName]) byExercise[set.exerciseName] = []
    byExercise[set.exerciseName].push({ ts, weight: set.weight })
  }

  const results: LiftSummary[] = []
  for (const [name, entries] of Object.entries(byExercise)) {
    // Max weight per session
    const bySession: Record<number, number> = {}
    for (const e of entries) {
      bySession[e.ts] = Math.max(bySession[e.ts] ?? 0, e.weight)
    }
    const sorted = Object.entries(bySession).sort((a, b) => Number(b[0]) - Number(a[0]))
    const bestWeight = Number(sorted[0][1])
    let trend: 'up' | 'flat' | null = null
    if (sorted.length >= 2) {
      trend = bestWeight > Number(sorted[1][1]) ? 'up' : 'flat'
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

  const bySession: Record<number, SetModel[]> = {}
  for (const set of exerciseSets) {
    const ts = sessionTs[set.sessionId]
    if (!bySession[ts]) bySession[ts] = []
    bySession[ts].push(set)
  }

  return Object.entries(bySession)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .slice(0, 8)
    .map(([ts, sets]) => ({
      date: Number(ts),
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/stats.ts
git commit -m "Add WatermelonDB stats query helpers for progress screen"
```

---

## Task 2: Progress dashboard (`app/(tabs)/progress.tsx`)

**Files:**
- Modify: `app/(tabs)/progress.tsx`

- [ ] **Step 1: Replace the stub with the full dashboard**

```typescript
// app/(tabs)/progress.tsx
import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Colors, Spacing } from '../../constants/theme'
import {
  getStatsThisMonth,
  getTopLifts,
  getRecentSessions,
  getConsistencyCalendar,
  LiftSummary,
  SessionSummary,
  CalendarDay,
} from '../../lib/stats'

type Stats = { sessions: number; prs: number; weekStreak: number }

export default function ProgressScreen() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [lifts, setLifts] = useState<LiftSummary[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [calendar, setCalendar] = useState<CalendarDay[]>([])
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      Promise.all([
        getStatsThisMonth(),
        getTopLifts(),
        getRecentSessions(10),
        getConsistencyCalendar(35),
      ]).then(([s, l, sess, cal]) => {
        setStats(s)
        setLifts(l)
        setSessions(sess)
        setCalendar(cal)
        setLoading(false)
      })
    }, [])
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Progress</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatTile value={stats?.sessions ?? 0} label="SESSIONS" />
          <StatTile value={stats?.prs ?? 0} label="PRs HIT" color={Colors.success} />
          <StatTile value={stats?.weekStreak ?? 0} label="WK STREAK" color={Colors.accent} />
        </View>

        {/* Top lifts */}
        {lifts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TOP LIFTS</Text>
            <View style={styles.card}>
              {lifts.map((lift, i) => (
                <TouchableOpacity
                  key={lift.exerciseName}
                  style={[styles.liftRow, i < lifts.length - 1 && styles.liftRowBorder]}
                  onPress={() =>
                    router.push({
                      pathname: '/progress/[exercise]',
                      params: { exercise: encodeURIComponent(lift.exerciseName) },
                    })
                  }
                >
                  <Text style={styles.liftName}>{lift.exerciseName}</Text>
                  <View style={styles.liftRight}>
                    <Text
                      style={[
                        styles.liftWeight,
                        lift.trend === 'up' && styles.liftWeightUp,
                      ]}
                    >
                      {lift.bestWeight} lbs
                    </Text>
                    {lift.trend === 'up' && <Text style={styles.trendUp}> ↑</Text>}
                    {lift.trend === 'flat' && <Text style={styles.trendFlat}> →</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RECENT SESSIONS</Text>
            {sessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                expanded={expandedSession === session.id}
                onToggle={() =>
                  setExpandedSession(prev => (prev === session.id ? null : session.id))
                }
              />
            ))}
          </View>
        )}

        {/* Consistency calendar */}
        {calendar.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CONSISTENCY — LAST 5 WEEKS</Text>
            <View style={styles.calendar}>
              {Array.from({ length: 5 }).map((_, weekIdx) => (
                <View key={weekIdx} style={styles.calendarRow}>
                  {calendar.slice(weekIdx * 7, weekIdx * 7 + 7).map(day => (
                    <View
                      key={day.date}
                      style={[
                        styles.calendarDot,
                        day.hasSession
                          ? styles.calendarDotFilled
                          : styles.calendarDotEmpty,
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        {lifts.length === 0 && sessions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Complete your first workout to see progress here.</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function StatTile({
  value,
  label,
  color,
}: {
  value: number
  label: string
  color?: string
}) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function SessionCard({
  session,
  expanded,
  onToggle,
}: {
  session: SessionSummary
  expanded: boolean
  onToggle: () => void
}) {
  const date = new Date(session.completedAt)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const volume = session.totalVolume > 0
    ? `${Math.round(session.totalVolume).toLocaleString()} lbs volume`
    : ''
  const exercisePreview =
    session.exercises.slice(0, 3).join(', ') +
    (session.exercises.length > 3 ? ` +${session.exercises.length - 3} more` : '')

  // Group sets by exercise for expanded view
  const byExercise: Record<string, typeof session.sets> = {}
  for (const set of session.sets) {
    if (!byExercise[set.exerciseName]) byExercise[set.exerciseName] = []
    byExercise[set.exerciseName].push(set)
  }

  return (
    <TouchableOpacity style={styles.sessionCard} onPress={onToggle} activeOpacity={0.8}>
      <View style={styles.sessionHeader}>
        <View style={styles.sessionMeta}>
          <Text style={styles.sessionDate}>{dateStr}</Text>
          <Text style={styles.sessionDay}>Day {session.sessionDay} · {session.focus}</Text>
        </View>
        <Text style={styles.sessionChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {!expanded && (
        <>
          <Text style={styles.sessionExercises}>{exercisePreview}</Text>
          {volume ? <Text style={styles.sessionVolume}>{volume}</Text> : null}
        </>
      )}
      {expanded && (
        <View style={styles.setsContainer}>
          {Object.entries(byExercise).map(([name, sets]) => (
            <View key={name} style={styles.exerciseGroup}>
              <Text style={styles.exerciseGroupName}>{name}</Text>
              {sets.map(set => (
                <View key={set.setNumber} style={styles.setRow}>
                  <Text style={styles.setText}>
                    Set {set.setNumber} — {set.weight} lbs × {set.reps} reps
                  </Text>
                  {set.isPR && <Text style={styles.prBadge}>PR</Text>}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  container: { padding: Spacing.lg },
  heading: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: Spacing.lg,
  },

  // Stats row
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: { color: Colors.text, fontSize: 24, fontWeight: '800' },
  statLabel: { color: Colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginTop: 4 },

  // Section
  section: { marginBottom: Spacing.lg },
  sectionLabel: {
    color: Colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Lift rows
  liftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  liftRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.background },
  liftName: { color: Colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  liftRight: { flexDirection: 'row', alignItems: 'center' },
  liftWeight: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  liftWeightUp: { color: Colors.success },
  trendUp: { color: Colors.success, fontSize: 15, fontWeight: '700' },
  trendFlat: { color: Colors.muted, fontSize: 15 },

  // Session cards
  sessionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sessionMeta: { flex: 1 },
  sessionDate: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  sessionDay: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  sessionChevron: { color: Colors.muted, fontSize: 12, marginLeft: 8 },
  sessionExercises: { color: Colors.muted, fontSize: 13, marginTop: 6 },
  sessionVolume: { color: Colors.accent, fontSize: 12, marginTop: 4 },

  // Expanded sets
  setsContainer: { marginTop: Spacing.sm },
  exerciseGroup: { marginBottom: Spacing.sm },
  exerciseGroupName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  setText: { color: Colors.muted, fontSize: 13 },
  prBadge: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },

  // Calendar
  calendar: { gap: 6 },
  calendarRow: { flexDirection: 'row', gap: 6 },
  calendarDot: { width: 32, height: 32, borderRadius: 6 },
  calendarDotFilled: { backgroundColor: Colors.success },
  calendarDotEmpty: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#4B5563' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: Colors.muted, fontSize: 15, textAlign: 'center' },
})
```

- [ ] **Step 2: Manual test — run the app, tap the Progress tab**
  - Verify it loads without crash (empty state if no sessions logged yet)
  - If you have completed sessions, verify stats row shows correct counts
  - Verify lift rows appear and are tappable

- [ ] **Step 3: Commit**

```bash
git add 'app/(tabs)/progress.tsx'
git commit -m "Implement progress dashboard screen"
```

---

## Task 3: Lift drill-down screen (`app/progress/[exercise].tsx`)

**Files:**
- Create: `app/progress/[exercise].tsx`

- [ ] **Step 1: Create the `app/progress/` directory and `[exercise].tsx`**

```typescript
// app/progress/[exercise].tsx
import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { TouchableOpacity } from 'react-native'
import { Colors, Spacing } from '../../constants/theme'
import { getLiftHistory, LiftSession } from '../../lib/stats'

export default function ExerciseDrillDown() {
  const { exercise } = useLocalSearchParams<{ exercise: string }>()
  const exerciseName = decodeURIComponent(exercise ?? '')

  const [history, setHistory] = useState<LiftSession[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      getLiftHistory(exerciseName).then(data => {
        setHistory(data)
        setLoading(false)
      })
    }, [exerciseName])
  )

  const prWeight = history.length > 0 ? Math.max(...history.map(s => s.maxWeight)) : 0
  const prSession = history.find(s => s.maxWeight === prWeight)
  const prDate = prSession
    ? new Date(prSession.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''

  // Bar chart: newest session on the right
  const chartSessions = [...history].reverse()
  const maxWeight = prWeight || 1
  const BAR_MAX_HEIGHT = 80

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{exerciseName}</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 60 }} />
      ) : history.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No sets logged for {exerciseName} yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          {/* PR callout */}
          <View style={styles.prCard}>
            <Text style={styles.prLabel}>PERSONAL RECORD</Text>
            <Text style={styles.prWeight}>{prWeight} lbs</Text>
            {prDate ? <Text style={styles.prDate}>{prDate}</Text> : null}
          </View>

          {/* Bar chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartLabel}>WEIGHT OVER TIME (last {chartSessions.length} sessions)</Text>
            <View style={styles.chart}>
              {chartSessions.map((session, i) => {
                const height = Math.max(
                  8,
                  Math.round((session.maxWeight / maxWeight) * BAR_MAX_HEIGHT)
                )
                const isPR = session.maxWeight === prWeight
                const dateStr = new Date(session.date).toLocaleDateString('en-US', {
                  month: 'numeric',
                  day: 'numeric',
                })
                return (
                  <View key={i} style={styles.barWrapper}>
                    <Text style={styles.barWeight}>{session.maxWeight}</Text>
                    <View
                      style={[
                        styles.bar,
                        { height },
                        isPR ? styles.barPR : styles.barNormal,
                      ]}
                    />
                    <Text style={styles.barDate}>{dateStr}</Text>
                  </View>
                )
              })}
            </View>
          </View>

          {/* Session history */}
          <Text style={styles.sectionLabel}>SESSION HISTORY</Text>
          {history.map((session, i) => {
            const dateStr = new Date(session.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
            return (
              <View key={i} style={styles.sessionBlock}>
                <Text style={styles.sessionDate}>{dateStr}</Text>
                {session.sets.map(set => (
                  <View key={set.setNumber} style={styles.setRow}>
                    <Text style={styles.setText}>
                      {set.weight} lbs × {set.reps} reps
                    </Text>
                    {set.isPR && <Text style={styles.prBadge}>PR</Text>}
                  </View>
                ))}
              </View>
            )
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  backBtn: { width: 60, paddingVertical: 6 },
  backText: { color: Colors.accent, fontSize: 17 },
  headerTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },

  container: { padding: Spacing.lg },

  // PR card
  prCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
  },
  prLabel: { color: Colors.success, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  prWeight: { color: Colors.text, fontSize: 36, fontWeight: '800' },
  prDate: { color: Colors.muted, fontSize: 13, marginTop: 4 },

  // Bar chart
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  chartLabel: {
    color: Colors.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 120,
    paddingTop: 24,
  },
  barWrapper: { alignItems: 'center', flex: 1, gap: 4 },
  barWeight: { color: Colors.muted, fontSize: 8, fontWeight: '600' },
  bar: { width: '60%', borderRadius: 4, minHeight: 8 },
  barNormal: { backgroundColor: Colors.accent },
  barPR: { backgroundColor: Colors.success },
  barDate: { color: Colors.muted, fontSize: 8 },

  // History list
  sectionLabel: {
    color: Colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  sessionBlock: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sessionDate: { color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  setText: { color: Colors.muted, fontSize: 13 },
  prBadge: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.muted, fontSize: 15 },
})
```

- [ ] **Step 2: Manual test — tap any lift row on the progress screen**
  - Verify the drill-down screen opens
  - Verify back button works
  - Verify chart bars render at different heights
  - Verify PR bar is green, others are blue

- [ ] **Step 3: Commit**

```bash
git add 'app/progress/[exercise].tsx'
git commit -m "Add lift drill-down screen with bar chart and set history"
```

---

## Task 4: Update `active.tsx` to accept optional adjusted session + check-in params

**Files:**
- Modify: `app/workout/[sessionId]/active.tsx`

Currently `active.tsx` reads the session plan from WatermelonDB using `sessionDay`. It needs to also accept an optional `adjustedSession` (JSON string) and check-in values, and write them to the session DB record.

- [ ] **Step 1: Update the params type and `initSession()` function**

Replace the existing params destructuring and `initSession` function (lines 33–89 of the current file):

```typescript
// Replace the useLocalSearchParams call at the top of ActiveWorkoutScreen:
const { sessionId, sessionDay, adjustedSession, energyCheckin, soreAreas, timeAvailable } =
  useLocalSearchParams<{
    sessionId: string
    sessionDay: string
    adjustedSession?: string      // JSON string of AI-adjusted session, if any
    energyCheckin?: string        // '1'–'5'
    soreAreas?: string            // JSON string array, e.g. '["Lower back"]'
    timeAvailable?: string        // '30', '45', or '60'
  }>()
```

Replace `initSession()` with:

```typescript
async function initSession() {
  const program = await getActiveProgram()
  if (!program) return

  // Use AI-adjusted session if provided, otherwise fall back to program plan
  let session: any
  if (adjustedSession) {
    try {
      session = JSON.parse(adjustedSession)
    } catch {
      // fall through to program lookup
    }
  }
  if (!session) {
    const parsed = program.program
    session = parsed.sessions?.find((s: any) => s.day === sessionDay)
  }
  if (!session) return

  const exerciseStates: ExerciseState[] = session.exercises.map((ex: any) => ({
    name: ex.name,
    category: ex.category,
    restSeconds: ex.rest_seconds ?? 90,
    notes: ex.notes ?? '',
    sets: Array.from({ length: ex.sets }, (_: unknown, i: number) => ({
      setNumber: i + 1,
      targetReps: ex.reps,
      actualReps: null,
      weight: ex.starting_weight || null,
      completed: false,
    })),
  }))

  setExercises(exerciseStates)

  const dbSession = await database.write(async () => {
    return database.get<SessionModel>('sessions').create((record) => {
      record.programId = program.id
      record.sessionDay = sessionDay
      record.plannedJson = JSON.stringify(session)
      record.synced = false
      // Write check-in data if provided
      if (energyCheckin) record.energyCheckin = parseInt(energyCheckin, 10)
      if (soreAreas) record.soreAreas = soreAreas
      if (timeAvailable) record.timeAvailable = parseInt(timeAvailable, 10)
    })
  })

  setSessionDbId(dbSession.id)
}
```

- [ ] **Step 2: Manual test — start a workout from the home screen (still routes direct for now)**
  - Verify workout still loads correctly (no regressions)

- [ ] **Step 3: Commit**

```bash
git add 'app/workout/[sessionId]/active.tsx'
git commit -m "Accept adjusted session and check-in params in active workout screen"
```

---

## Task 5: Pre-workout check-in screen (`app/workout/[sessionId]/checkin.tsx`)

**Files:**
- Modify: `app/workout/[sessionId]/checkin.tsx`

- [ ] **Step 1: Replace the stub with the full check-in screen**

```typescript
// app/workout/[sessionId]/checkin.tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { Colors, Spacing } from '../../../constants/theme'
import { supabase } from '../../../lib/supabase'
import { getActiveProgram } from '../../../lib/programs'

const ENERGY_OPTIONS = [
  { label: '🔥  Feeling great — let\'s go', value: 5 },
  { label: '💪  Good, ready to train', value: 4 },
  { label: '😐  Average, I\'ll push through', value: 3 },
  { label: '😴  Low energy today', value: 2 },
  { label: '💀  Running on fumes', value: 1 },
]

const SORE_CHIPS = [
  'Lower back', 'Shoulders', 'Knees', 'Hips',
  'Hamstrings', 'Quads', 'Chest', 'Nothing',
]

const TIME_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min+', value: 60 },
]

type Phase = 'questions' | 'loading' | 'adjustment'

export default function CheckinScreen() {
  const { sessionId, sessionDay } = useLocalSearchParams<{
    sessionId: string
    sessionDay: string
  }>()

  const [energy, setEnergy] = useState<number | null>(null)
  const [soreAreas, setSoreAreas] = useState<string[]>([])
  const [timeAvailable, setTimeAvailable] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('questions')
  const [adjustmentNote, setAdjustmentNote] = useState<string>('')
  const [adjustedSession, setAdjustedSession] = useState<object | null>(null)

  const canSubmit = energy !== null && soreAreas.length > 0 && timeAvailable !== null

  function toggleSoreArea(chip: string) {
    if (chip === 'Nothing') {
      setSoreAreas(['Nothing'])
      return
    }
    setSoreAreas(prev => {
      const without = prev.filter(x => x !== 'Nothing')
      return without.includes(chip)
        ? without.filter(x => x !== chip)
        : [...without, chip]
    })
  }

  async function handleSubmit() {
    if (!canSubmit) return

    const netState = await NetInfo.fetch()
    const isOnline = netState.isConnected

    if (!isOnline) {
      // Skip AI, go straight to workout
      navigateToWorkout(null)
      return
    }

    setPhase('loading')

    try {
      const program = await getActiveProgram()
      if (!program) {
        navigateToWorkout(null)
        return
      }

      const parsed = program.program
      const sessionPlan = parsed.sessions?.find((s: any) => s.day === sessionDay)
      if (!sessionPlan) {
        navigateToWorkout(null)
        return
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const { data, error } = await supabase.functions.invoke('adjust-session', {
        body: {
          energy,
          sore_areas: soreAreas.filter(s => s !== 'Nothing'),
          time: timeAvailable,
          session_json: JSON.stringify(sessionPlan),
          last_session_summary: null,
        },
      })

      clearTimeout(timeout)

      if (error || !data) {
        navigateToWorkout(null)
        return
      }

      const note: string = data.adjustment_note ?? ''
      const isUnchanged = note.toLowerCase().includes('no adjustment')

      if (isUnchanged) {
        navigateToWorkout(null)
      } else {
        setAdjustedSession(data)
        setAdjustmentNote(note)
        setPhase('adjustment')
      }
    } catch {
      navigateToWorkout(null)
    }
  }

  function navigateToWorkout(adjusted: object | null) {
    router.replace({
      pathname: '/workout/[sessionId]/active',
      params: {
        sessionId,
        sessionDay,
        adjustedSession: adjusted ? JSON.stringify(adjusted) : undefined,
        energyCheckin: String(energy),
        soreAreas: JSON.stringify(soreAreas.filter(s => s !== 'Nothing')),
        timeAvailable: String(timeAvailable),
      },
    })
  }

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Checking in with your coach...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (phase === 'adjustment') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.adjustmentContainer}>
          <Text style={styles.adjustmentTitle}>Your coach made some changes</Text>
          <View style={styles.adjustmentCard}>
            <Text style={styles.adjustmentNote}>{adjustmentNote}</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigateToWorkout(adjustedSession)}
          >
            <Text style={styles.primaryBtnText}>Use adjusted workout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigateToWorkout(null)}
          >
            <Text style={styles.secondaryBtnText}>Keep original</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Quick check-in</Text>
          <Text style={styles.subheading}>30 seconds — helps your coach adjust today's session.</Text>

          {/* Energy */}
          <Text style={styles.questionLabel}>How's your energy today?</Text>
          <View style={styles.energyOptions}>
            {ENERGY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.energyBtn, energy === opt.value && styles.energyBtnSelected]}
                onPress={() => setEnergy(opt.value)}
              >
                <Text style={[styles.energyBtnText, energy === opt.value && styles.energyBtnTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sore areas */}
          <Text style={styles.questionLabel}>Anything sore or tight?</Text>
          <View style={styles.chips}>
            {SORE_CHIPS.map(chip => {
              const active = soreAreas.includes(chip)
              return (
                <TouchableOpacity
                  key={chip}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleSoreArea(chip)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Time */}
          <Text style={styles.questionLabel}>How much time do you have?</Text>
          <View style={styles.timeRow}>
            {TIME_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.timeBtn, timeAvailable === opt.value && styles.timeBtnSelected]}
                onPress={() => setTimeAvailable(opt.value)}
              >
                <Text style={[styles.timeBtnText, timeAvailable === opt.value && styles.timeBtnTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            <Text style={styles.submitBtnText}>Let's go →</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg },
  heading: { color: Colors.text, fontSize: 26, fontWeight: '800', marginBottom: 6 },
  subheading: { color: Colors.muted, fontSize: 14, marginBottom: Spacing.xl },

  questionLabel: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },

  // Energy buttons
  energyOptions: { gap: 8 },
  energyBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  energyBtnSelected: { borderColor: Colors.accent, backgroundColor: 'transparent' },
  energyBtnText: { color: Colors.muted, fontSize: 15, fontWeight: '500' },
  energyBtnTextSelected: { color: Colors.text },

  // Chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: 'transparent' },
  chipText: { color: Colors.muted, fontSize: 14 },
  chipTextActive: { color: Colors.accent },

  // Time buttons
  timeRow: { flexDirection: 'row', gap: 8 },
  timeBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  timeBtnSelected: { borderColor: Colors.accent, backgroundColor: 'transparent' },
  timeBtnText: { color: Colors.muted, fontSize: 15, fontWeight: '600' },
  timeBtnTextSelected: { color: Colors.text },

  // Submit
  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  submitBtnDisabled: { backgroundColor: Colors.surface },
  submitBtnText: { color: Colors.text, fontSize: 17, fontWeight: '700' },

  // Loading state
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  loadingText: { color: Colors.muted, fontSize: 16 },

  // Adjustment state
  adjustmentContainer: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  adjustmentTitle: { color: Colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: Spacing.sm },
  adjustmentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    marginBottom: Spacing.sm,
  },
  adjustmentNote: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', padding: Spacing.sm },
  secondaryBtnText: { color: Colors.muted, fontSize: 15 },
})
```

- [ ] **Step 2: Manual test — navigate directly to the check-in URL to verify it renders**
  - In the app, you can test by temporarily routing to checkin from somewhere
  - Verify all 3 questions appear
  - Verify "Let's go →" is disabled until all 3 answered
  - Verify "Nothing" chip deselects other chips
  - Verify selecting any other chip deselects "Nothing"

- [ ] **Step 3: Commit**

```bash
git add 'app/workout/[sessionId]/checkin.tsx'
git commit -m "Implement pre-workout check-in screen with AI session adjustment"
```

---

## Task 6: Route home screen through check-in

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Update the "Start Workout" button to route to checkin**

Find the `onPress` handler on the Start Workout button (currently routes to `/workout/[sessionId]/active`) and replace:

```typescript
// In HomeScreen, replace:
onPress={() =>
  router.push({
    pathname: '/workout/[sessionId]/active',
    params: {
      sessionId: `${nextSessionDay}-${Date.now()}`,
      sessionDay: nextSessionDay,
    },
  })
}

// With:
onPress={() =>
  router.push({
    pathname: '/workout/[sessionId]/checkin',
    params: {
      sessionId: `${nextSessionDay}-${Date.now()}`,
      sessionDay: nextSessionDay,
    },
  })
}
```

- [ ] **Step 2: Manual test — end-to-end flow**
  - Tap "Start Workout" on home screen
  - Verify check-in screen appears
  - Answer all 3 questions, tap "Let's go →"
  - If online: verify "Checking in with your coach..." loading state appears briefly
  - Verify active workout screen opens with correct exercises
  - If AI made changes: verify adjustment card shows before workout starts

- [ ] **Step 3: Commit**

```bash
git add 'app/(tabs)/index.tsx'
git commit -m "Route Start Workout through pre-workout check-in"
```

---

## Task 7: Deploy `adjust-session` edge function + integration test

**Files:**
- Create: `supabase/functions/tests/adjust-session.test.mjs`

- [ ] **Step 1: Deploy the edge function**

```bash
npx supabase functions deploy adjust-session --project-ref wrihcdltfwvuobvzjpsc
```

Expected output: `Deployed Function adjust-session`

- [ ] **Step 2: Create `supabase/functions/tests/adjust-session.test.mjs`**

```javascript
// supabase/functions/tests/adjust-session.test.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env', 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [k, v] = line.replace(/^export /, '').split('=')
    if (k && v) acc[k.trim()] = v.trim()
    return acc
  }, {})

const supabase = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY
)

const SESSION_PLAN = {
  day: 'A',
  focus: 'Lower Body Strength',
  exercises: [
    { name: 'Squat', category: 'main', sets: 3, reps: '5', starting_weight: 185, rest_seconds: 180, progression: '+5lbs per session', notes: '' },
    { name: 'Romanian Deadlift', category: 'accessory', sets: 3, reps: '8-10', starting_weight: 135, rest_seconds: 90, progression: '+5lbs weekly', notes: '' },
    { name: 'Leg Press', category: 'accessory', sets: 3, reps: '10-12', starting_weight: 200, rest_seconds: 90, progression: '+10lbs weekly', notes: '' },
  ],
}

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`)
    passed++
  } else {
    console.error(`  ✗ ${message}`)
    failed++
  }
}

console.log('\n=== adjust-session edge function tests ===\n')

// Test 1: Returns valid session JSON for normal energy
console.log('Test 1: Normal energy, no soreness, full time')
{
  const { data, error } = await supabase.functions.invoke('adjust-session', {
    body: {
      energy: 4,
      sore_areas: [],
      time: 60,
      session_json: JSON.stringify(SESSION_PLAN),
      last_session_summary: null,
    },
  })
  assert(!error, 'No error')
  assert(data, 'Returns data')
  assert(typeof data.adjustment_note === 'string', 'Has adjustment_note string')
  assert(Array.isArray(data.exercises), 'Has exercises array')
}

// Test 2: Low energy triggers adjustment
console.log('\nTest 2: Low energy (2/5) — expects modification')
{
  const { data, error } = await supabase.functions.invoke('adjust-session', {
    body: {
      energy: 2,
      sore_areas: [],
      time: 60,
      session_json: JSON.stringify(SESSION_PLAN),
      last_session_summary: null,
    },
  })
  assert(!error, 'No error')
  assert(data, 'Returns data')
  assert(typeof data.adjustment_note === 'string', 'Has adjustment_note')
  assert(!data.adjustment_note.toLowerCase().includes('no adjustment'), 'Note indicates changes were made')
}

// Test 3: Lower back soreness + Romanian Deadlift in session
console.log('\nTest 3: Lower back soreness — expects RDL modification or removal')
{
  const { data, error } = await supabase.functions.invoke('adjust-session', {
    body: {
      energy: 4,
      sore_areas: ['Lower back'],
      time: 60,
      session_json: JSON.stringify(SESSION_PLAN),
      last_session_summary: null,
    },
  })
  assert(!error, 'No error')
  assert(data, 'Returns data')
  assert(typeof data.adjustment_note === 'string', 'Has adjustment_note')
}

// Test 4: 30 min time constraint on a full session
console.log('\nTest 4: Only 30 min available')
{
  const { data, error } = await supabase.functions.invoke('adjust-session', {
    body: {
      energy: 4,
      sore_areas: [],
      time: 30,
      session_json: JSON.stringify(SESSION_PLAN),
      last_session_summary: null,
    },
  })
  assert(!error, 'No error')
  assert(data, 'Returns data')
  assert(Array.isArray(data.exercises), 'Has exercises array')
  const exerciseCount = data.exercises.length
  assert(exerciseCount <= SESSION_PLAN.exercises.length, 'Exercise count not increased')
}

// Test 5: Response preserves session structure
console.log('\nTest 5: Response structure matches session JSON format')
{
  const { data, error } = await supabase.functions.invoke('adjust-session', {
    body: {
      energy: 5,
      sore_areas: [],
      time: 60,
      session_json: JSON.stringify(SESSION_PLAN),
      last_session_summary: null,
    },
  })
  assert(!error, 'No error')
  assert(data?.day === SESSION_PLAN.day, 'Preserves session day')
  assert(typeof data?.focus === 'string', 'Has focus string')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)
```

- [ ] **Step 3: Run the test**

```bash
node supabase/functions/tests/adjust-session.test.mjs
```

Expected: all 5 tests pass. If a test fails, check the edge function logs:
```bash
npx supabase functions logs adjust-session --project-ref wrihcdltfwvuobvzjpsc
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/tests/adjust-session.test.mjs
git commit -m "Add adjust-session edge function integration tests"
```

---

## Task 8: Add `.superpowers` to `.gitignore`

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add the brainstorm output directory to .gitignore**

Add to `.gitignore`:
```
# Brainstorming mockups
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "Ignore .superpowers brainstorm output directory"
```

---

## Final end-to-end verification

- [ ] Start the app: `npx expo start --clear`
- [ ] Tap **Start Workout** → check-in screen appears
- [ ] Answer all 3 questions → tap "Let's go →"
- [ ] Workout completes normally → summary screen
- [ ] Tap **Progress** tab → dashboard shows (empty state if first session, or data if sessions exist)
- [ ] Tap a lift row → drill-down screen with chart opens
- [ ] Tap back → returns to progress dashboard
- [ ] Run edge function tests: `node supabase/functions/tests/adjust-session.test.mjs`
