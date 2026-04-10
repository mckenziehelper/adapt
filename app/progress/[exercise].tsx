// app/progress/[exercise].tsx
import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
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
            <Text style={styles.chartLabel}>
              WEIGHT OVER TIME (last {chartSessions.length} sessions)
            </Text>
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
  headerTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },

  container: { padding: Spacing.lg },

  prCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
  },
  prLabel: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  prWeight: { color: Colors.text, fontSize: 36, fontWeight: '800' },
  prDate: { color: Colors.muted, fontSize: 13, marginTop: 4 },

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
