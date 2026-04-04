import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing } from '../../constants/theme'
import { getActiveProgram } from '../../lib/programs'
import { ProgramModel } from '../../lib/watermelon'

export default function ReadyScreen() {
  const [program, setProgram] = useState<ProgramModel | null>(null)

  useEffect(() => {
    getActiveProgram().then(setProgram)
  }, [])

  if (!program) {
    return (
      <View style={[styles.scroll, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: Colors.muted }}>Loading your program...</Text>
      </View>
    )
  }

  const parsed = program.program

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.badge}>YOUR PROGRAM</Text>
      <Text style={styles.title}>{parsed.program_name}</Text>
      <Text style={styles.structure}>{parsed.weekly_structure}</Text>

      {parsed.coach_note ? (
        <View style={styles.coachNote}>
          <Text style={styles.coachNoteLabel}>From your coach</Text>
          <Text style={styles.coachNoteText}>{parsed.coach_note}</Text>
        </View>
      ) : null}

      <View style={styles.sessions}>
        {parsed.sessions?.map((session: any) => (
          <View key={session.day} style={styles.sessionCard}>
            <Text style={styles.sessionDay}>Day {session.day}</Text>
            <Text style={styles.sessionFocus}>{session.focus}</Text>
            <Text style={styles.exerciseCount}>
              {session.exercises?.length ?? 0} exercises
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(tabs)/')}
      >
        <Text style={styles.buttonText}>Let's go</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  badge: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
  },
  title: { color: Colors.text, fontSize: 32, fontWeight: '800', marginBottom: Spacing.xs },
  structure: { color: Colors.muted, fontSize: 16, marginBottom: Spacing.lg },
  coachNote: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  coachNoteLabel: { color: Colors.accent, fontSize: 12, fontWeight: '700', marginBottom: Spacing.xs },
  coachNoteText: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  sessions: { gap: Spacing.sm, marginBottom: Spacing.xl },
  sessionCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 12,
  },
  sessionDay: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  sessionFocus: { color: Colors.text, fontSize: 18, fontWeight: '600', marginTop: 4 },
  exerciseCount: { color: Colors.muted, fontSize: 14, marginTop: 4 },
  button: {
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: Colors.text, fontSize: 18, fontWeight: '700' },
})
