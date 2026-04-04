import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Spacing } from '../constants/theme'

type Props = {
  onAllow: () => void
  onSkip: () => void
}

export default function HealthKitPrompt({ onAllow, onSkip }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect Apple Health</Text>
      <Text style={styles.body}>
        Adapt can read your sleep, steps, and cardio to make smarter adaptations.
        Read-only — we never write to your Health data.
      </Text>
      <TouchableOpacity style={styles.allowBtn} onPress={onAllow}>
        <Text style={styles.allowText}>Connect Apple Health</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: '700', marginBottom: Spacing.sm },
  body: { color: Colors.muted, fontSize: 15, lineHeight: 22, marginBottom: Spacing.lg },
  allowBtn: {
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  allowText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  skipBtn: { alignItems: 'center', padding: Spacing.xs },
  skipText: { color: Colors.muted, fontSize: 14 },
})
