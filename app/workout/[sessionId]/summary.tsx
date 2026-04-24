import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing, Radius } from '../../../constants/theme'
import { database, SessionModel, SetModel } from '../../../lib/watermelon'
import { Q } from '@nozbe/watermelondb'

export default function SummaryScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const [session, setSession] = useState<SessionModel | null>(null)
  const [sets, setSets] = useState<SetModel[]>([])
  const [totalVolume, setTotalVolume] = useState(0)

  useEffect(() => {
    if (sessionId) loadSummary()
  }, [sessionId])

  async function loadSummary() {
    if (!sessionId) return
    try {
      const sessionRecord = await database.get<SessionModel>('sessions').find(sessionId)
      setSession(sessionRecord)

      const sessionSets = await database
        .get<SetModel>('sets')
        .query(Q.where('session_id', sessionId))
        .fetch()
      setSets(sessionSets)

      const volume = sessionSets.reduce(
        (acc, s) => acc + (s.weight || 0) * (s.actualReps || 0),
        0
      )
      setTotalVolume(volume)
    } catch (err) {
      console.error('Error loading summary:', err)
    }
  }

  async function handleDelete() {
    Alert.alert(
      'Delete workout?',
      'This will permanently remove this session and all logged sets.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!sessionId) return
            await database.write(async () => {
              const setsToDelete = await database
                .get<SetModel>('sets')
                .query(Q.where('session_id', sessionId))
                .fetch()
              for (const s of setsToDelete) await s.markAsDeleted()
              const sessionRecord = await database.get<SessionModel>('sessions').find(sessionId)
              await sessionRecord.markAsDeleted()
            })
            router.replace('/(tabs)/')
          },
        },
      ]
    )
  }

  const elapsed =
    session?.completedAt && session?.createdAt
      ? Math.round(
          (session.completedAt - new Date(session.createdAt).getTime()) / 1000 / 60
        )
      : 0

  const uniqueExercises = [...new Set(sets.map((s) => s.exerciseName))]
  const prSets = sets.filter((s) => s.isPR)
  const prCount = prSets.length

  // Average rest — rough estimate based on set count and elapsed time
  const avgRestSec = sets.length > 1
    ? Math.round(((elapsed * 60) - sets.length * 45) / (sets.length - 1))
    : 0

  const displayAvgRest = avgRestSec > 0 ? avgRestSec : '--'

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>

        {/* Hero text */}
        <View style={styles.heroSection}>
          <Text style={styles.heroLabel}>SESSION COMPLETE</Text>
          <Text style={styles.heroDisplay}>
            <Text style={styles.heroLine1}>Nice work.{'\n'}</Text>
            <Text style={styles.heroLine2}>{elapsed} min. {sets.length} sets.</Text>
          </Text>
        </View>

        {/* 2×2 stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>VOLUME</Text>
            <Text style={styles.statNumeral}>{Math.round(totalVolume).toLocaleString()}</Text>
            <Text style={styles.statUnit}>lbs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>AVG REST</Text>
            <Text style={styles.statNumeral}>{displayAvgRest}</Text>
            <Text style={styles.statUnit}>sec</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>PRs HIT</Text>
            <Text style={[styles.statNumeral, prCount > 0 && { color: Colors.accent }]}>
              {prCount}
            </Text>
            <Text style={styles.statUnit}>lifts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>STREAK</Text>
            <Text style={styles.statNumeral}>7</Text>
            <Text style={styles.statUnit}>wks</Text>
          </View>
        </View>

        {/* Coach notes card */}
        {session?.aiReaction ? (
          <View style={styles.coachCard}>
            <View style={styles.coachDot} />
            <View style={styles.coachContent}>
              <Text style={styles.coachLabel}>COACH NOTES</Text>
              <Text style={styles.coachText}>{session.aiReaction}</Text>
            </View>
          </View>
        ) : prCount > 0 ? (
          <View style={styles.coachCard}>
            <View style={styles.coachDot} />
            <View style={styles.coachContent}>
              <Text style={styles.coachLabel}>COACH NOTES</Text>
              <Text style={styles.coachText}>
                {prCount === 1
                  ? `You hit a PR this session — that's exactly the kind of progress I'm tracking. Keep it consistent.`
                  : `${prCount} PRs in one session. Strong work — I'll factor this into next week's targets.`}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Exercise breakdown */}
        {uniqueExercises.length > 0 && (
          <View style={styles.breakdownSection}>
            <Text style={styles.breakdownLabel}>EXERCISE BREAKDOWN</Text>
            <View style={styles.breakdownList}>
              {uniqueExercises.map((name) => {
                const exerciseSets = sets.filter((s) => s.exerciseName === name)
                const topSet = exerciseSets.reduce((best, s) => {
                  const score = (s.weight || 0) * (s.actualReps || 0)
                  const bestScore = (best.weight || 0) * (best.actualReps || 0)
                  return score > bestScore ? s : best
                }, exerciseSets[0])
                const hasPR = exerciseSets.some(s => s.isPR)

                return (
                  <View key={name} style={styles.exerciseRow}>
                    <View style={styles.exerciseRowTop}>
                      <Text style={styles.exerciseRowName}>{name}</Text>
                      {hasPR && (
                        <View style={styles.prBadge}>
                          <Text style={styles.prBadgeText}>PR</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.exerciseRowDetail}>
                      {exerciseSets.length} sets · Top: {topSet?.weight}lbs × {topSet?.actualReps}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.replace('/(tabs)/')}
          activeOpacity={0.85}
        >
          <Text style={styles.doneButtonText}>Back to today</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Delete this workout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.xxl },

  // Hero
  heroSection: { marginBottom: Spacing.xl },
  heroLabel: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  heroDisplay: {
    fontSize: 44,
    fontWeight: '600',
    letterSpacing: -0.03 * 44,
    lineHeight: 44 * 0.95,
  },
  heroLine1: {
    color: Colors.text,
  },
  heroLine2: {
    color: Colors.muted,
  },

  // 2×2 stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.line,
    padding: Spacing.md,
  },
  statLabel: {
    color: Colors.faint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  statNumeral: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '500',
    fontFamily: 'Courier',
    lineHeight: 36,
  },
  statUnit: {
    color: Colors.faint,
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },

  // Coach notes card
  coachCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.line,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  coachDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    margin: Spacing.lg,
    marginRight: 0,
    flexShrink: 0,
  },
  coachContent: {
    flex: 1,
    padding: Spacing.lg,
    paddingLeft: Spacing.md,
  },
  coachLabel: {
    color: Colors.faint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  coachText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 26,
  },

  // Exercise breakdown
  breakdownSection: { marginBottom: Spacing.xl },
  breakdownLabel: {
    color: Colors.faint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  breakdownList: { gap: Spacing.xs },
  exerciseRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: Colors.line,
    padding: Spacing.md,
  },
  exerciseRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  exerciseRowName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  prBadge: {
    borderWidth: 0.5,
    borderColor: Colors.accent,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  prBadgeText: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  exerciseRowDetail: { color: Colors.muted, fontSize: 13 },

  // CTA
  doneButton: {
    backgroundColor: Colors.text,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  doneButtonText: { color: Colors.background, fontSize: 17, fontWeight: '700' },

  deleteBtn: { alignItems: 'center', padding: Spacing.sm },
  deleteBtnText: { color: Colors.faint, fontSize: 14 },
})
