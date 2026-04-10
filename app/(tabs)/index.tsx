import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { Colors, Spacing } from '../../constants/theme'
import { getActiveProgram } from '../../lib/programs'
import { ProgramModel } from '../../lib/watermelon'

export default function HomeScreen() {
  const [program, setProgram] = useState<ProgramModel | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [nextSessionDay, setNextSessionDay] = useState<string>('A')
  const [showDescription, setShowDescription] = useState(false)
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

  // Reload coach message each time the tab comes into focus
  // (so it appears immediately after Weekly Review completes)
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

  function formatMessageDate(isoDate: string | null): string {
    if (!isoDate) return ''
    const d = new Date(isoDate)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <SafeAreaView style={styles.safe}>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline — syncs when you reconnect</Text>
        </View>
      )}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.greeting}>Today</Text>

        {todaySession ? (
          <View style={styles.workoutCard}>
            <Text style={styles.workoutLabel}>DAY {todaySession.day}</Text>
            <TouchableOpacity
              onPress={() => todaySession.description ? setShowDescription(v => !v) : null}
              activeOpacity={todaySession.description ? 0.7 : 1}
            >
              <Text style={styles.workoutFocus}>
                {todaySession.focus}{todaySession.description ? (showDescription ? '  ▲' : '  ▼') : ''}
              </Text>
              {showDescription && todaySession.description ? (
                <Text style={styles.workoutDescription}>{todaySession.description}</Text>
              ) : null}
            </TouchableOpacity>
            <Text style={styles.exerciseList}>
              {todaySession.exercises
                ?.slice(0, 3)
                .map((e: any) => e.name)
                .join(' · ')}
              {todaySession.exercises?.length > 3 ? ` +${todaySession.exercises.length - 3} more` : ''}
            </Text>
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
            >
              <Text style={styles.startButtonText}>Start Workout</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.workoutCard}>
            <Text style={styles.workoutFocus}>
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

        {coachMessage && (
          <TouchableOpacity
            style={styles.coachCard}
            onPress={() => router.push('/coach-message')}
            activeOpacity={0.8}
          >
            <Text style={styles.coachLabel}>FROM YOUR COACH</Text>
            {coachMessageDate && (
              <Text style={styles.coachDate}>{formatMessageDate(coachMessageDate)}</Text>
            )}
            <Text style={styles.coachPreview} numberOfLines={3}>
              {coachMessage}
            </Text>
            <Text style={styles.coachReadMore}>Read more →</Text>
          </TouchableOpacity>
        )}

        {parsed?.program_name && (
          <TouchableOpacity
            style={styles.programBadge}
            onPress={() => router.push('/program')}
          >
            <Text style={styles.programLabel}>CURRENT PROGRAM</Text>
            <Text style={styles.programName}>{parsed.program_name}</Text>
            <Text style={styles.programViewLink}>View & edit →</Text>
          </TouchableOpacity>
        )}
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
  },
  offlineText: { color: Colors.muted, fontSize: 13 },
  scroll: { flex: 1 },
  container: { padding: Spacing.lg },
  greeting: { color: Colors.muted, fontSize: 14, marginBottom: Spacing.sm },
  workoutCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  workoutLabel: { color: Colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  workoutFocus: { color: Colors.text, fontSize: 24, fontWeight: '700', marginTop: 4, marginBottom: Spacing.sm },
  exerciseList: { color: Colors.muted, fontSize: 14, marginBottom: Spacing.lg },
  startButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  startButtonText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  workoutDescription: {
    color: Colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: Spacing.xs,
  },
  coachCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
  },
  coachLabel: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: Spacing.xs,
  },
  coachDate: {
    color: Colors.muted,
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  coachPreview: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  coachReadMore: { color: Colors.accent, fontSize: 13, fontWeight: '600' },
  programBadge: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
  },
  programLabel: { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  programName: { color: Colors.text, fontSize: 16, fontWeight: '600', marginTop: 4 },
  programViewLink: { color: Colors.accent, fontSize: 13, marginTop: Spacing.xs },
})
