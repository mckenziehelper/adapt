import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors, Spacing } from '../constants/theme'

export default function CoachMessageScreen() {
  const [coachMessage, setCoachMessage] = useState<string | null>(null)
  const [nextWeekFocus, setNextWeekFocus] = useState<string | null>(null)
  const [messageDate, setMessageDate] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [msg, focus, date] = await Promise.all([
        AsyncStorage.getItem('coach_message'),
        AsyncStorage.getItem('next_week_focus'),
        AsyncStorage.getItem('coach_message_date'),
      ])
      setCoachMessage(msg)
      setNextWeekFocus(focus)
      setMessageDate(date)
    }
    load()
  }, [])

  function formatDate(isoDate: string | null): string {
    if (!isoDate) return ''
    const d = new Date(isoDate)
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.label}>FROM YOUR COACH</Text>
        {messageDate && <Text style={styles.date}>{formatDate(messageDate)}</Text>}

        {coachMessage ? (
          <Text style={styles.messageText}>{coachMessage}</Text>
        ) : (
          <Text style={styles.emptyText}>
            No coach message yet. Run "Weekly Review" from your Profile to generate one.
          </Text>
        )}

        {nextWeekFocus && (
          <View style={styles.focusCard}>
            <Text style={styles.focusLabel}>NEXT WEEK'S FOCUS</Text>
            <Text style={styles.focusText}>{nextWeekFocus}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  backButton: { alignSelf: 'flex-start' },
  backText: { color: Colors.accent, fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  container: { padding: Spacing.lg },
  label: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: Spacing.xs,
  },
  date: {
    color: Colors.muted,
    fontSize: 13,
    marginBottom: Spacing.lg,
  },
  messageText: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 26,
    marginBottom: Spacing.xl,
  },
  emptyText: {
    color: Colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  focusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  focusLabel: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  focusText: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
})
