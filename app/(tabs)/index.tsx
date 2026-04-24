import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { Colors, Spacing, Radius } from '../../constants/theme'
import { getActiveProgram } from '../../lib/programs'
import { ProgramModel } from '../../lib/watermelon'

export default function HomeScreen() {
  const [program, setProgram] = useState<ProgramModel | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [nextSessionDay, setNextSessionDay] = useState<string>('A')
  const [coachMessage, setCoachMessage] = useState<string | null>(null)
  const [coachMessageDate, setCoachMessageDate] = useState<string | null>(null)

  useEffect(() => {
    getActiveProgram().then((p) => {
      setProgram(p)
      if (p) {
        const parsed = p.program
        setNextSessionDay(parsed?.sessions?.[0]?.day ?? 'A')
      }
    })

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected)
    })

    return () => unsubscribe()
  }, [])

  useFocusEffect(
    useCallback(() => {
      async function loadCoachMessage() {
        const msg = await AsyncStorage.getItem('coach_message')
        const date = await AsyncStorage.getItem('coach_message_date')
        setCoachMessage(msg)
        setCoachMessageDate(date)
      }
      loadCoachMessage()
    }, []),
  )

  const parsed = program?.program
  const todaySession = parsed?.sessions?.find((s: any) => s.day === nextSessionDay)
  const exercises: any[] = todaySession?.exercises ?? []

  function formatMessageDate(isoDate: string | null): string {
    if (!isoDate) return ''
    const d = new Date(isoDate)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function getTodayLabel(): string {
    const d = new Date()
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()
  }

  // Estimate session duration from exercise count (rough heuristic)
  function estimateDuration(exList: any[]): number {
    if (!exList.length) return 45
    const totalSets = exList.reduce((acc: number, e: any) => acc + (e.sets ?? 3), 0)
    return Math.round(totalSets * 2.5 + 5)
  }

  const sessionDuration = estimateDuration(exercises)
  const exerciseCount = exercises.length

  return (
    <SafeAreaView style={styles.safe}>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline — syncs when you reconnect</Text>
        </View>
      )}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>

        {/* Greeting row */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingDate}>{getTodayLabel()}</Text>
            <Text style={styles.greetingHeading}>Ready when you are.</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>A</Text>
          </View>
        </View>

        {/* Hero workout card */}
        {todaySession ? (
          <View style={styles.workoutCard}>
            {/* Left accent rail */}
            <View style={styles.accentRail} />

            {/* Day / stats row */}
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardDayLabel}>
                DAY {todaySession.day} · {todaySession.focus?.split(' ').slice(0, 1).join(' ').toUpperCase() ?? 'WORKOUT'}
              </Text>
              <View style={styles.metaDivider} />
              <Text style={styles.cardMetaRight}>
                {exerciseCount} · {sessionDuration}m
              </Text>
            </View>

            {/* Session title */}
            <Text style={styles.sessionTitle}>{todaySession.focus}</Text>

            {/* Exercise preview list */}
            <View style={styles.exerciseList}>
              {exercises.slice(0, 4).map((e: any, i: number) => (
                <View key={i} style={styles.exerciseRow}>
                  <Text style={styles.exerciseIndex}>
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                  <Text style={styles.exerciseName} numberOfLines={1}>{e.name}</Text>
                  <Text style={styles.exerciseSets}>
                    {e.sets}×{e.reps}
                  </Text>
                </View>
              ))}
              {exercises.length > 4 && (
                <Text style={styles.moreExercises}>
                  +{exercises.length - 4} more exercises
                </Text>
              )}
            </View>

            {/* CTA button */}
            <TouchableOpacity
              style={styles.startButton}
              onPress={() =>
                router.push({
                  pathname: '/workout/[sessionId]/checkin',
                  params: {
                    sessionId: `${nextSessionDay}-${Date.now()}`,
                    sessionDay: nextSessionDay,
                  },
                })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.startButtonText}>Start workout →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.workoutCard}>
            <View style={styles.accentRail} />
            <Text style={styles.sessionTitle}>
              {parsed ? 'No session found.' : 'No program loaded yet.'}
            </Text>
            {!parsed && (
              <TouchableOpacity
                style={[styles.startButton, { marginTop: Spacing.md }]}
                onPress={() => router.push('/(onboarding)/welcome')}
              >
                <Text style={styles.startButtonText}>Set up your program</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Mini stat cards row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>THIS WEEK</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statNumeral}>{exerciseCount > 0 ? '3' : '0'}</Text>
              <Text style={styles.statUnit}>sessions</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>STREAK</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statNumeral, { color: Colors.accent }]}>7</Text>
              <Text style={styles.statUnit}>days</Text>
            </View>
          </View>
        </View>

        {/* Coach message card */}
        {coachMessage && (
          <TouchableOpacity
            style={styles.coachCard}
            onPress={() => router.push('/coach-message')}
            activeOpacity={0.8}
          >
            <View style={styles.coachAccentDot} />
            <View style={styles.coachContent}>
              <View style={styles.coachHeaderRow}>
                <Text style={styles.coachLabel}>FROM YOUR COACH</Text>
                {coachMessageDate && (
                  <Text style={styles.coachDate}>{formatMessageDate(coachMessageDate)}</Text>
                )}
              </View>
              <Text style={styles.coachPreview} numberOfLines={3}>
                {coachMessage}
              </Text>
              <Text style={styles.coachReadMore}>Read more →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Program footer */}
        {parsed?.program_name && (
          <TouchableOpacity
            style={styles.programFooter}
            onPress={() => router.push('/program')}
            activeOpacity={0.8}
          >
            <View style={styles.programFooterLeft}>
              <Text style={styles.programFooterLabel}>CURRENT PROGRAM</Text>
              <Text style={styles.programFooterName}>{parsed.program_name}</Text>
              <Text style={styles.programFooterWeek}>Week 1 of your program</Text>
            </View>
            <Text style={styles.programFooterChevron}>›</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  offlineBanner: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.line,
  },
  offlineText: { color: Colors.faint, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  scroll: { flex: 1 },
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },

  // Greeting row
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  greetingDate: {
    color: Colors.faint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  greetingHeading: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.02 * 28,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarInitial: {
    color: Colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },

  // Hero workout card
  workoutCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.line,
    overflow: 'hidden',
  },
  accentRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.accent,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
  },

  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cardDayLabel: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  metaDivider: {
    width: 0.5,
    height: 10,
    backgroundColor: Colors.line,
    marginHorizontal: Spacing.sm,
  },
  cardMetaRight: {
    color: Colors.faint,
    fontSize: 12,
    fontFamily: 'Courier',
    fontWeight: '500',
  },

  sessionTitle: {
    color: Colors.text,
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: -0.03 * 34,
    marginBottom: Spacing.md,
    lineHeight: 38,
  },

  // Exercise preview list
  exerciseList: {
    marginBottom: Spacing.lg,
    gap: 10,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  exerciseIndex: {
    color: Colors.faint,
    fontSize: 12,
    fontFamily: 'Courier',
    fontWeight: '500',
    width: 24,
  },
  exerciseName: {
    flex: 1,
    color: Colors.muted,
    fontSize: 14,
    fontWeight: '400',
  },
  exerciseSets: {
    color: Colors.faint,
    fontSize: 12,
    fontFamily: 'Courier',
    fontWeight: '500',
  },
  moreExercises: {
    color: Colors.faint,
    fontSize: 12,
    marginTop: 2,
    paddingLeft: 32,
  },

  // CTA button
  startButton: {
    backgroundColor: Colors.accent,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: Colors.accentInk,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Mini stat cards
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
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
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statNumeral: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '500',
    fontFamily: 'Courier',
  },
  statUnit: {
    color: Colors.faint,
    fontSize: 12,
    fontWeight: '400',
  },

  // Coach message card
  coachCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.line,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  coachAccentDot: {
    width: 3,
    backgroundColor: Colors.accent,
  },
  coachContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  coachHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  coachLabel: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  coachDate: {
    color: Colors.faint,
    fontSize: 11,
  },
  coachPreview: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  coachReadMore: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },

  // Program footer
  programFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: Colors.line,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  programFooterLeft: { flex: 1 },
  programFooterLabel: {
    color: Colors.faint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  programFooterName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  programFooterWeek: {
    color: Colors.faint,
    fontSize: 12,
  },
  programFooterChevron: {
    color: Colors.faint,
    fontSize: 22,
    fontWeight: '300',
    marginLeft: Spacing.sm,
  },
})
