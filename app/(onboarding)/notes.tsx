import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing } from '../../constants/theme'

const SUGGESTIONS = [
  'I also do cardio 2-3 days a week',
  'I have a lower back injury',
  'I have a shoulder injury',
  'I want to avoid heavy squatting',
  'I travel frequently and need hotel-friendly options',
  "I'm currently in a calorie deficit",
  "I've been on a long training break",
  'I want to focus on upper body',
]

export default function NotesScreen() {
  const params = useLocalSearchParams<{
    training_history: string
    goal: string
    equipment: string
    days_per_week: string
    session_time: string
  }>()

  const [selected, setSelected] = useState<string[]>([])
  const [freeText, setFreeText] = useState('')

  const toggleSuggestion = (s: string) => {
    setSelected((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  const handleContinue = () => {
    const notes = [...selected, freeText.trim()].filter(Boolean).join('. ')
    router.push({
      pathname: '/(onboarding)/generating',
      params: {
        ...params,
        notes: notes || '',
      },
    })
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.question}>Anything else we should know?</Text>
          <Text style={styles.subtitle}>
            Injuries, other training, preferences — the more context, the better the program.
          </Text>

          <View style={styles.chips}>
            {SUGGESTIONS.map((s) => {
              const active = selected.includes(s)
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleSuggestion(s)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Anything else... (optional)"
            placeholderTextColor={Colors.muted}
            value={freeText}
            onChangeText={setFreeText}
            multiline
            numberOfLines={3}
            returnKeyType="done"
            blurOnSubmit
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.button} onPress={handleContinue}>
            <Text style={styles.buttonText}>Build my program →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleContinue} style={styles.skip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  question: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: Colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: 'transparent',
  },
  chipText: {
    color: Colors.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.accent,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: 16,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  footer: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  skip: { alignItems: 'center', paddingVertical: Spacing.sm },
  skipText: { color: Colors.muted, fontSize: 15 },
})
