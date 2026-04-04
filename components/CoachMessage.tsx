import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Spacing } from '../constants/theme'

type Props = {
  message: string
  weekStart: string
  onReadMore?: () => void
  preview?: boolean
}

export default function CoachMessage({ message, weekStart, onReadMore, preview }: Props) {
  const displayMessage = preview ? message.split('.')[0] + '.' : message

  return (
    <View style={styles.card}>
      <Text style={styles.label}>WEEKLY COACH MESSAGE</Text>
      <Text style={styles.date}>{weekStart}</Text>
      <Text style={styles.message}>{displayMessage}</Text>
      {preview && onReadMore && (
        <TouchableOpacity onPress={onReadMore} style={styles.readMore}>
          <Text style={styles.readMoreText}>Read full message</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  label: { color: Colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 3 },
  date: { color: Colors.muted, fontSize: 13, marginTop: 4, marginBottom: Spacing.sm },
  message: { color: Colors.text, fontSize: 15, lineHeight: 24 },
  readMore: { marginTop: Spacing.sm },
  readMoreText: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
})
