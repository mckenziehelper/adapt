import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing } from '../constants/theme'

type Change = {
  type: string
  exercise: string
  reason: string
  old_value: string
  new_value: string
}

type Props = {
  changes: Change[]
  nextWeekFocus: string
}

export default function AdaptationSummary({ changes, nextWeekFocus }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>This Week's Changes</Text>
      {changes.map((change, i) => (
        <View key={i} style={styles.changeRow}>
          <Text style={styles.changeType}>{change.type.replace(/_/g, ' ').toUpperCase()}</Text>
          <Text style={styles.exercise}>{change.exercise}</Text>
          <Text style={styles.detail}>
            {change.old_value} → {change.new_value}
          </Text>
          <Text style={styles.reason}>{change.reason}</Text>
        </View>
      ))}
      {nextWeekFocus ? (
        <View style={styles.focus}>
          <Text style={styles.focusLabel}>NEXT WEEK</Text>
          <Text style={styles.focusText}>{nextWeekFocus}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: Spacing.md },
  changeRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.background,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
  },
  changeType: { color: Colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  exercise: { color: Colors.text, fontSize: 16, fontWeight: '600', marginTop: 2 },
  detail: { color: Colors.success, fontSize: 14, marginTop: 2 },
  reason: { color: Colors.muted, fontSize: 13, marginTop: 4 },
  focus: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  focusLabel: { color: Colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  focusText: { color: Colors.text, fontSize: 15, marginTop: 4 },
})
