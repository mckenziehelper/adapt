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

  calendar: { gap: 6 },
  calendarRow: { flexDirection: 'row', gap: 6 },
  calendarDot: { width: 32, height: 32, borderRadius: 6 },
  calendarDotFilled: { backgroundColor: Colors.success },
  calendarDotEmpty: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#4B5563' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: Colors.muted, fontSize: 15, textAlign: 'center' },
})
