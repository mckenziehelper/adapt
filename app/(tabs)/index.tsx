import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView } from 'react-native'
import { router } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { Colors, Spacing } from '../../constants/theme'
import { getActiveProgram } from '../../lib/programs'
import { ProgramModel } from '../../lib/watermelon'

export default function HomeScreen() {
  const [program, setProgram] = useState<ProgramModel | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [nextSessionDay, setNextSessionDay] = useState<string>('A')

  useEffect(() => {
    getActiveProgram().then((p) => {
      setProgram(p)
      if (p) {
        const parsed = p.program
        setNextSessionDay(parsed.sessions?.[0]?.day ?? 'A')
      }
    })

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected)
    })

    return () => unsubscribe()
  }, [])

  const parsed = program?.program
  const todaySession = parsed?.sessions?.find((s: any) => s.day === nextSessionDay)

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
            <Text style={styles.workoutFocus}>{todaySession.focus}</Text>
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
                  pathname: '/workout/[sessionId]/active',
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
              {program ? 'No session found.' : 'No program loaded yet.'}
            </Text>
            {!program && (
              <TouchableOpacity
                style={[styles.startButton, { marginTop: Spacing.md }]}
                onPress={() => router.push('/(onboarding)/welcome')}
              >
                <Text style={styles.startButtonText}>Set up your program</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {parsed?.program_name && (
          <View style={styles.programBadge}>
            <Text style={styles.programLabel}>CURRENT PROGRAM</Text>
            <Text style={styles.programName}>{parsed.program_name}</Text>
          </View>
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
  programBadge: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
  },
  programLabel: { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  programName: { color: Colors.text, fontSize: 16, fontWeight: '600', marginTop: 4 },
})
