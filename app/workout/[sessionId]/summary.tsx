import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing } from '../../../constants/theme'
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.title}>Workout Complete</Text>
        <Text style={styles.subtitle}>Nice work.</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{elapsed}</Text>
            <Text style={styles.statLabel}>minutes</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{sets.length}</Text>
            <Text style={styles.statLabel}>sets logged</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{Math.round(totalVolume).toLocaleString()}</Text>
            <Text style={styles.statLabel}>lbs volume</Text>
          </View>
        </View>

        {/* PRs */}
        {prSets.length > 0 && (
          <View style={styles.prSection}>
            <Text style={styles.prSectionLabel}>🏆  PERSONAL RECORDS</Text>
            {prSets.map((s, i) => (
              <View key={i} style={styles.prRow}>
                <Text style={styles.prExercise}>{s.exerciseName}</Text>
                <Text style={styles.prDetail}>{s.weight} lbs × {s.actualReps} reps</Text>
              </View>
            ))}
          </View>
        )}

        {/* Exercise breakdown */}
        <View style={styles.exerciseSummary}>
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
                  {hasPR && <Text style={styles.prBadge}>PR</Text>}
                </View>
                <Text style={styles.exerciseRowDetail}>
                  {exerciseSets.length} sets · Top: {topSet?.weight}lbs × {topSet?.actualReps}
                </Text>
              </View>
            )
          })}
        </View>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.replace('/(tabs)/')}
        >
          <Text style={styles.doneButtonText}>Back to Home</Text>
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
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { color: Colors.success, fontSize: 36, fontWeight: '800', marginTop: Spacing.xl },
  subtitle: { color: Colors.muted, fontSize: 18, marginBottom: Spacing.xl },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center' },
  statValue: { color: Colors.text, fontSize: 28, fontWeight: '800' },
  statLabel: { color: Colors.muted, fontSize: 13, marginTop: 4 },

  prSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
    gap: Spacing.xs,
  },
  prSectionLabel: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  prRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prExercise: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  prDetail: { color: Colors.success, fontSize: 14, fontWeight: '600' },

  exerciseSummary: { gap: Spacing.xs, marginBottom: Spacing.xl },
  exerciseRow: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 10,
  },
  exerciseRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  exerciseRowName: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  prBadge: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  exerciseRowDetail: { color: Colors.muted, fontSize: 14 },

  doneButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  doneButtonText: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  deleteBtn: { alignItems: 'center', padding: Spacing.sm },
  deleteBtnText: { color: Colors.muted, fontSize: 14 },
})
