import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing } from '../constants/theme'

type Props = {
  exercise: string
  weight: number
  reps: number
}

export default function PRBadge({ exercise, weight, reps }: Props) {
  return (
    <View style={styles.badge}>
      <Text style={styles.label}>NEW PR</Text>
      <Text style={styles.exercise}>{exercise}</Text>
      <Text style={styles.detail}>{weight}lbs x {reps}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Colors.success,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  label: { color: Colors.background, fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  exercise: { color: Colors.background, fontSize: 18, fontWeight: '700', marginTop: 4 },
  detail: { color: Colors.background, fontSize: 14, opacity: 0.8 },
})
