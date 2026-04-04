import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
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

  const elapsed =
    session?.completedAt && session?.createdAt
      ? Math.round(
          (session.completedAt - new Date(session.createdAt).getTime()) / 1000 / 60
        )
      : 0

  const uniqueExercises = [...new Set(sets.map((s) => s.exerciseName))]

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.title}>Workout Complete</Text>
        <Text style={styles.subtitle}>Nice work.</Text>

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

        <View style={styles.exerciseSummary}>
          {uniqueExercises.map((name) => {
            const exerciseSets = sets.filter((s) => s.exerciseName === name)
            const topSet = exerciseSets.reduce((best, s) => {
              const score = (s.weight || 0) * (s.actualReps || 0)
              const bestScore = (best.weight || 0) * (best.actualReps || 0)
              return score > bestScore ? s : best
            }, exerciseSets[0])

            return (
              <View key={name} style={styles.exerciseRow}>
                <Text style={styles.exerciseRowName}>{name}</Text>
                <Text style={styles.exerciseRowDetail}>
                  {exerciseSets.length} sets · Top: {topSet?.weight}lbs x {topSet?.actualReps}
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
  exerciseSummary: { gap: Spacing.xs, marginBottom: Spacing.xl },
  exerciseRow: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 10,
  },
  exerciseRowName: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  exerciseRowDetail: { color: Colors.muted, fontSize: 14, marginTop: 2 },
  doneButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: { color: Colors.text, fontSize: 18, fontWeight: '700' },
})
