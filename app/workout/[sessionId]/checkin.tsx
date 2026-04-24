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
import { Colors, Spacing, Radius } from '../../../constants/theme'
import { supabase } from '../../../lib/supabase'
import { userHasPro } from '../../../lib/auth-gate'
import { getActiveProgram } from '../../../lib/programs'

const ENERGY_OPTIONS = [
  { label: 'Running on fumes', value: 1 },
  { label: 'Low energy today', value: 2 },
  { label: "I'll push through", value: 3 },
  { label: 'Good, ready to train', value: 4 },
  { label: "Feeling great — let's go", value: 5 },
]

const SORE_CHIPS = [
  'Lower back', 'Shoulders', 'Knees', 'Hips',
  'Hamstrings', 'Quads', 'Chest', 'Nothing',
]

const TIME_OPTIONS = [
  { label: '30', caption: 'min', value: 30 },
  { label: '45', caption: 'min', value: 45 },
  { label: '60', caption: 'min+', value: 60 },
]

type Phase = 'questions' | 'loading' | 'adjustment' | 'upsell'

// Render a 5-segment energy bar
function EnergyBar({ filled, active }: { filled: number; active: boolean }) {
  return (
    <View style={energyBarStyles.container}>
      {[1, 2, 3, 4, 5].map((seg) => (
        <View
          key={seg}
          style={[
            energyBarStyles.segment,
            seg <= filled
              ? active
                ? energyBarStyles.segmentFilledActive
                : energyBarStyles.segmentFilled
              : energyBarStyles.segmentEmpty,
          ]}
        />
      ))}
    </View>
  )
}

