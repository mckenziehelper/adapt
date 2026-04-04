import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing } from '../constants/theme'

type Props = {
  name: string
  category: string
  sets: number
  reps: string
  notes?: string
}

export default function ExerciseRow({ name, category, sets, reps, notes }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.category}>{category}</Text>
      </View>
      <Text style={styles.detail}>{sets} sets x {reps}</Text>
      {notes ? <Text style={styles.notes}>{notes}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  category: { color: Colors.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  detail: { color: Colors.muted, fontSize: 14, marginTop: 2 },
  notes: { color: Colors.muted, fontSize: 13, marginTop: 4, fontStyle: 'italic' },
})
