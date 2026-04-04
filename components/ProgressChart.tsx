import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing } from '../constants/theme'

type DataPoint = {
  date: string
  weight: number
}

type Props = {
  title: string
  data: DataPoint[]
}

// Placeholder — Phase 2 will use Victory Native for real charts
export default function ProgressChart({ title, data }: Props) {
  if (data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>No data yet</Text>
      </View>
    )
  }

  const max = Math.max(...data.map((d) => d.weight))
  const latest = data[data.length - 1]

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.current}>{latest.weight}lbs</Text>
      <Text style={styles.meta}>Best: {max}lbs · {data.length} sessions</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
  },
  title: { color: Colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  current: { color: Colors.text, fontSize: 32, fontWeight: '800', marginTop: 4 },
  meta: { color: Colors.muted, fontSize: 13, marginTop: 4 },
  empty: { color: Colors.muted, fontSize: 14, marginTop: Spacing.sm },
})
