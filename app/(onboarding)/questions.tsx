import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing } from '../../constants/theme'

type Answers = {
  training_history: string
  goal: string
  equipment: string
  days_per_week: number
  session_time: number
}

const QUESTIONS = [
  {
    key: 'training_history',
    question: 'How long have you been lifting?',
    options: [
      { label: 'Never lifted', value: 'beginner' },
      { label: 'Some experience', value: 'intermediate' },
      { label: 'Been lifting 2+ years', value: 'advanced' },
    ],
  },
  {
    key: 'goal',
    question: "What's your main goal?",
    options: [
      { label: 'Get stronger', value: 'stronger' },
      { label: 'Look better', value: 'look_better' },
      { label: 'Both', value: 'both' },
    ],
  },
  {
    key: 'equipment',
    question: "What's your equipment situation?",
    options: [
      { label: 'Full gym', value: 'full_gym' },
      { label: 'Home with weights', value: 'home' },
      { label: 'Bodyweight only', value: 'bodyweight' },
    ],
  },
  {
    key: 'days_per_week',
    question: 'How many days per week can you train?',
    options: [
      { label: '2 days', value: 2 },
      { label: '3 days', value: 3 },
      { label: '4 days', value: 4 },
    ],
  },
  {
    key: 'session_time',
    question: 'How long per session?',
    options: [
      { label: '30 minutes', value: 30 },
      { label: '45 minutes', value: 45 },
      { label: '60+ minutes', value: 60 },
    ],
  },
]

export default function QuestionsScreen() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Partial<Answers>>({})

  const current = QUESTIONS[step]

  const handleSelect = (value: string | number) => {
    const updated = { ...answers, [current.key]: value }
    setAnswers(updated)

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1)
    } else {
      router.push({
        pathname: '/(onboarding)/generating',
        params: {
          training_history: updated.training_history as string,
          goal: updated.goal as string,
          equipment: updated.equipment as string,
          days_per_week: String(updated.days_per_week),
          session_time: String(updated.session_time),
        },
      })
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Progress */}
        <View style={styles.progressRow}>
          {QUESTIONS.map((_, i) => (
            <View
              key={i}
              style={[styles.progressDot, i <= step && styles.progressDotActive]}
            />
          ))}
        </View>

        {/* Question */}
        <View style={styles.content}>
          <Text style={styles.questionNumber}>{step + 1} of {QUESTIONS.length}</Text>
          <Text style={styles.question}>{current.question}</Text>
          <View style={styles.options}>
            {current.options.map((opt) => (
              <TouchableOpacity
                key={String(opt.value)}
                style={styles.option}
                onPress={() => handleSelect(opt.value)}
              >
                <Text style={styles.optionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Back button */}
        {step > 0 && (
          <TouchableOpacity onPress={() => setStep(step - 1)} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, padding: Spacing.lg, justifyContent: 'space-between' },
  progressRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.xl },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surface,
  },
  progressDotActive: { backgroundColor: Colors.accent },
  content: { flex: 1, justifyContent: 'center' },
  questionNumber: { color: Colors.muted, fontSize: 14, marginBottom: Spacing.sm },
  question: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    marginBottom: Spacing.xl,
  },
  options: { gap: Spacing.sm },
  option: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionText: { color: Colors.text, fontSize: 18, fontWeight: '500' },
  backButton: { paddingVertical: Spacing.md },
  backText: { color: Colors.muted, fontSize: 16 },
})
