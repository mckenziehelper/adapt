import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Spacing } from '../constants/theme'

type Props = {
  sessionDay: string
  focus: string
  exercises: Array<{ name: string }>
  onStart: () => void
}

export default function WorkoutCard({ sessionDay, focus, exercises, onStart }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>DAY {sessionDay}</Text>
      <Text style={styles.focus}>{focus}</Text>
      <Text style={styles.exerciseList}>
        {exercises
          .slice(0, 3)
          .map((e) => e.name)
          .join(' · ')}
        {exercises.length > 3 ? ` +${exercises.length - 3} more` : ''}
      </Text>
      <TouchableOpacity style={styles.button} onPress={onStart}>
        <Text style={styles.buttonText}>Start Workout</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  label: { color: Colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  focus: { color: Colors.text, fontSize: 24, fontWeight: '700', marginTop: 4, marginBottom: Spacing.sm },
  exerciseList: { color: Colors.muted, fontSize: 14, marginBottom: Spacing.lg },
  button: {
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
})
