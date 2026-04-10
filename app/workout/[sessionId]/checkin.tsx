// app/workout/[sessionId]/checkin.tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { Colors, Spacing } from '../../../constants/theme'
import { supabase } from '../../../lib/supabase'
import { getActiveProgram } from '../../../lib/programs'

const ENERGY_OPTIONS = [
  { label: '🔥  Feeling great — let\'s go', value: 5 },
  { label: '💪  Good, ready to train', value: 4 },
  { label: '😐  Average, I\'ll push through', value: 3 },
  { label: '😴  Low energy today', value: 2 },
  { label: '💀  Running on fumes', value: 1 },
]

const SORE_CHIPS = [
  'Lower back', 'Shoulders', 'Knees', 'Hips',
  'Hamstrings', 'Quads', 'Chest', 'Nothing',
]

const TIME_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min+', value: 60 },
]

type Phase = 'questions' | 'loading' | 'adjustment'

export default function CheckinScreen() {
  const { sessionId, sessionDay } = useLocalSearchParams<{
    sessionId: string
    sessionDay: string
  }>()

  const [energy, setEnergy] = useState<number | null>(null)
  const [soreAreas, setSoreAreas] = useState<string[]>([])
  const [timeAvailable, setTimeAvailable] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('questions')
  const [adjustmentNote, setAdjustmentNote] = useState<string>('')
  const [adjustedSession, setAdjustedSession] = useState<object | null>(null)

  const canSubmit = energy !== null && soreAreas.length > 0 && timeAvailable !== null

  function toggleSoreArea(chip: string) {
    if (chip === 'Nothing') {
      setSoreAreas(['Nothing'])
      return
    }
    setSoreAreas(prev => {
      const without = prev.filter(x => x !== 'Nothing')
      return without.includes(chip)
        ? without.filter(x => x !== chip)
        : [...without, chip]
    })
  }

  async function handleSubmit() {
    if (!canSubmit) return

    const netState = await NetInfo.fetch()
    const isOnline = netState.isConnected

    if (!isOnline) {
      navigateToWorkout(null)
      return
    }

    setPhase('loading')

    try {
      const program = await getActiveProgram()
      if (!program) {
        navigateToWorkout(null)
        return
      }

      const parsed = program.program
      const sessionPlan = parsed.sessions?.find((s: any) => s.day === sessionDay)
      if (!sessionPlan) {
        navigateToWorkout(null)
        return
      }

      const { data, error } = await supabase.functions.invoke('adjust-session', {
        body: {
          energy,
          sore_areas: soreAreas.filter(s => s !== 'Nothing'),
          time: timeAvailable,
          session_json: JSON.stringify(sessionPlan),
          last_session_summary: null,
        },
      })

      if (error || !data) {
        navigateToWorkout(null)
        return
      }

      const note: string = data.adjustment_note ?? ''
      const isUnchanged = note.toLowerCase().includes('no adjustment')

      if (isUnchanged) {
        navigateToWorkout(null)
      } else {
        setAdjustedSession(data)
        setAdjustmentNote(note)
        setPhase('adjustment')
      }
    } catch {
      navigateToWorkout(null)
    }
  }

  function navigateToWorkout(adjusted: object | null) {
    router.replace({
      pathname: '/workout/[sessionId]/active',
      params: {
        sessionId,
        sessionDay,
        adjustedSession: adjusted ? JSON.stringify(adjusted) : undefined,
        energyCheckin: String(energy),
        soreAreas: JSON.stringify(soreAreas.filter(s => s !== 'Nothing')),
        timeAvailable: String(timeAvailable),
      },
    })
  }

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Checking in with your coach...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (phase === 'adjustment') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.adjustmentContainer}>
          <Text style={styles.adjustmentTitle}>Your coach made some changes</Text>
          <View style={styles.adjustmentCard}>
            <Text style={styles.adjustmentNote}>{adjustmentNote}</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigateToWorkout(adjustedSession)}
          >
            <Text style={styles.primaryBtnText}>Use adjusted workout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigateToWorkout(null)}
          >
            <Text style={styles.secondaryBtnText}>Keep original</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Quick check-in</Text>
          <Text style={styles.subheading}>30 seconds — helps your coach adjust today's session.</Text>

          {/* Energy */}
          <Text style={styles.questionLabel}>How's your energy today?</Text>
          <View style={styles.energyOptions}>
            {ENERGY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.energyBtn, energy === opt.value && styles.energyBtnSelected]}
                onPress={() => setEnergy(opt.value)}
              >
                <Text style={[styles.energyBtnText, energy === opt.value && styles.energyBtnTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sore areas */}
          <Text style={styles.questionLabel}>Anything sore or tight?</Text>
          <View style={styles.chips}>
            {SORE_CHIPS.map(chip => {
              const active = soreAreas.includes(chip)
              return (
                <TouchableOpacity
                  key={chip}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleSoreArea(chip)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Time */}
          <Text style={styles.questionLabel}>How much time do you have?</Text>
          <View style={styles.timeRow}>
            {TIME_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.timeBtn, timeAvailable === opt.value && styles.timeBtnSelected]}
                onPress={() => setTimeAvailable(opt.value)}
              >
                <Text style={[styles.timeBtnText, timeAvailable === opt.value && styles.timeBtnTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            <Text style={styles.submitBtnText}>Let's go →</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg },
  heading: { color: Colors.text, fontSize: 26, fontWeight: '800', marginBottom: 6 },
  subheading: { color: Colors.muted, fontSize: 14, marginBottom: Spacing.xl },

  questionLabel: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },

  energyOptions: { gap: 8 },
  energyBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  energyBtnSelected: { borderColor: Colors.accent, backgroundColor: 'transparent' },
  energyBtnText: { color: Colors.muted, fontSize: 15, fontWeight: '500' },
  energyBtnTextSelected: { color: Colors.text },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: 'transparent' },
  chipText: { color: Colors.muted, fontSize: 14 },
  chipTextActive: { color: Colors.accent },

  timeRow: { flexDirection: 'row', gap: 8 },
  timeBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  timeBtnSelected: { borderColor: Colors.accent, backgroundColor: 'transparent' },
  timeBtnText: { color: Colors.muted, fontSize: 15, fontWeight: '600' },
  timeBtnTextSelected: { color: Colors.text },

  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  submitBtnDisabled: { backgroundColor: Colors.surface },
  submitBtnText: { color: Colors.text, fontSize: 17, fontWeight: '700' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  loadingText: { color: Colors.muted, fontSize: 16 },

  adjustmentContainer: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  adjustmentTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  adjustmentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    marginBottom: Spacing.sm,
  },
  adjustmentNote: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', padding: Spacing.sm },
  secondaryBtnText: { color: Colors.muted, fontSize: 15 },
})
