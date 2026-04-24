import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg'
import { Colors, Spacing } from '../../constants/theme'
import { getLiftHistory, LiftSession } from '../../lib/stats'

function LiftChart({ sessions }: { sessions: LiftSession[] }) {
  const { width } = useWindowDimensions()
  const chartWidth = width - Spacing.lg * 2 - Spacing.md * 2
  const chartHeight = 140
  const paddingTop = 24
  const paddingBottom = 28
  const paddingLeft = 40
  const paddingRight = 16

  const innerW = chartWidth - paddingLeft - paddingRight
  const innerH = chartHeight - paddingTop - paddingBottom

  const weights = sessions.map(s => s.maxWeight)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 1

  function x(i: number) {
    return paddingLeft + (sessions.length === 1 ? innerW / 2 : (i / (sessions.length - 1)) * innerW)
  }
  function y(weight: number) {
    return paddingTop + innerH - ((weight - minW) / range) * innerH
  }

  // Build SVG path
  const points = sessions.map((s, i) => ({ px: x(i), py: y(s.maxWeight), session: s }))
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px} ${p.py}`).join(' ')

  // Y-axis labels (3 ticks)
  const yTicks = [minW, Math.round((minW + maxW) / 2), maxW]

  // X-axis date labels
  const dateLabels = sessions.map(s =>
    new Date(s.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
  )

  const prWeight = Math.max(...weights)

  return (
    <Svg width={chartWidth} height={chartHeight}>
      {/* Y-axis ticks */}
      {yTicks.map((w, i) => (
        <React.Fragment key={i}>
          <Line
            x1={paddingLeft - 4}
            y1={y(w)}
            x2={chartWidth - paddingRight}
            y2={y(w)}
            stroke={Colors.surface}
            strokeWidth={1}
          />
          <SvgText
            x={paddingLeft - 8}
            y={y(w) + 4}
            fontSize={9}
            fill={Colors.muted}
            textAnchor="end"
          >
            {w}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Line */}
      <Path
        d={pathD}
        stroke={Colors.accent}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots + date labels */}
      {points.map((p, i) => {
        const isPR = p.session.maxWeight === prWeight
        return (
          <React.Fragment key={i}>
            <Circle
              cx={p.px}
              cy={p.py}
              r={isPR ? 5 : 4}
              fill={isPR ? Colors.success : Colors.accent}
            />
            <SvgText
              x={p.px}
              y={chartHeight - 4}
              fontSize={8}
              fill={Colors.muted}
              textAnchor="middle"
            >
              {dateLabels[i]}
            </SvgText>
          </React.Fragment>
        )
      })}
    </Svg>
  )
}

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

  const chartSessions = [...history].reverse()
  const prWeight = history.length > 0 ? Math.max(...history.map(s => s.maxWeight)) : 0
  const prSession = history.find(s => s.maxWeight === prWeight)
  const prDate = prSession
    ? new Date(prSession.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''

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

          {/* Line chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartLabel}>
              WEIGHT OVER TIME — LAST {chartSessions.length} SESSIONS
            </Text>
            <LiftChart sessions={chartSessions} />
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.legendText}>PR</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.accent }]} />
                <Text style={styles.legendText}>Session max</Text>
              </View>
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
  chartLegend: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    justifyContent: 'flex-end',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: Colors.muted, fontSize: 10 },

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