const energyBarStyles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 3, flex: 1, marginHorizontal: 12 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  segmentFilledActive: { backgroundColor: Colors.accent },
  segmentFilled: { backgroundColor: Colors.lineStrong },
  segmentEmpty: { backgroundColor: Colors.line },
})

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
  const [isUpsellLoggedOut, setIsUpsellLoggedOut] = useState(false)

  // CTA is enabled when energy AND time are selected (sore areas optional per spec)
  const canSubmit = energy !== null && timeAvailable !== null

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

    const { data: { session } } = await supabase.auth.getSession()
    const isPro = session ? await userHasPro(session.user.id, session.user.created_at) : false
    if (!isPro) {
      setIsUpsellLoggedOut(!session)
      setPhase('upsell')
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

  if (phase === 'upsell') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.adjustmentContainer}>
          <Text style={styles.adjustmentTitle}>
            {isUpsellLoggedOut ? 'Get AI coaching free' : 'AI check-in is a Pro feature'}
          </Text>
          <View style={styles.adjustmentCard}>
            <Text style={styles.adjustmentNote}>
              {isUpsellLoggedOut
                ? "Adapt analyzes your energy, soreness, and available time to adjust today's workout before you start.\n\nCreate a free account to unlock this and all Pro features for 4 weeks — no credit card required."
                : "Adapt Pro analyzes your energy, soreness, and available time to adjust today's workout before you start — trimming, swapping, or scaling automatically."}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push(isUpsellLoggedOut ? '/(auth)/signup' : '/paywall')}
          >
            <Text style={styles.primaryBtnText}>
              {isUpsellLoggedOut ? 'Start Free Trial' : 'Upgrade to Pro'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigateToWorkout(null)}
          >
            <Text style={styles.secondaryBtnText}>Continue to workout →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
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
        {/* Fixed header with Skip */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerLabel}>BEFORE WE START</Text>
            <Text style={styles.headerHeading}>Quick check-in</Text>
          </View>
          <TouchableOpacity onPress={() => navigateToWorkout(null)} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subheading}>Helps your coach adjust today's session.</Text>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* Energy question */}
          <View style={styles.questionBlock}>
            <Text style={styles.questionLabel}>How's your energy today?</Text>
            <View style={styles.energyOptions}>
              {ENERGY_OPTIONS.map(opt => {
                const selected = energy === opt.value
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.energyBtn, selected && styles.energyBtnSelected]}
                    onPress={() => setEnergy(opt.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.energyNumeral, selected && styles.energyNumeralSelected]}>
                      {opt.value}
                    </Text>
                    <EnergyBar filled={opt.value} active={selected} />
                    <Text style={[styles.energyBtnLabel, selected && styles.energyBtnLabelSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Sore areas */}
          <View style={styles.questionBlock}>
            <Text style={styles.questionLabel}>Anything sore or tight?</Text>
            <View style={styles.chips}>
              {SORE_CHIPS.map(chip => {
                const active = soreAreas.includes(chip)
                return (
                  <TouchableOpacity
                    key={chip}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleSoreArea(chip)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Time question */}
          <View style={styles.questionBlock}>
            <Text style={styles.questionLabel}>How much time do you have?</Text>
            <View style={styles.timeRow}>
              {TIME_OPTIONS.map(opt => {
                const selected = timeAvailable === opt.value
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.timeCard, selected && styles.timeCardSelected]}
                    onPress={() => setTimeAvailable(opt.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.timeNumeral, selected && styles.timeNumeralSelected]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.timeCaption, selected && styles.timeCaptionSelected]}>
                      {opt.caption}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Sticky CTA */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <Text style={[styles.submitBtnText, !canSubmit && styles.submitBtnTextDisabled]}>
              Let's go →
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  headerLabel: {
    color: Colors.faint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerHeading: {
    color: Colors.text,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.025 * 30,
  },
  skipBtn: { paddingVertical: 6, paddingHorizontal: 4, marginTop: 18 },
  skipText: { color: Colors.muted, fontSize: 15, fontWeight: '500' },

  subheading: {
    color: Colors.muted,
    fontSize: 13,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },

  container: { paddingHorizontal: Spacing.lg },

  questionBlock: { marginBottom: Spacing.xl },
  questionLabel: {
    color: Colors.faint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },

  // Energy options
  energyOptions: { gap: 6 },
  energyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.line,
  },
  energyBtnSelected: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  energyNumeral: {
    color: Colors.faint,
    fontSize: 14,
    fontFamily: 'Courier',
    fontWeight: '500',
    width: 16,
  },
  energyNumeralSelected: { color: Colors.accent },
  energyBtnLabel: {
    color: Colors.muted,
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'right',
    flex: 0,
    minWidth: 120,
  },
  energyBtnLabelSelected: { color: Colors.accent },

  // Sore chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 0.5,
    borderColor: Colors.line,
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  chipText: { color: Colors.muted, fontSize: 14, fontWeight: '400' },
  chipTextActive: { color: Colors.accent, fontWeight: '500' },

  // Time cards
  timeRow: { flexDirection: 'row', gap: Spacing.sm },
  timeCard: {
    flex: 1,
    height: 56,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeCardSelected: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  timeNumeral: {
    color: Colors.muted,
    fontSize: 20,
    fontFamily: 'Courier',
    fontWeight: '500',
    lineHeight: 22,
  },
  timeNumeralSelected: { color: Colors.accent },
  timeCaption: {
    color: Colors.faint,
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },
  timeCaptionSelected: { color: Colors.accent },

  // Sticky CTA
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: 0.5,
    borderTopColor: Colors.line,
  },
  submitBtn: {
    backgroundColor: Colors.accent,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: {
    color: Colors.accentInk,
    fontSize: 17,
    fontWeight: '700',
  },
  submitBtnTextDisabled: {},

  // Loading
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  loadingText: { color: Colors.muted, fontSize: 16 },

  // Adjustment / upsell phases
  adjustmentContainer: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  adjustmentTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  adjustmentCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.line,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    marginBottom: Spacing.sm,
  },
  adjustmentNote: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  primaryBtn: {
    backgroundColor: Colors.accent,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: Colors.accentInk, fontSize: 17, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', padding: Spacing.sm },
  secondaryBtnText: { color: Colors.muted, fontSize: 15 },
})
